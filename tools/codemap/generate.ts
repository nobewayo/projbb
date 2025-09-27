// tools/codemap/generate.ts
import globby from 'globby';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import ts from 'typescript';

type FunctionSym = { name: string; line: number; exported: boolean; signature?: string };
type ClassSym = { name: string; line: number; exported: boolean };
type MethodSym = { name: string; line: number; ofClass?: string };

type FileEntry = {
  path: string;
  size: number;
  checksum: string;
  tags: string[];
  imports: string[];
  namedExports: string[];
  symbols: {
    functions: FunctionSym[];
    classes: ClassSym[];
    methods: MethodSym[];
  };
};

const rcPath = path.resolve('.codemaprc.json');
const rc = fs.existsSync(rcPath) ? JSON.parse(fs.readFileSync(rcPath, 'utf8')) : {
  include: ['packages/**/*.{ts,tsx,js,jsx}'],
  exclude: [
    '**/node_modules/**','**/dist/**','**/.next/**','**/build/**','**/coverage/**',
    '**/*.d.ts','**/*.test.*','**/*.spec.*'
  ],
};

const readFile = (p:string) => fs.readFileSync(p, 'utf8');
const sha256 = (s:string) => crypto.createHash('sha256').update(s).digest('hex');

function parseHeaderTags(src: string): { tags: string[] } {
  const tags: string[] = [];
  const lines = src.split(/\r?\n/).slice(0, 50);
  for (const ln of lines) {
    const t = ln.match(/@tags:\s*(.+)/);
    if (t) tags.push(...t[1].split(',').map(s=>s.trim()).filter(Boolean));
  }
  return { tags: Array.from(new Set(tags)) };
}

function getScriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.ts')) return ts.ScriptKind.TS;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function hasExportModifier(n: ts.Node): boolean {
  return !!(n as any).modifiers?.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function getLine(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function getSignature(sf: ts.SourceFile, node: ts.FunctionLikeDeclarationBase): string | undefined {
  try {
    const text = node.getText(sf);
    const brace = text.indexOf('{');
    return (brace > 0 ? text.slice(0, brace) : text).replace(/\s+/g, ' ').trim();
  } catch { return undefined; }
}

function collect(file: string, src: string): FileEntry {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, getScriptKind(file));

  const imports = new Set<string>();
  const namedExports = new Set<string>();
  const functions: FunctionSym[] = [];
  const classes: ClassSym[] = [];
  const methods: MethodSym[] = [];

  function visit(node: ts.Node) {
    // Imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const mod = (node.moduleSpecifier as ts.StringLiteral).text;
      if (mod) imports.add(mod);
    }

    // Export declarations like: export { A, B } from './x'
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const e of node.exportClause.elements) {
        namedExports.add(e.name.text);
      }
    }

    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push({
        name: node.name.text,
        line: getLine(sf, node),
        exported: hasExportModifier(node),
        signature: getSignature(sf, node)
      });
    }

    // Variable statements with function/arrow initializers
    if (ts.isVariableStatement(node)) {
      const isExported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer &&
           (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer))) {
          functions.push({
            name: decl.name.text,
            line: getLine(sf, decl),
            exported: isExported,
            signature: getSignature(sf, decl.initializer as any)
          });
        }
      }
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      classes.push({
        name: node.name.text,
        line: getLine(sf, node),
        exported: hasExportModifier(node)
      });
      // Visit members for methods
      for (const m of node.members) {
        if (ts.isMethodDeclaration(m) && m.name && ts.isIdentifier(m.name)) {
          methods.push({
            name: m.name.text,
            line: getLine(sf, m),
            ofClass: node.name.text
          });
        }
        if (ts.isConstructorDeclaration(m)) {
          methods.push({
            name: 'constructor',
            line: getLine(sf, m),
            ofClass: node.name.text
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  // Also treat exported names as namedExports
  for (const f of functions) if (f.exported) namedExports.add(f.name);
  for (const c of classes) if (c.exported) namedExports.add(c.name);

  const { tags } = parseHeaderTags(src);

  return {
    path: file,
    size: Buffer.byteLength(src),
    checksum: sha256(src),
    tags,
    imports: Array.from(imports),
    namedExports: Array.from(namedExports),
    symbols: { functions, classes, methods }
  };
}

async function main() {
  const files = await globby(rc.include, { ignore: rc.exclude, gitignore: true });
  const entries: FileEntry[] = [];
  for (const p of files) {
    try {
      const content = readFile(p);
      entries.push(collect(p, content));
    } catch {}
  }

  fs.writeFileSync('codemap.json', JSON.stringify({ generatedAt: new Date().toISOString(), count: entries.length, files: entries }, null, 2));

  const byDir = new Map<string, FileEntry[]>();
  for (const e of entries) {
    const dir = path.dirname(e.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(e);
  }
  let md = `# CODEMAP\n\nTotal files: ${entries.length}\n\n`;
  for (const [dir, list] of [...byDir.entries()].sort()) {
    md += `## ${dir}\n\n`;
    for (const f of list) {
      const ex = f.namedExports.length ? ` — exports: ${f.namedExports.join(', ')}` : '';
      md += `- ${f.path}${ex}\n`
    }
    md += '\n';
  }
  fs.writeFileSync('CODEMAP.md', md);
  console.log(`Wrote codemap.json and CODEMAP.md for ${entries.length} files.`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
