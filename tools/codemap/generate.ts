// tools/codemap/generate.ts
import { globby } from 'globby';
import * as fs from 'fs';
import * as path from 'path';

type FileEntry = {
  path: string;
  size: number;
  exports: string[];
  imports: string[];
  symbols: { name: string; kind: 'function'|'class'|'method'; line: number; exported: boolean }[];
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

function parseSymbols(src: string): FileEntry['symbols'] {
  const out: FileEntry['symbols'] = [];
  const lines = src.split(/\r?\n/);
  const push = (name:string, kind:any, line:number, exported:boolean)=>out.push({name, kind, line: line+1, exported});
  lines.forEach((line, i) => {
    const fn = line.match(/^(export\s+)?function\s+([A-Za-z0-9_]+)/);
    if (fn) push(fn[2], 'function', i, !!fn[1]);
    const cls = line.match(/^(export\s+)?class\s+([A-Za-z0-9_]+)/);
    if (cls) push(cls[2], 'class', i, !!cls[1]);
    const mth = line.match(/^\s*([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/);
    if (mth && !line.includes('function') && !line.includes('class')) push(mth[1], 'method', i, false);
  });
  return out;
}

function parseImports(src:string): string[] {
  const set = new Set<string>();
  const re = /import\s+(?:.+?\s+from\s+)?['\"]([^'\"]+)['\"]/g;
  let m; while ((m = re.exec(src))) set.add(m[1]);
  return [...set];
}
function parseExports(src:string): string[] {
  const set = new Set<string>();
  const re = /export\s+(?:const|function|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;
  let m; while ((m = re.exec(src))) set.add(m[1]);
  return [...set];
}

async function main() {
  const files = await globby(rc.include, { ignore: rc.exclude, gitignore: true });
  const entries: FileEntry[] = files.map((p) => {
    const content = readFile(p);
    return {
      path: p,
      size: Buffer.byteLength(content),
      imports: parseImports(content),
      exports: parseExports(content),
      symbols: parseSymbols(content),
    };
  });

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
      const ex = f.exports.length ? ` — exports: ${f.exports.join(', ')}` : '';
      md += `- ${f.path}${ex}\n`;
    }
    md += '\n';
  }
  fs.writeFileSync('CODEMAP.md', md);
  console.log(`Wrote codemap.json and CODEMAP.md for ${entries.length} files.`);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
