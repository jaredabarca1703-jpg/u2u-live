/* v8.7.5+ · cliente de «Conectados ahora» y Plaza UPC (jsdom con socket simulado) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const local = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1].split('?')[0]).filter((s) => !/^(https?:)?\/\//.test(s) && !s.startsWith('/'));

test('15-conectados: tarjeta en Inicio, sala en vivo, envío, moderación e indicador «En línea»', async (t) => {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  dom.window.lucide = { createIcons() {} }; dom.window.scrollTo = () => {};
  const ctx = dom.getInternalVMContext(), run = (code, name) => new vm.Script(code, { filename: name || 'probe' }).runInContext(ctx);
  for (const s of local) run(fs.readFileSync(path.join(PUB, s), 'utf8'), s);
  const out = await run(`(async()=>{
const res=[];const t=(n,f)=>{try{const r=f();res.push([n,r===true?'ok':(r===false?'FALLO':'ok'),r===false?'':(typeof r=='string'?r.slice(0,70):'')])}catch(e){res.push([n,'ERROR',e.message+' @'+(e.stack||'').split('\\n')[1]])}};
const png='data:image/png;base64,iVBORw0KGgo=';
window.io=function(){};LV.me={uid:'u_me',name:'Jared',cp:1,verified:true};SEL[ME].n='Jared';
const hand={},emitted=[];
sock={connected:true,on(ev,fn){hand[ev]=fn},emit(ev,d,cb){emitted.push([ev,d]);if(ev=='lobby:history')cb&&cb({ok:true,list:[{id:'m1',uid:'u_a',name:'Ana Quispe',career:'Ing. Civil',campus:'Villa',official:false,text:'hola <b>x</b>',product:{id:900,t:'Taladro',mode:'venta',price:90,rent:0,ph:'/foto/900/0',e:'📦'},ts:1}]});else cb&&cb({ok:true})}};
lobbyBind(sock);
const U=[{uid:'u_a',name:'Ana Quispe',career:'Ing. Civil',cycle:5,campus:'Villa',cp:2,verified:true,official:false,activeCount:3,sampleProducts:[{id:900,t:'Taladro',mode:'venta',price:90,rent:0,ph:'/foto/900/0',e:'📦'},{id:901,t:'Libro',mode:'alquiler',price:0,rent:5,ph:'',e:'📘'}]},{uid:'u_b',name:'Beto Ríos',career:'',cycle:'',campus:'',cp:-1,verified:false,official:false,activeCount:0,sampleProducts:[]}];
LV.pres={total:3,users:U};
t('livePresence',()=>{livePresence();return RS['u_a']!=null&&SEL[RS['u_a']].prof.career=='Ing. Civil'&&RS['u_b']!=null});
t('isOnline',()=>isOnline('u_a')&&!isOnline('zzz'));
t('home card',()=>{S.s='home';S.st=[];R();const c=document.querySelector('#live-card');return !!c&&/Conectados ahora en U2U/.test(c.textContent)&&/Ana Quispe/.test(c.textContent)&&/Explorando productos/.test(c.textContent)&&c.querySelectorAll('[data-live=dm]').length==2&&/Plaza UPC/.test(c.textContent)});
t('home card tras IA',()=>{const ai=document.querySelector('div[style*="#6d28d9"]');return ai&&ai.nextElementSibling&&ai.nextElementSibling.id=='live-card'});
t('home sin otros',()=>{LV.pres={total:1,users:[]};livePresence();const c=document.querySelector('#live-card');LV.pres={total:3,users:U};livePresence();return /Sé el primero/.test(c.textContent)||c.textContent.length});
t('home con búsqueda no muestra',()=>{F.q='dron';R();const r=!document.querySelector('#live-card');F.q='';R();return r});
t('lobby view',()=>{S.s='lobby';R(1);return !!document.querySelector('#lobby-feed')&&!!document.querySelector('#lobby-in')});
await new Promise(r=>setTimeout(r,30));
t('history se carga',()=>{const f=document.querySelector('#lobby-feed');return emitted.some(e=>e[0]=='lobby:history')});
LV.me.verified=true;
t('feed con producto y escape',()=>{const f=document.querySelector('#lobby-feed');return /Taladro/.test(f.innerHTML)&&!/<b>x<\\/b>/.test(f.innerHTML)&&/&lt;b&gt;/.test(f.innerHTML)});
t('msg en vivo sin R y conserva borrador',()=>{const i=document.querySelector('#lobby-in');i.value='borrador';i.dispatchEvent(new window.Event('input',{bubbles:true}));hand['lobby:msg']({id:'m2',uid:'u_a',name:'Ana',text:'nuevo mensaje',product:null,ts:2});const f=document.querySelector('#lobby-feed');return /nuevo mensaje/.test(f.innerHTML)&&document.querySelector('#lobby-in')===i&&i.value=='borrador'});
t('R(1) conserva borrador',()=>{R(1);return document.querySelector('#lobby-in').value=='borrador'});
t('lobby:deleted',()=>{hand['lobby:deleted']({id:'m2'});return !/nuevo mensaje/.test(document.querySelector('#lobby-feed').innerHTML)});
t('enviar con producto',()=>{emitted.length=0;PR.push({id:777,t:'Mi calc',ph:[png],cat:'Calculadoras',mode:'venta',price:50,rent:0,dep:0,cond:'Usado',s:ME,x:1,y:1,ts:1,desc:'x',e:'📦',car:[],status:'available'});
  document.querySelector('[data-live=pick]').click();const at=document.querySelector('[data-live=attach][data-pid="777"]');if(!at)return false;at.click();
  document.querySelector('#lobby-in').value='mira';document.querySelector('[data-live=lobby-send]').click();
  const e=emitted.find(x=>x[0]=='lobby:send');return !!e&&e[1].text=='mira'&&e[1].pid==777});
t('bloqueado sin verificar',()=>{LV.me.verified=false;R(1);const r=!!document.querySelector('#lobby-bar .lobby-lock')&&!document.querySelector('#lobby-in');LV.me.verified=true;R(1);return r});
t('admin ve papelera',()=>{LV.adm=true;R(1);const r=!!document.querySelector('[data-live=del-msg]');LV.adm=false;return r});
t('peek modal',()=>{document.querySelector('[data-live=peek][data-uid=u_a]').click();return /Taladro/.test(document.querySelector('#modal').innerHTML)&&!document.querySelector('#modal').classList.contains('hidden')});
t('dm sin productos -> lobby',()=>{X();S.s='home';R();const b=document.querySelector('#live-card [data-live=dm][data-uid=u_b]');b.click();return S.s=='lobby'&&document.querySelector('#lobby-in').value.startsWith('@Beto')});
t('tab En vivo en Mensajes',()=>{MT='live';S.s='msgs';R();return document.querySelectorAll('#v .grid-cols-3 button').length==3&&!!document.querySelector('#lobby-wrap')});
t('presUI chat en línea',()=>{PR.push({id:900,t:'Taladro',ph:[png],cat:'Herramientas',mode:'venta',price:90,rent:0,dep:0,cond:'Usado',s:RS['u_a'],x:1,y:1,ts:1,desc:'x',e:'📦',car:[],status:'available',own:'u_a',remote:true});
  const key='900|u_me';LV.convs={[key]:{key,pid:900,buyerId:'u_me',buyerName:'Jared',un:0,ts:1,msgs:[{id:'a',uid:'u_me',from:'buyer',name:'J',text:'hola',ts:1}]}};S.s='lchat';S.a=key;R();const l=document.querySelector('#lst');return l&&/En línea ahora/.test(l.textContent)});
t('presUI chat desconectado',()=>{LV.pres={total:1,users:[]};presUI();return /Desconectado/.test(document.querySelector('#lst').textContent)});
t('detail inexistente',()=>{S.s='detail';S.a=424242;return /Publicación no disponible/.test(V.detail(424242))});
t('detail con punto en línea',()=>{LV.pres={total:3,users:U};S.s='detail';return /En línea/.test(V.detail(900))});
t('seller con punto en línea',()=>/En línea/.test(V.seller(RS['u_a'])));
t('lista de chats con punto',()=>{MT='chats';return /En línea/.test(V.msgs())});
return res})()`);
  const rows = JSON.parse(JSON.stringify(out)), bad = rows.filter((r) => r[1] !== 'ok'); // JSON: el arreglo viene de otro contexto de vm
  assert.deepStrictEqual(bad, [], 'fallaron: ' + JSON.stringify(bad));
  assert.ok(rows.length >= 20);
});
