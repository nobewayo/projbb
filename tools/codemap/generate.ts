// @module: codemap
// @tags: tooling, ci

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { globby } from 'globby';
import ts from 'typescript';

interface CodemapConfig {
  include: string[];
  exclude: string[];
  markdownMaxPerGroup?: number;
}

interface BaseSymbolEntry {
  name: string;
  line: number;
  exported: boolean;
  signature?: string;
}

interface MethodEntry extends BaseSymbolEntry {
  className?: string;
}

interface ClassEntry extends BaseSymbolEntry {
  methods: MethodEntry[];
}

interface FileEntry {
  path: string;
  size: number;
  checksum: string;
  module?: string;
  tags: string[];
  imports: string[];
  namedExports: string[];
  symbols: {
    functions: BaseSymbolEntry[];
    classes: ClassEntry[];
    methods: MethodEntry[];
  };
}

interface CodemapDocument {
  generatedAt: string;
  options: {
    only?: string;
    fast?: boolean;
  };
  files: FileEntry[];
}

const CONFIG_PATH = path.resolve(process.cwd(), '.codemaprc.json');
const CODEMAP_PATH = path.resolve(process.cwd(), 'codemap.json');
const CODEMAP_MARKDOWN_PATH = path.resolve(process.cwd(), 'CODEMAP.md');

