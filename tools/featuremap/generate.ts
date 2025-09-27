// tools/featuremap/generate.ts
import globby from 'globby';
import * as fs from 'fs';
import * as path from 'path';

type CMFile = { path: string; exports?: string[]; };

type ModuleInfo = {
  name: string;
  files: string[];
  serverRoutes: { verb: string; route: string; file: string }[];
  wsEvents: { type: 'emit'|'on'; event: string; file: string }[];
  clientComponents: string[];
  dataModels: string[];
  keyExports: { file: string; exports: string[] }[];
};

const read = (p:string) => fs.readFileSync(p, 'utf8');
const exists = (p:string) => fs.existsSync(p);

function tryReadJSON(p:string): any | null {
  try { return JSON.parse(read(p)); } catch { return null; }
}

function detectModuleHeader(src: string): { module?: string; tags?: string[] } {
  const lines = src.split(/\r?\n/, 50);
  let mod: string | undefined;
  let tags: string[] | undefined;
  for (const ln of lines) {
    const m = ln.match(/@module:\s*([A-Za-z0-9._\-\/]+)/);
    if (m) mod = m[1].trim();
    const t = ln.match(/@tags:\s*(.+)/);
    if (t) tags = t[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  return { module: mod, tags };
}

function deriveModuleFromPath(p:string): string {
  const parts = p.split(/[\/\\]+/);
  const idx = parts.findIndex(x => x === 'src');
  if (idx >= 0 && idx + 1 < parts.length) return parts[idx + 1];
  if (parts.includes('server')) return 'server';
  if (parts.includes('client')) return 'client';
  return parts.slice(0,2).join('/');
}

function collectRoutes(src: string, file: string) {
  const routes: { verb: string; route: string; file: string }[] = [];
  const re1 = /\b(app|router)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/g;
  const re2 = /\bcreateRoute\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(src))) routes.push({ verb: m[2].toUpperCase(), route: m[3], file });
  while ((m = re2.exec(src))) routes.push({ verb: m[2].toUpperCase(), route: m[1], file });
  return routes;
}

function collectWs(src: string, file: string) {
  const out: { type:'emit'|'on'; event: string; file: string }[] = [];
  const reEmit = /\.emit\(\s*['"`]([^'"`]+)['"`]/g;
  const reOn = /\.on\(\s*['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = reEmit.exec(src))) out.push({ type:'emit', event:m[1], file });
  while ((m = reOn.exec(src))) out.push({ type:'on', event:m[1], file });
  return out;
}

function looksLikeModelFile(p: string, src: string) {
  if (/schema|model|entity/i.test(p)) return true;
  if (/z\.object|Prisma\./.test(src)) return true;
  return false;
}

async function main() {
  const codemapPath = path.resolve('codemap.json');
  let files: string[] = [];
  let exportsByFile = new Map<string, string[]>();
  if (exists(codemapPath)) {
    const cm = tryReadJSON(codemapPath);
    if (cm && Array.isArray(cm.files)) {
      for (const f of cm.files as CMFile[]) {
        files.push(f.path);
        if (f.exports && f.exports.length) exportsByFile.set(f.path, f.exports);
      }
    }
  }
  if (!files.length) {
    const rcPath = path.resolve('.codemaprc.json');
    const rc = exists(rcPath) ? JSON.parse(read(rcPath)) : {
      include: ['packages/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        '**/node_modules/**','**/dist/**','**/.next/**','**/build/**','**/coverage/**',
        '**/*.d.ts','**/*.test.*','**/*.spec.*'
      ]
    };
    files = await globby(rc.include, { ignore: rc.exclude, gitignore: true });
  }

  const modules = new Map<string, ModuleInfo>();

  for (const f of files) {
    let src = '';
    try { src = read(f); } catch { continue; }

    const header = detectModuleHeader(src);
    const moduleName = (header.module || deriveModuleFromPath(f)).toLowerCase();

    if (!modules.has(moduleName)) modules.set(moduleName, {
      name: moduleName,
      files: [], serverRoutes: [], wsEvents: [], clientComponents: [], dataModels: [], keyExports: []
    });
    const mod = modules.get(moduleName)!;
    mod.files.push(f);

    const ex = exportsByFile.get(f) || [];
    if (ex.length) mod.keyExports.push({ file: f, exports: ex });

    const isServer = /packages\/server\//.test(f);
    const isClient = /packages\/client\//.test(f);

    if (isServer) {
      mod.serverRoutes.push(...collectRoutes(src, f));
      mod.wsEvents.push(...collectWs(src, f));
      if (looksLikeModelFile(f, src)) mod.dataModels.push(f);
    } else if (isClient) {
      if (/export\s+default\s+function|export\s+function|export\s+default\s+class/.test(src)) {
        mod.clientComponents.push(f);
      }
    } else {
      if (looksLikeModelFile(f, src)) mod.dataModels.push(f);
    }
  }

  let md = `# FEATURES\n\n_Last updated: ${new Date().toISOString()}_\n\n`;
  md += `This file is generated from the codebase (module tags, routes, exports) to inventory what exists today. Status and notes may need a quick human touch.\n\n`;

  md += `## Summary\n\n`;
  md += `| Module | Files | Server routes | WS events | Client components | Models |\n`;
  md += `|---|---:|---:|---:|---:|---:|\n`;
  for (const [name, m] of [...modules.entries()].sort()) {
    md += `| ${name} | ${m.files.length} | ${m.serverRoutes.length} | ${m.wsEvents.length} | ${m.clientComponents.length} | ${m.dataModels.length} |\n`;
  }
  md += `\n`;

  for (const [name, m] of [...modules.entries()].sort()) {
    md += `## ${name}\n\n`;
    md += `**Status:** _TBD_\n\n`;
    md += `**Overview:** _short description here_\n\n`;

    if (m.serverRoutes.length) {
      md += `### Server routes\n`;
      for (const r of m.serverRoutes.slice(0, 200)) {
        md += `- \`${r.verb}\` \`${r.route}\` — ${r.file}\n`;
      }
      md += `\n`;
    }

    if (m.wsEvents.length) {
      md += `### WebSocket events\n`;
      for (const e of m.wsEvents.slice(0, 200)) {
        md += `- \`${e.type}\` \`${e.event}\` — ${e.file}\n`;
      }
      md += `\n`;
    }

    if (m.clientComponents.length) {
      md += `### Client components\n`;
      for (const c of m.clientComponents.slice(0, 200)) {
        md += `- ${c}\n`;
      }
      md += `\n`;
    }

    if (m.dataModels.length) {
      md += `### Data models / schemas\n`;
      for (const d of m.dataModels.slice(0, 200)) {
        md += `- ${d}\n`;
      }
      md += `\n`;
    }

    if (m.keyExports.length) {
      md += `### Key exports (from codemap)\n`;
      for (const k of m.keyExports.slice(0, 200)) {
        md += `- ${k.file} — exports: ${k.exports.join(', ')}\n`;
      }
      md += `\n`;
    }

    md += `### Notes / TODO\n- \n\n`;
  }

  const outPath = path.resolve('docs/FEATURES.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`Wrote ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
