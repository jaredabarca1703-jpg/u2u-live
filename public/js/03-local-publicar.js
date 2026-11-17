/* =================== LÓGICA =================== */
function noConn(){return `<div class="px-7 pt-14 pb-8 text-center"><img src="${IM.logo}" alt="U2U" class="w-48 mx-auto"><h1 class="text-xl font-extrabold text-navy mt-7">No se pudo conectar con U2U. Revisa tu conexión.</h1><button class="btn mt-6" onclick="location.reload()">Reintentar</button></div>`}
function dots(){const c=$('#car'),d=$('#dots');if(!c||!d)return;const i=Math.round(c.scrollLeft/c.clientWidth);d.innerHTML=[...c.children].map((_,n)=>`<span class="w-2 h-2 rounded-full ${n==i?'bg-white':'bg-white/50'}"></span>`).join('')}
function sh(){const s=$('#sheet');s.dataset.o=s.dataset.o=='1'?'':'1';s.style.transform=s.dataset.o?'translateY(0)':'translateY(calc(100% - 230px))'}
/* Buscador inteligente: sin tildes, sinónimos universitarios y tolerancia a errores */
const nrmStr=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const SYN_DICT=[
 {t:/^cam(a|ar|ra)?$/,w:['camara','camera','fotografia','dron']},
 {t:/^calc(u|ul|ula)?$/,w:['calculadora','hpprime','casio']},
 {t:/^lap(t|to)?$/,w:['laptop','macbook','computadora']},
 {t:/^tab(l|le)?$/,w:['tablet','ipad','wacom']},
 {t:/^drom?$/,w:['dron','dji']},
 {t:/^mand(i)?$/,w:['mandil','scrub','laboratorio']},
 {t:/^esca(l)?$/,w:['escalimetro','regla']},
 {t:/^libr?$/,w:['libro','libros','apuntes']},
 {t:/^casc?$/,w:['casco','seguridad','epp']},
 {t:/^trip?$/,w:['tripode','soporte']},
 {t:/^cel(u)?$/,w:['celular','iphone']}
];
function smartMatch(p,q){
 if(!q||!q.trim())return true;
 const tokens=nrmStr(q).split(/\s+/).filter(Boolean);
 if(!tokens.length)return true;
 const full=nrmStr((p.t||'')+' '+(p.desc||'')+' '+(p.cat||'')+' '+((p.tags||[]).join(' ')));
 const words=full.split(/\W+/).filter(Boolean);
 return tokens.every(tk=>{
  if(full.includes(tk))return true;
  let ex=[];
  for(const s of SYN_DICT){if(s.t.test(tk))ex=ex.concat(s.w)}
  for(const w of ex){if(full.includes(w))return true}
  if(tk.length>=3&&words.some(w=>w.startsWith(tk)||tk.startsWith(w)))return true;
  if(tk.length>=4&&words.some(w=>{
   if(Math.abs(w.length-tk.length)>1)return false;
   let d=0,i=0,j=0;
   while(i<tk.length&&j<w.length){
    if(tk[i]!==w[j]){d++;if(d>1)return false;if(tk.length>w.length)i++;else if(w.length>tk.length)j++;else{i++;j++}}
    else{i++;j++}
   }
   return(d+(tk.length-i)+(w.length-j))<=1;
  }))return true;
  return false;
 });
}
/* El buscador de Home: al empezar/terminar de escribir se repinta la pantalla (modo resultados) y se devuelve el foco */
function qIn(v){const p=F.q||'';F.q=v;if(!p.trim()!=!v.trim()){R(1);const e=$('#qs');if(e){e.focus();e.setSelectionRange(v.length,v.length)}}else gridR()}
/* Home: filtros y grilla (el buscador conserva el foco al escribir) */
const HL=()=>{const g=G.find(x=>x[0]==F.cat);return PR.filter(p=>(F.tab=='Todo'||p.mode==F.tab.toLowerCase()||p.mode=='ambos')&&(!g||g[2].includes(p.cat))&&(F.car=='Todas'||carOk(p))&&(F.cond=='Todos'||p.cond==F.cond)&&srcOk(p)&&p.status!='sold'&&(F.cp<0||pcp(p)==F.cp)&&smartMatch(p,F.q)).sort((a,b)=>F.sort=='d'?sedeCmp(a,b):F.sort=='p'?(a.price||a.rent)-(b.price||b.rent):b.ts-a.ts).sort((a,b)=>window.featCmp?featCmp(a,b):0)};
const gridH=l=>(window.io&&LV.me&&LV.ld.p)?skGrid(6):l.map(card).join('')||EMPTYQ()||`<div class="col-span-2 text-center text-slate-400 py-8"><p>😕 Sin resultados.</p><button onclick="aiOpen(F.q||'Ayúdame a encontrar algo')" class="mt-3 px-4 py-2 rounded-full text-white text-sm font-semibold" style="background:linear-gradient(135deg,#7c3aed,#ec4899)">✨ Preguntar a U2U AI</button></div>`;
function gridR(){const l=HL();$('#grid').innerHTML=gridH(l);$('#cnt').textContent=l.length+' resultado'+(l.length==1?'':'s');lucide.createIcons()}
function filtM(){M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg mb-3">Filtrar por campus</p><div class="flex flex-wrap gap-2">${[-1,0,1,2,3].map(i=>`<button class="chip ${F.cp==i?'on':''}" onclick="F.cp=${i};X();R(1)">${i<0?'🎓 Todos':CAMP[i]}</button>`).join('')}</div><button class="btn mt-5" onclick="X()">Listo</button></div>`)}
/* Mapa real de Lima */
const mapL=()=>PR.filter(p=>(F.tab=='Todo'||p.mode==F.tab.toLowerCase()||p.mode=='ambos')&&smartMatch(p,F.q)&&p.status!='sold'&&srcOk(p)&&(F.cond=='Todos'||p.cond==F.cond)&&(F.car=='Todas'||carOk(p))&&(F.cp<0||pcp(p)==F.cp));
function initMap(mini){const el=$(mini?'#mini-map':'#map');if(!el)return;
 if(!window.L){el.innerHTML='<div class="h-full grid place-items-center text-xs text-slate-400 bg-slate-100">Mapa no disponible sin conexión</div>';return}
 const m=L.map(el,{zoomControl:false,attributionControl:!mini,dragging:!mini,touchZoom:!mini,scrollWheelZoom:!mini,doubleClickZoom:!mini,boxZoom:false,keyboard:false}).setView(!mini&&F.cp>=0?LL[F.cp]:[-12.07,-77.02],mini?11:(F.cp>=0?14:12));
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(m);
 const uCp=(LV.me&&LV.me.cp!==undefined)?LV.me.cp:(F.cp>=0?F.cp:SEL[ME].cp);
 L.circleMarker(LL[uCp]||LL[0],{radius:8,color:'#fff',weight:3,fillColor:'#3b82f6',fillOpacity:1}).addTo(m);
 CAMP.forEach((c,i)=>{const n=PR.filter(p=>pcp(p)==i).length;if(mini){L.circleMarker(LL[i],{radius:5,color:'#fff',weight:2,fillColor:'#1e2a78',fillOpacity:1}).addTo(m);return}
  L.marker(LL[i],{zIndexOffset:500,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="campus ${F.cp==i?'on':''}">🏛️ ${c.replace('UPC ','')} · ${n}</div>`})}).addTo(m).on('click',()=>{F.cp=F.cp==i?-1:i;R()})});
 (mini?HL():mapL()).forEach(p=>{const sale=p.mode=='venta'||(p.mode=='ambos'&&F.tab!='Alquiler'),c=sale?'#10b981':'#0ea5e9',ll=pll(p);
  if(mini){L.circleMarker(ll,{radius:6,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).addTo(m);return}
  L.marker(ll,{icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="pin" style="border-color:${c};color:${c}">S/${Math.round(sale?p.price:p.rent)}${sale?'':'/d'}</div>`})}).addTo(m).on('click',()=>openP(p.id))});
 setTimeout(()=>m.invalidateSize(),60)}