async function loadExistingCodemap(): Promise<CodemapDocument | null> {
  try {
    const raw = await fs.readFile(CODEMAP_PATH, 'utf8');
    return JSON.parse(raw) as CodemapDocument;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readConfig(): Promise<CodemapConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CodemapConfig>;
    return {
      include: parsed.include ?? ['packages/**/*.{ts,tsx,js,jsx}'],
      exclude:
        parsed.exclude ?? [
          '**/node_modules/**',
          '**/dist/**',
          '**/.next/**',
          '**/build/**',
          '**/coverage/**',
          '**/*.d.ts',
          '**/*.test.*',
          '**/*.spec.*',
        ],
      markdownMaxPerGroup: parsed.markdownMaxPerGroup ?? Infinity,
    };
  } catch (error) {
    return {
      include: ['packages/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      markdownMaxPerGroup: Infinity,
    };
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let only: string | undefined;
  let fast = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--only') {
      const pattern = args[i + 1];
      if (!pattern) {
        throw new Error('Expected pattern after --only');
      }
      only = pattern;
      i += 1;
    } else if (arg === '--fast') {
      fast = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { only, fast };
}

function checksum(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getLine(node: ts.Node, source: ts.SourceFile): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function hasExportModifier(modifiers: readonly ts.ModifierLike[] | undefined): boolean {
  return Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

function hasDefaultModifier(modifiers: readonly ts.ModifierLike[] | undefined): boolean {
  return Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
}

function getFunctionSignature(
  node: ts.FunctionLikeDeclarationBase,
  source: ts.SourceFile,
  assignedName?: string,
): string {
  const modifiers = (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)
    ?.map((m) => m.getText(source))
    .join(' ');
  const name = ts.isConstructorDeclaration(node)
    ? 'constructor'
    : node.name?.getText(source) ?? assignedName ?? '(anonymous)';
  const params = node.parameters.map((param) => param.getText(source)).join(', ');
  const returnType = node.type ? `: ${node.type.getText(source)}` : '';
  const keyword = ts.isArrowFunction(node)
    ? '=>'
    : ts.isMethodDeclaration(node)
    ? ''
    : 'function';
  const prefix = modifiers ? `${modifiers} ` : '';
  if (ts.isArrowFunction(node)) {
    const typeAnnotation = node.type ? `: ${node.type.getText(source)}` : '';
    const leftSide = assignedName ?? name;
    return `${prefix}${leftSide} = (${params})${typeAnnotation} =>`;
  }
  if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
    return `${prefix}${name}(${params})${returnType}`;
  }
  return `${prefix}${keyword} ${name}(${params})${returnType}`.trim();
}

function getClassSignature(node: ts.ClassDeclaration, source: ts.SourceFile): string {
  const modifiers = node.modifiers?.map((m) => m.getText(source)).join(' ');
  const name = node.name?.getText(source) ?? '(anonymous)';
  const heritageClauses = node.heritageClauses?.map((clause) => clause.getText(source)).join(' ');
  const prefix = modifiers ? `${modifiers} ` : '';
  return [prefix + 'class ' + name, heritageClauses].filter(Boolean).join(' ');
}

function analyzeFile(filePath: string, sourceText: string, fast: boolean): FileEntry {
  const extension = path.extname(filePath);
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    extension === '.tsx'
      ? ts.ScriptKind.TSX
      : extension === '.jsx'
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS,
  );

  const imports = new Set<string>();
  const namedExports = new Set<string>();
  const functions: BaseSymbolEntry[] = [];
  const classes: ClassEntry[] = [];
  const methods: MethodEntry[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.add(node.moduleSpecifier.text);
      }
    }

    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          namedExports.add(element.name.getText(source));
        }
      } else if (!node.exportClause) {
        // export * from 'module'
        namedExports.add('*');
      }
    }

    if (ts.isExportAssignment(node)) {
      namedExports.add('default');
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      const exported = hasExportModifier(node.modifiers);
      const entry: BaseSymbolEntry = {
        name: node.name.getText(source),
        line: getLine(node, source),
        exported,
      };
      const isDefault = hasDefaultModifier(node.modifiers);
      if (!fast) {
        entry.signature = getFunctionSignature(node, source, entry.name);
      }
      functions.push(entry);
      if (exported && node.name) {
        namedExports.add(entry.name);
        if (isDefault) {
          namedExports.add('default');
        }
      }
    }

    if (ts.isVariableStatement(node)) {
      const exported = hasExportModifier(node.modifiers);
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        if (
          ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)
        ) {
          const funcNode = declaration.initializer;
          const entry: BaseSymbolEntry = {
            name: declaration.name.getText(source),
            line: getLine(funcNode, source),
            exported,
          };
          if (!fast) {
            entry.signature = getFunctionSignature(funcNode, source, `const ${entry.name}`);
          }
          functions.push(entry);
          if (exported) {
            namedExports.add(entry.name);
          }
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      const exported = hasExportModifier(node.modifiers) || hasDefaultModifier(node.modifiers);
      const classEntry: ClassEntry = {
        name: node.name?.getText(source) ?? '(anonymous)',
        line: getLine(node, source),
        exported,
        methods: [],
      };
      if (!fast) {
        classEntry.signature = getClassSignature(node, source);
      }
      classes.push(classEntry);
      if (node.name && exported) {
        namedExports.add(classEntry.name);
      }
      if (exported && hasDefaultModifier(node.modifiers)) {
        namedExports.add('default');
      }

      for (const member of node.members) {
        if (
          ts.isMethodDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member) ||
          ts.isConstructorDeclaration(member)
        ) {
          const methodEntry: MethodEntry = {
            name: member.name?.getText(source) ?? '(anonymous)',
            line: getLine(member, source),
            exported: hasExportModifier(member.modifiers),
            className: classEntry.name,
          };
          if (!fast && (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member))) {
            methodEntry.signature = getFunctionSignature(member, source, `${classEntry.name}.${methodEntry.name}`);
          }
          classEntry.methods.push(methodEntry);
          methods.push(methodEntry);
        }
      }
    }

    if (ts.isExportSpecifier(node)) {
      namedExports.add(node.name.getText(source));
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  const headerLines = sourceText.split(/\r?\n/).slice(0, 10);
  const moduleHeader = headerLines.find((line) => line.trim().startsWith('// @module:'));
  const tagsHeader = headerLines.find((line) => line.trim().startsWith('// @tags:'));

  const moduleName = moduleHeader?.split(':')[1]?.trim();
  const tags = tagsHeader
    ? tagsHeader
        .split(':')[1]
        ?.split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? []
    : [];

  return {
    path: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
    size: Buffer.byteLength(sourceText, 'utf8'),
    checksum: checksum(sourceText),
    module: moduleName || undefined,
    tags,
    imports: Array.from(imports).sort(),
    namedExports: Array.from(namedExports).sort(),
    symbols: {
      functions: functions.sort((a, b) => a.line - b.line),
      classes: classes.sort((a, b) => a.line - b.line),
      methods: methods.sort((a, b) => a.line - b.line),
    },
  };
}

