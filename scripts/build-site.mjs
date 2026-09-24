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
const MODULES = ['web/lib/chem.js', 'web/lib/flavor.js', 'web/lib/prompt.js', 'web/lib/format.js', 'web/lib/names.js', 'web/lib/markdown.js', 'web/lib/engine.js', 'web/app.js'];
function bundle() {
  const parts = ['const __m = {};'];
  for (const file of MODULES) {
    let src = read(file);
    const key = basename(file, '.js');
    const exported = [];
    src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*['"](?:\.\.?\/)+(?:lib\/)?([\w-]+)\.js['"];?\s*$/gm, (_, names, mod) => `const {${names}} = __m['${mod}'];`);
    src = src.replace(/^export\s+(async\s+)?function\s+(\w+)/gm, (_, a, name) => { exported.push(name); return `${a || ''}function ${name}`; });
    src = src.replace(/^export\s+(const|let)\s+(\w+)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
    src = src.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_, names) => { exported.push(...names.split(',').map(s => s.trim()).filter(Boolean)); return ''; });
    if (/^\s*(import|export)\s/m.test(src)) throw new Error(`unbundled import/export left in ${file}`);
    parts.push(`__m['${key}'] = (() => {\n${src}\nreturn { ${[...new Set(exported)].join(', ')} };\n})();`);
  }
  return parts.join('\n');
}

const data = {
  vocab: readJson('data/ingredients.json'),
  families: readJson('data/families.json'),
  drinks: readJson('data/drinks.json'),
  model: readJson('data/model.json'),
  timeline: existsSync(join(root, 'docs/timeline.json')) ? readJson('docs/timeline.json') : [],
  docs: {
    history: markdownToHtml(maybe('docs/history.md', '')),
    concepts: markdownToHtml(maybe('docs/concepts.md', '')),
    methodology: markdownToHtml(maybe('docs/methodology.md', '')),
  },
};
const json = JSON.stringify(data).replace(/<\//g, '<\\/').replace(/[\u2028\u2029]/g, c => (c === '\u2028' ? '\\u2028' : '\\u2029'));

const html = read('web/index.html');
const between = (tag) => {
  const m = html.match(new RegExp(`<!--BUILD:${tag}-->([\\s\\S]*?)<!--/BUILD:${tag}-->`));
  if (!m) throw new Error(`missing BUILD:${tag}`);
  return m[1];
};
const css = read('web/styles.css');
const head = between('HEAD').replace(/<link rel="stylesheet" href="\.\/styles\.css">/, `<style>\n${css}\n</style>`);
const body = between('BODY');
const script = `<script>window.__TIKI_DATA__ = ${json};</script>\n<script type="module">\n${bundle()}\n</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });
const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`;
writeFileSync(join(root, 'dist/index.html'), full);
writeFileSync(join(root, 'dist/tiki-god.fragment.html'), `${head}\n${body}\n${script}\n`);
console.log(`dist/index.html ${(full.length / 1024).toFixed(0)} KB (${data.drinks.length} drinks)`);
