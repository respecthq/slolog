import fs from 'node:fs/promises';
import {parse, serializeOuter, serialize} from 'parse5';

// One-time mechanical transfer of the approved mock's markup and static assets.
const root = new URL('../', import.meta.url);
const mock = new URL('mockups/editorial-v2/', root);
const walk = (node, fn) => { fn(node); node.childNodes?.forEach(child => walk(child, fn)); };
const doc = parse(await fs.readFile(new URL('index.html', mock), 'utf8'));
let header, footer, main;
walk(doc, node => {
  if (node.tagName === 'header') header = node;
  if (node.tagName === 'footer') footer = node;
  if (node.tagName === 'main') main = node;
  if (node.nodeName === '#text' && node.value === '気になること。') node.value = 'よくある質問';
});
await fs.writeFile(new URL('index.html', mock), serialize(doc));
function astroMarkup(node, inner=false) {
  const values = [];
  walk(node, item => {
    for (const attr of item.attrs || []) {
      if (!['href','src'].includes(attr.name)) continue;
      let value = attr.value;
      if (value.startsWith('assets/')) value = 'editorial/' + value;
      else if (value.startsWith('#')) value = value === '#' ? '' : value;
      else if (value.endsWith('index.html')) value = value.slice(0, -10);
      else if (value.startsWith('mailto:') || /^https?:/.test(value)) continue;
      const token = `__EDITORIAL_URL_${values.length}__`;
      values.push([token, `{url(${JSON.stringify(value)})}`]);
      attr.value = token;
    }
  });
  let result = inner ? serialize(node) : serializeOuter(node);
  for (const [token, expression] of values) result = result.replace(`"${token}"`, expression);
  return result;
}
await fs.mkdir(new URL('src/components/editorial/', root), {recursive:true});
const prefix = "---\nimport {url} from '../../lib/url';\n---\n";
await fs.writeFile(new URL('src/components/editorial/Header.astro', root), prefix + astroMarkup(header));
await fs.writeFile(new URL('src/components/editorial/Footer.astro', root), prefix + astroMarkup(footer));
await fs.writeFile(new URL('src/pages/index.astro', root), "---\nimport Editorial from '../layouts/Editorial.astro';\nimport {url} from '../lib/url';\n---\n<Editorial title=\"スロログ｜パチスロ収支・立ち回りアプリ\" home>\n" + astroMarkup(main,true) + '\n</Editorial>\n');
await fs.mkdir(new URL('public/editorial/', root), {recursive:true});
await fs.cp(new URL('assets/', mock), new URL('public/editorial/assets/', root), {recursive:true});
for (const name of ['styles.css','pages.css','pages.js']) await fs.copyFile(new URL(name,mock),new URL('public/editorial/'+name,root));
const client = await fs.readFile(new URL('app.js',mock),'utf8');
const adapted = "const asset = name => new URL('./assets/' + name, import.meta.url).href;\n" + client
  .replace('`assets/${tab.dataset.feature}.webp`', 'asset(`${tab.dataset.feature}.webp`)')
  .replaceAll("'assets/menu.svg'", "asset('menu.svg')")
  .replaceAll("'assets/x.svg'", "asset('x.svg')");
await fs.writeFile(new URL('public/editorial/app.js',root),adapted);
console.log('Transferred native Astro markup and self-contained public assets. JSON routes untouched.');
