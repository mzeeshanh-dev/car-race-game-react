// Original project-authored stylized vehicles. No downloaded proprietary geometry.
import fs from 'node:fs';
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const mat = (name, color, metalness = 0, roughness = 0.5) => Object.assign(new T.MeshStandardMaterial({ color, metalness, roughness }), { name });
const paint = mat('paint', '#d82335', 0.65, 0.26), carbon = mat('carbon', '#151922', 0.15, 0.65);
const glass = mat('glass', '#132231', 0.65, 0.12), chrome = mat('chrome', '#bcc8d8', 0.9, 0.22);
const rubber = mat('rubber', '#101114', 0, 0.94), head = mat('headlight', '#ebf5ff'), tail = mat('taillight', '#bd0e22');
head.emissive.set('#d9efff'); head.emissiveIntensity = 0.5; tail.emissive.set('#ff1524');
function mesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new T.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m;
}
function box(p, size, material, pos, rot) { return mesh(p, new T.BoxGeometry(...size), material, pos, rot); }
function ellipsoid(p, scale, material, pos) { const m = mesh(p, new T.SphereGeometry(1, 16, 10), material, pos); m.scale.set(...scale); return m; }
function rod(p, a, b, radius, material) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b), d = to.clone().sub(from);
  const m = mesh(p, new T.CylinderGeometry(radius, radius, d.length(), 10), material);
  m.position.copy(from.add(to).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m;
}
// Continuous shaped body surface. Each station is [z, half width, lower Y, upper Y].
function loft(p, stations, material) {
  const vertices = [], indices = [];
  for (const [z, w, lo, hi] of stations) {
    for (const [x, y] of [[-w * .82, lo], [-w, lo + (hi-lo)*.3], [-w*.94, hi-.035], [-w*.68, hi], [w*.68, hi], [w*.94, hi-.035], [w,lo+(hi-lo)*.3], [w*.82,lo]]) vertices.push(x,y,z);
  }
  for(let j=0;j<stations.length-1;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
  for(let i=1;i<7;i++){indices.push(0,i+1,i);const n=(stations.length-1)*8;indices.push(n,n+i,n+i+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(p,g,material);
}
function wheel(parent, index, x, z, radius, width, bike=false) {
  const root = new T.Group(); root.name=`wheel-${index}`;root.position.set(x,bike?-.4:-.44,z);parent.add(root);
  mesh(root,new T.TorusGeometry(radius-width*.45,width*.45,8,32),rubber,[0,0,0],[0,Math.PI/2,0]);
  mesh(root,new T.CylinderGeometry(radius*.72,radius*.72,width*.6,24),carbon,[0,0,0],[0,0,Math.PI/2]);
  for(const side of [-1,1]){
    mesh(root,new T.TorusGeometry(radius*.69,.018,6,24),chrome,[side*width*.33,0,0],[0,Math.PI/2,0]);
    mesh(root,new T.CylinderGeometry(radius*.43,radius*.43,.012,20),chrome,[side*width*.23,0,0],[0,0,Math.PI/2]);
    for(let i=0;i<7;i++)box(root,[.025,radius*1.2,.024],chrome,[side*width*.34,0,0],[i*Math.PI/7,0,0]);
  }
  return root;
}
function car(kind) {
  const g=new T.Group();const body=new T.Group();body.name='body';g.add(body);
  const gt=kind==='mercedes-gt';
  loft(body,gt?[[-2.28,.68,-.25,.01],[-2.1,.94,-.25,.1],[-1.3,.97,-.25,.24],[-.35,.91,-.25,.28],[.65,.95,-.25,.23],[1.4,.99,-.25,.19],[2.15,.9,-.2,.12],[2.28,.72,-.16,.06]]:[[-2.1,.72,-.26,-.03],[-1.6,.95,-.26,.08],[-.7,.91,-.26,.2],[.3,.92,-.26,.24],[1.3,.97,-.26,.2],[2.1,.85,-.2,.08]],paint);
  loft(body,[[-.64,.69,.19,.24],[-.13,.67,.22,.65],[.65,.66,.2,.67],[1.24,.7,.15,.24]],glass);
  loft(body,[[-.14,.67,.64,.68],[.6,.66,.65,.7],[.78,.65,.57,.61]],paint);
  for(const side of [-1,1]) {
    rod(body,[side*.7,.22,-.62],[side*.66,.65,-.12],.025,chrome);
    rod(body,[side*.66,.66,.65],[side*.71,.2,1.23],.035,paint);
    ellipsoid(body,[.14,.06,.09],paint,[side*1.02,.27,-.3]);
    box(body,[.04,.07,3.3],carbon,[side*.95,-.22,0]);
    box(body,[.44,.045,.08],head,[side*.65,.07,gt?-2.12:-1.98],[0,side*.12,0]);
    box(body,[.54,.045,.06],tail,[side*.57,.11,gt?2.23:2.05]);
    mesh(body,new T.CylinderGeometry(.07,.07,.2,12),chrome,[side*.68,-.16,2.18],[Math.PI/2,0,0]);
  }
  box(body,[1.78,.055,.22],carbon,[0,-.25,gt?-2.21:-2.02]);
  box(body,[1.05,.23,.06],carbon,[0,-.04,gt?-2.25:-2.09]);
  if(gt) {
    for(let x=-.47;x<.5;x+=.09) box(body,[.014,.19,.035],chrome,[x,-.04,-2.29]);
    mesh(body,new T.TorusGeometry(.092,.009,6,24),chrome,[0,-.025,-2.32]);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(body,[0,-.025,-2.33],[Math.sin(a)*.084,-.025+Math.cos(a)*.084,-2.33],.008,chrome);}
  } else {
    for(const side of [-1,1]){box(body,[.08,.25,.12],carbon,[side*.65,.33,1.8]);box(body,[.3,.12,.55],carbon,[side*.83,.04,.95]);}
    box(body,[1.85,.065,.35],carbon,[0,.48,1.83]);
  }
  [[-.86,-1.3],[.86,-1.3],[-.86,1.3],[.86,1.3]].forEach(([x,z],i)=>wheel(g,i,x,z,.34,.26));return g;
}
function superbike() {
  const g=new T.Group(), b=new T.Group();b.name='body';g.add(b);
  loft(b,[[-.96,.12,-.04,.24],[-.69,.3,-.25,.39],[-.25,.28,-.3,.3],[.12,.2,-.25,.28],[.43,.18,.12,.32],[.9,.12,.25,.35]],paint);
  loft(b,[[-.55,.16,.32,.47],[-.3,.19,.4,.54],[-.02,.18,.38,.5],[.2,.12,.28,.34]],paint);
  loft(b,[[-.86,.12,.27,.31],[-.67,.2,.35,.61],[-.47,.18,.39,.68]],glass);
  box(b,[.31,.07,.45],carbon,[0,.35,.4]);
  ellipsoid(b,[.2,.2,.25],carbon,[0,-.05,0]);
  for(const side of [-1,1]){
    rod(b,[side*.09,.35,-.55],[side*.09,-.4,-.72],.032,chrome);
    rod(b,[side*.09,-.15,.08],[side*.09,-.4,.72],.045,carbon);
    rod(b,[side*.26,.43,-.42],[side*.1,.42,-.48],.025,carbon);
    rod(b,[side*.23,-.14,.35],[side*.28,-.1,.72],.055,chrome);
    box(b,[.16,.045,.035],head,[side*.145,.24,-.83],[0,side*.3,0]);
    rod(b,[side*.22,.48,-.55],[side*.35,.57,-.59],.012,chrome);
    ellipsoid(b,[.075,.035,.04],carbon,[side*.36,.58,-.59]);
  }
  box(b,[.19,.04,.04],tail,[0,.3,.91]);
  // Original suited rider, tucked over the tank, included with the physical chassis visual.
  const suit=mat('suit','#242a34',.05,.7);
  ellipsoid(b,[.18,.15,.18],suit,[0,.55,.4]);
  rod(b,[0,.58,.35],[0,.91,-.07],.16,suit);
  ellipsoid(b,[.145,.16,.18],paint,[0,1.08,-.24]);
  ellipsoid(b,[.128,.07,.05],glass,[0,1.1,-.397]);
  for(const side of [-1,1]) {
    rod(b,[side*.14,.54,.38],[side*.26,.06,.15],.075,suit);
    rod(b,[side*.26,.06,.15],[side*.17,-.12,.42],.055,suit);
    box(b,[.12,.08,.23],carbon,[side*.17,-.15,.36]);
    rod(b,[side*.16,.85,-.06],[side*.28,.62,-.23],.055,suit);
    rod(b,[side*.28,.62,-.23],[side*.25,.43,-.42],.045,suit);
  }
  wheel(g,0,0,-.72,.32,.16,true);wheel(g,1,0,.72,.32,.19,true);return g;
}
// Batch by material per articulated part; keep wheel pivots intact.
function batch(root) {
  for(const part of [...root.children]) {
    part.updateMatrixWorld(true);const groups=new Map();
    const inverse=part.matrixWorld.clone().invert();
    part.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)).toNonIndexed();g.deleteAttribute('uv');g.deleteAttribute('normal');g.computeVertexNormals();if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
    part.clear();for(const [m, geos] of groups)mesh(part,mergeGeometries(geos),m);
  }
}
fs.mkdirSync('public/models',{recursive:true});
for(const [name,model] of [['mercedes-gt',car('mercedes-gt')],['vortex',car('vortex')],['superbike',superbike()]]) {
  batch(model);const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  fs.writeFileSync(`public/models/${name}.glb`,Buffer.from(data));console.log(name, data.byteLength);
}