function offerM(id){const p=P(id);M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg">Hacer una oferta</p><p class="text-xs text-slate-500">Precio publicado: ${sol(p.price)}</p><input id="of" type="number" class="inp mt-3" value="${Math.round(p.price*.9)}"><div class="flex gap-2 mb-3">${[5,10,15].map(x=>`<button class="chip" onclick="of.value=${Math.round(p.price*(1-x/100))}">-${x}%</button>`).join('')}</div><button class="btn" onclick="X();offerSend(${id},of.value)">Enviar oferta</button><button class="w-full py-3 text-slate-500" onclick="X()">Cancelar</button></div>`)}
/* Checkout y pago */
const days=()=>Math.max(1,Math.round((new Date(CO.to)-new Date(CO.from))/864e5)+1);
function startCO(id,mode){if(!coOk(id,mode))return;CO={id,mode,from:fd(1),to:fd(3),del:'meet',cp:pcp(P(id)),pay:'yape',terms:false};nav('co')}
function pay(){return window.io&&LV.me?payLive():toast('Inicia sesión para continuar')}
/* Publicar con Vision AI */
const SAMPLES=[
{l:'Dron',ph:'dron',a:{t:'Dron DJI Mini 2 SE',cat:'Cámaras',cond:'Semi nuevo',mode:'ambos',price:1850,rent:100,dep:350,tags:['Dron','Cámara 2.7K','Baterías'],desc:'Dron plegable con cámara 2.7K, ideal para topografía y tomas aéreas de proyectos. Incluye 2 baterías, control y estuche.'}},
{l:'Cámara',ph:'cam2',a:{t:'Cámara mirrorless 24 MP',cat:'Cámaras',cond:'Usado',mode:'ambos',price:1400,rent:50,dep:180,tags:['Mirrorless','24 MP','Lente kit'],desc:'Cámara mirrorless con lente kit para audiovisuales y fotografía. Incluye batería y cargador.'}},
{l:'Monitor',ph:'monitor',a:{t:'Monitor 24" Full HD',cat:'Laptops',cond:'Usado',mode:'venta',price:320,tags:['Monitor','1080p','HDMI'],desc:'Monitor Full HD en buen estado, sin píxeles muertos. Ideal para segunda pantalla.'}},
{l:'Libros',ph:'pack',a:{t:'Pack de libros de Estática',cat:'Libros',cond:'Usado',mode:'ambos',price:60,rent:12,dep:30,tags:['Libros','Ingeniería'],desc:'Pack de libros de estática y resistencia de materiales, con pocas marcas.'}},
{l:'Casco',ph:'casco',a:{t:'Casco de seguridad con barbiquejo',cat:'Herramientas',cond:'Nuevo',mode:'venta',price:30,tags:['Casco','EPP'],desc:'Casco certificado, requisito para visitas a obra y laboratorio.'}}];
function imgErr(el,e){el.outerHTML=`<div class="w-full h-full grid place-items-center text-5xl bg-blue-50">${e}</div>`}
function startPub(){PUB={ph:[],t:'',cat:'Cámaras',cond:'Usado',desc:'',mode:'venta',price:'',rent:'',dep:'',cp:SEL[ME].cp,ai:null,car:[]};STEP=1;nav('publish')}
function pickS(i){const a=SAMPLES[i].a;if(!PUB.t){PUB.cat=a.cat;PUB.cond=a.cond;PUB.mode=a.mode}if(!PUB.t)PUB.t=a.t;if(!PUB.desc)PUB.desc=a.desc;if(!PUB.price&&a.price)PUB.price=a.price;if(!PUB.rent&&a.rent)PUB.rent=a.rent;if(!PUB.dep&&a.dep)PUB.dep=a.dep;R(1)} // solo rellena campos VACÍOS; no agrega foto
function upF(inp){if(PUB.ph.length>=3){inp.value='';return toast('Máximo 3 fotos')}const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const i=new Image();i.onload=()=>shrinkPhoto(i,d=>{PUB.ph.push(d);R(1)});i.onerror=()=>toast('No se pudo leer la foto');i.src=e.target.result};r.readAsDataURL(f);inp.value=''}
/* Fotos: máx. 1024 px (lado mayor) y JPEG. Se baja la calidad (y si hace falta el tamaño) hasta que pese ≤ 150 KB: cuida el espacio gratuito */
function shrinkPhoto(img,done){const c=document.createElement('canvas');let side=1024,q=.8;for(let n=0;n<10;n++){const k=Math.min(1,side/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);const d=c.toDataURL('image/jpeg',q);if(d.length<=200000||n==9)return done(d);if(q>.46)q=Math.max(.45,q-.1);else side=Math.round(side*.85)}}
function pubGo(){const D=PUB;if(!D.ph.length)return toast('Elige al menos una foto');if(D.t.trim().length<3)return toast('Escribe un título');
 if((D.mode!='alquiler'&&!(+D.price>0))||(D.mode!='venta'&&!(+D.rent>0)))return toast('Ingresa los precios requeridos');
 PR.unshift({id:Date.now(),t:D.t.trim(),ph:D.ph,cat:D.cat,mode:D.mode,price:+D.price,rent:+D.rent,dep:+D.dep||0,cond:D.cond,s:ME,cp:+D.cp,x:50,y:44,ts:99,desc:D.desc||'Sin descripción',e:'📦',car:[...(D.car||[])],own:LV.me&&LV.me.uid});SEL[ME].cp=+D.cp;save();shareProduct(PR[0]);PT='pub';root('profile');toast(sock&&sock.connected?'✅ Publicado en vivo para todos los conectados':'✅ Publicado · se sincronizará cuando haya conexión')}
