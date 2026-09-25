#!/usr/bin/env node
// Bundle the web app + data into one self-contained HTML file.
//   dist/index.html              full document (open directly, or host anywhere)
//   dist/tiki-god.fragment.html  same page without <html>/<head>/<body> (for hosts that supply the skeleton)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from '../web/lib/markdown.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const readJson = p => JSON.parse(read(p));
const maybe = (p, fallback) => (existsSync(join(root, p)) ? read(p) : fallback);

// Tiny module bundler for our own ES modules (named imports/exports only).
const LIB = ['web/lib/chem.js', 'web/lib/flavor.js', 'web/lib/prompt.js', 'web/lib/format.js', 'web/lib/names.js', 'web/lib/engine.js'];
function bundle(modules) {
  const parts = ['const __m = {};'];
  for (const file of modules) {
    let src = read(file);
    const key = basename(file, '.js');
    const exported = [];
    src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*['"](?:\.\.?\/)+(?:lib\/)?([\w-]+)\.js['"];?\s*$/gm, (_, names, mod) => `const {${names}} = __m['${mod}'];`);
    src = src.replace(/^export\s+(async\s+)?function\s+(\w+)/gm, (_, a, name) => { exported.push(name); return `${a || ''}function ${name}`; });
    src = src.replace(/^export\s+(const|let)\s+(\w+)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
    src = src.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_, names) => { exported.push(...names.split(',').map(x => x.trim()).filter(Boolean)); return ''; });
    if (/^\s*(import|export)\s/m.test(src)) throw new Error(`unbundled import/export left in ${file}`);
    parts.push(`__m['${key}'] = (() => {\n${src}\nreturn { ${[...new Set(exported)].join(', ')} };\n})();`);
  }
  return parts.join('\n');
}

const core = {
  vocab: readJson('data/ingredients.json'),
  families: readJson('data/families.json'),
  drinks: readJson('data/drinks.json'),
  model: readJson('data/model.json'),
};
const full = {
  ...core,
  timeline: existsSync(join(root, 'docs/timeline.json')) ? readJson('docs/timeline.json') : [],
  docs: {
    history: markdownToHtml(maybe('docs/history.md', '')),
    concepts: markdownToHtml(maybe('docs/concepts.md', '')),
    methodology: markdownToHtml(maybe('docs/methodology.md', '')),
  },
};
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const toJson = d => JSON.stringify(d).replace(/<\//g, '<\\/').split(LS).join('\\u2028').split(PS).join('\\u2029');

const PAGES = [
  { html: 'web/index.html', css: 'web/styles.css', cssLink: './styles.css', modules: [...LIB, 'web/lib/markdown.js', 'web/app.js'], data: full, out: 'index' },
  { html: 'web/shrine.html', css: 'web/shrine.css', cssLink: './shrine.css', modules: [...LIB, 'web/lib/ink.js', 'web/lib/artcatalog.js', 'web/lib/artspec.js', 'web/lib/artrender.js', 'web/shrine.js'], data: core, out: 'shrine' },
];

mkdirSync(join(root, 'dist'), { recursive: true });
for (const page of PAGES) {
  const html = read(page.html);
  const between = tag => {
    const m = html.match(new RegExp(`<!--BUILD:${tag}-->([\\s\\S]*?)<!--/BUILD:${tag}-->`));
    if (!m) throw new Error(`${page.html}: missing BUILD:${tag}`);
    return m[1];
  };
  const head = between('HEAD').replace(`<link rel="stylesheet" href="${page.cssLink}">`, `<style>\n${read(page.css)}\n</style>`);
  const body = between('BODY');
  const script = `<script>window.__TIKI_DATA__ = ${toJson(page.data)};</script>\n<script type="module">\n${bundle(page.modules)}\n</script>`;
  const doc = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`;
  writeFileSync(join(root, `dist/${page.out}.html`), doc);
  writeFileSync(join(root, `dist/${page.out === 'index' ? 'tiki-god' : page.out}.fragment.html`), `${head}\n${body}\n${script}\n`);
  console.log(`dist/${page.out}.html ${(doc.length / 1024).toFixed(0)} KB (${page.data.drinks.length} drinks)`);
}