function renderMarkdown(codemap: CodemapDocument, markdownMaxPerGroup: number, fast: boolean) {
  const groups = new Map<string, FileEntry[]>();
  for (const file of codemap.files) {
    const key = file.module ?? 'Uncategorized';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(file);
  }

  for (const [, files] of groups) {
    files.sort((a, b) => a.path.localeCompare(b.path));
  }

  const lines: string[] = [];
  lines.push('# CODEMAP');
  lines.push('');
  lines.push(`Generated at: ${codemap.generatedAt}`);
  lines.push('');

  const groupNames = Array.from(groups.keys()).sort();

  for (const groupName of groupNames) {
    lines.push(`## Module: ${groupName}`);
    lines.push('');

    const files = groups.get(groupName)!;
    let groupLineCount = 0;
    const maxLines = Number.isFinite(markdownMaxPerGroup) ? markdownMaxPerGroup : Infinity;

    for (const file of files) {
      const fileLines: string[] = [];
      fileLines.push(`- **${file.path}**`);
      if (file.tags.length > 0) {
        fileLines.push(`  - Tags: ${file.tags.join(', ')}`);
      }
      if (file.namedExports.length > 0) {
        fileLines.push(`  - Exports: ${file.namedExports.join(', ')}`);
      }
      if (file.imports.length > 0) {
        fileLines.push(`  - Imports: ${file.imports.join(', ')}`);
      }
      if (file.symbols.functions.length > 0) {
        fileLines.push('  - Functions:');
        for (const fn of file.symbols.functions) {
          const details = [`    - ${fn.name} (line ${fn.line})${fn.exported ? ' [exported]' : ''}`];
          if (!fast && fn.signature) {
            details.push(`      - ${fn.signature}`);
          }
          fileLines.push(...details);
        }
      }
      if (file.symbols.classes.length > 0) {
        fileLines.push('  - Classes:');
        for (const cls of file.symbols.classes) {
          const clsDetails = [`    - ${cls.name} (line ${cls.line})${cls.exported ? ' [exported]' : ''}`];
          if (!fast && cls.signature) {
            clsDetails.push(`      - ${cls.signature}`);
          }
          if (cls.methods.length > 0) {
            clsDetails.push('      - Methods:');
            for (const method of cls.methods) {
              const methodLine = `        - ${method.name} (line ${method.line})${method.exported ? ' [exported]' : ''}`;
              clsDetails.push(methodLine);
              if (!fast && method.signature) {
                clsDetails.push(`          - ${method.signature}`);
              }
            }
          }
          fileLines.push(...clsDetails);
        }
      }

      const newLinesCount = fileLines.length;
      if (groupLineCount + newLinesCount > maxLines) {
        lines.push('  - _Output truncated due to markdownMaxPerGroup limit._');
        break;
      }
      lines.push(...fileLines);
      groupLineCount += newLinesCount;
      lines.push('');
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const config = await readConfig();
  const { only, fast } = parseArgs();

  const patterns = only ? [only] : config.include;

  const filePaths = await globby(patterns, {
    ignore: config.exclude,
    gitignore: true,
    absolute: true,
  });

  filePaths.sort((a, b) => a.localeCompare(b));
  const filteredPaths = filePaths.filter((filePath) => /\.(ts|tsx|js|jsx)$/i.test(filePath));

  const files: FileEntry[] = [];
  for (const absolutePath of filteredPaths) {
    const sourceText = await fs.readFile(absolutePath, 'utf8');
    files.push(analyzeFile(absolutePath, sourceText, fast));
  }

  let finalFiles: FileEntry[] = files;
  let previous: CodemapDocument | null = null;
  const updatedPaths = new Set<string>(files.map((file) => file.path));

  if (only) {
    previous = await loadExistingCodemap();
    if (previous) {
      const map = new Map<string, FileEntry>();
      const previousIndex = new Map(previous.files.map((file) => [file.path, file] as const));
      for (const file of previous.files) {
        map.set(file.path, file);
      }
      for (const file of files) {
        map.set(file.path, file);
      }

      if (fast) {
        for (const filePath of updatedPaths) {
          const merged = map.get(filePath);
          const prior = previousIndex.get(filePath);
          if (!merged || !prior) {
            continue;
          }
          merged.symbols.functions = merged.symbols.functions.map((fn) => {
            if (!fn.signature) {
              const previousFn = prior.symbols.functions.find(
                (candidate) => candidate.name === fn.name && candidate.line === fn.line,
              );
              if (previousFn?.signature) {
                fn.signature = previousFn.signature;
              }
            }
            return fn;
          });
          merged.symbols.classes = merged.symbols.classes.map((cls) => {
            if (!cls.signature) {
              const previousCls = prior.symbols.classes.find(
                (candidate) => candidate.name === cls.name && candidate.line === cls.line,
              );
              if (previousCls?.signature) {
                cls.signature = previousCls.signature;
              }
            }
            cls.methods = cls.methods.map((method) => {
              if (!method.signature) {
                const previousMethod = prior.symbols.methods.find(
                  (candidate) =>
                    candidate.name === method.name &&
                    candidate.line === method.line &&
                    candidate.className === method.className,
                );
                if (previousMethod?.signature) {
                  method.signature = previousMethod.signature;
                }
              }
              return method;
            });
            return cls;
          });
          merged.symbols.methods = merged.symbols.methods.map((method) => {
            if (!method.signature) {
              const previousMethod = prior.symbols.methods.find(
                (candidate) =>
                  candidate.name === method.name &&
                  candidate.line === method.line &&
                  candidate.className === method.className,
              );
              if (previousMethod?.signature) {
                method.signature = previousMethod.signature;
              }
            }
            return method;
          });
        }
      }

      finalFiles = Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
    }
  }

  if (!previous) {
    finalFiles = files.sort((a, b) => a.path.localeCompare(b.path));
    previous = await loadExistingCodemap();
  }

  const options: CodemapDocument['options'] = { fast };
  if (only) {
    options.only = only;
  }

  let generatedAt = new Date().toISOString();

  if (previous) {
    const previousOptions = {
      fast: Boolean(previous.options.fast),
      ...(previous.options.only ? { only: previous.options.only } : {}),
    };
    const previousSnapshot = JSON.stringify({ options: previousOptions, files: previous.files });
    const nextSnapshot = JSON.stringify({ options, files: finalFiles });
    if (previousSnapshot === nextSnapshot) {
      generatedAt = previous.generatedAt;
    }
  }

  const codemap: CodemapDocument = {
    generatedAt,
    options,
    files: finalFiles,
  };

  const markdown = renderMarkdown(codemap, config.markdownMaxPerGroup ?? Infinity, fast);

  await fs.writeFile(CODEMAP_PATH, JSON.stringify(codemap, null, 2));
  await fs.writeFile(CODEMAP_MARKDOWN_PATH, markdown);

  console.log(`Processed ${files.length} file(s).`);
  if (only) {
    console.log(`Filter: ${only}`);
  }
  if (fast) {
    console.log('Fast mode enabled (signatures omitted).');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
