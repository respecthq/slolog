import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {PRIVACY,TERMS} from '../src/lib/legal.ts';

const root=path.resolve(import.meta.dirname,'..');
const dist=path.resolve(root,process.argv[2]||'dist');
const baseline=process.argv[3];
const base=process.env.SITE_BASE||'/slolog/';
const basePath=base.replace(/\/$/,'')+'/';
const origin='https://respecthq.github.io';
const walk=(node,fn)=>{fn(node);node.childNodes?.forEach(n=>walk(n,fn));};
const attr=(node,key)=>node.attrs?.find(a=>a.name===key)?.value;
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const normalized=value=>value.replace(/\s+/g,' ').trim();
async function files(dir) {
  const result=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...await files(full));else result.push(full);
  }
  return result;
}
const all=await files(dist);
const isPublicJson=file=>/^(machines|pickup)\.json$|^machines\/[^/]+\.json$/.test(file);
const jsonFiles=all.map(file=>path.relative(dist,file)).filter(isPublicJson);
if(baseline) {
  const old=(await files(baseline)).map(file=>path.relative(baseline,file)).filter(isPublicJson);
  assert.deepEqual(jsonFiles.toSorted(),old.toSorted(),'JSON route set changed');
  for(const file of jsonFiles)assert.deepEqual(await fs.readFile(path.join(dist,file)),await fs.readFile(path.join(baseline,file)),`JSON bytes changed: ${file}`);
}
const documents=new Map();
for(const file of all.filter(f=>f.endsWith('.html')))documents.set(path.relative(dist,file),parse(await fs.readFile(file,'utf8')));
let links=0;
for(const [file,doc] of documents) {
  const current=new URL(basePath+file,origin);
  const refs=[];
  walk(doc,node=>{
    for(const key of ['href','src']) {
      const value=attr(node,key);
      if(value && !(node.tagName==='link' && attr(node,'rel')==='canonical'))refs.push(new URL(value,current));
    }
  });
  for(const ref of refs) {
    if(ref.origin!==origin)continue;
    assert(ref.pathname.startsWith(basePath),`Outside base: ${ref.href} in ${file}`);
    let target=decodeURIComponent(ref.pathname.slice(basePath.length))||'index.html';
    if(target.endsWith('/'))target+='index.html';
    if(!path.extname(target))target+='/index.html';
    await fs.access(path.join(dist,target));links++;
    if(ref.hash&&documents.has(target)) {
      let found=false;
      walk(documents.get(target),node=>{if(attr(node,'id')===decodeURIComponent(ref.hash.slice(1)))found=true;});
      assert(found,`Missing anchor: ${ref.href} in ${file}`);
    }
  }
  let payload;
  walk(doc,node=>{if(attr(node,'id')==='machine-spec')payload=text(node);});
  if(file.startsWith('machines/')&&file!=='machines/index.html') {
    const id=file.split('/')[1];
    const dataFile=path.join(dist,'machines',id+'.json');
    const exists=jsonFiles.includes(`machines/${id}.json`);
    if(exists)assert.equal(payload,await fs.readFile(dataFile,'utf8'),`Copy payload differs from JSON: ${id}`);
    else assert(!payload,'Fictional machine should use the bundled sample');
  }
}
const machines=JSON.parse(await fs.readFile(path.join(dist,'machines.json'),'utf8'));
assert(machines.length>0,'Machine feed must not be empty');
let release;
walk(documents.get('machines/index.html'),n=>{if(attr(n,'class')==='release-list')release=n;});
assert(release);
const ids=[];
walk(release,n=>{if(n.tagName==='a')ids.push(attr(n,'href'));});
assert.deepEqual(ids.toSorted(),machines.map(m=>`${basePath}machines/${m.id}/`).toSorted());
for(const [name,source] of [['privacy',PRIVACY],['terms',TERMS]]) {
  let article;
  walk(documents.get(name+'/index.html'),n=>{if(attr(n,'class')==='legal-text')article=n;});
  const blocks=article.childNodes.filter(n=>['h2','p'].includes(n.tagName)).map(n=>normalized(text(n)));
  assert.deepEqual(blocks,source.trim().split('\n\n').map(b=>normalized(b.replace(/^■ /,''))));
}
let faq,stage;
walk(documents.get('index.html'),n=>{if(attr(n,'id')==='faq')faq=n;if(attr(n,'class')==='stage-label')stage=n;});
assert.match(text(faq),/よくある質問/);
assert(!text(faq).includes('気になること。'));
assert.match(text(stage),/YOUR PLAY\.YOUR RECORD\.powered by 回胴キナナ/);
assert.match(await fs.readFile(path.join(dist,'editorial/styles.css'),'utf8'),/\.stage-label\{color:#fff\}/);
assert(!all.some(f=>f.includes('mockups/')),'Production build must be independent of mock files');
console.log(`PASS: ${documents.size} pages, ${links} local references, ${machines.length} exact copy payloads, release list, legal parity, requested copy and color.`);
console.log(baseline?`PASS: all ${jsonFiles.length} JSON files byte-for-byte unchanged.`:'JSON parity requires a baseline directory argument.');
