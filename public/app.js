const IM={"cam": "img/cam.jpg", "cam2": "img/cam2.jpg", "sew": "img/sew.jpg", "esc": "img/esc.jpg", "regla": "img/regla.jpg", "mic": "img/mic.jpg", "calc": "img/calc.jpg", "mac": "img/mac.jpg", "tri": "img/tri.jpg", "logo": "img/logo.jpg", "dron": "img/dron.svg", "libro": "img/libro.svg", "pack": "img/pack.svg", "apuntes": "img/apuntes.svg", "casco": "img/casco.svg", "ipad": "img/ipad.svg", "scrub": "img/scrub.svg", "botas": "img/botas.svg", "arduino": "img/arduino.svg", "monitor": "img/monitor.svg", "hpprime": "img/hpprime.svg", "mandil": "img/mandil.svg", "teclado": "img/teclado.svg", "wacom": "img/wacom.svg", "kit": "img/kit.svg", "nivel": "img/nivel.svg"};
/* =================== DATOS =================== */
const $=s=>document.querySelector(s),sol=n=>'S/ '+Number(n).toLocaleString('es-PE'),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm=()=>new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),fd=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const CAMP=['UPC Monterrico','UPC San Isidro','UPC Villa','UPC San Miguel'];
const CATS=[['Todo','layout-grid'],['Cámaras','camera'],['Laptops','laptop'],['Calculadoras','calculator'],['Herramientas','ruler'],['Libros','book-open'],['Audio','mic'],['Ropa','shirt']];
const G=[['Cámaras y fotografía','camera',['Cámaras','Audio']],['Laptops y tecnología','laptop',['Laptops']],['Calculadoras y equipo de estudio','calculator',['Calculadoras','Libros']],['Herramientas y otros','wrench',['Herramientas','Ropa']]];
const LL=[[-12.1036,-76.9631],[-12.0971,-77.0376],[-12.2042,-76.9617],[-12.0773,-77.0925]],pll=p=>{const c=LL[SEL[p.s].cp],j=(p.id%7-3)*.004;return[c[0]+j*.8,c[1]-j]};
const SEL=[{n:'María Fernanda',r:4.9,c:18,car:'Comunicación',cp:0,v:2026},{n:'Diego M.',r:4.7,c:12,car:'Ing. de Software',cp:1,v:2025},{n:'Lucía R.',r:4.8,c:32,car:'Arquitectura',cp:2,v:2025},{n:'Valeria S.',r:5,c:9,car:'Ing. Civil',cp:3,v:2026},{n:'Jared Abarca',r:4.9,c:15,car:'Ing. Civil',cp:3,v:2024},{n:'Juan Pérez',r:4.8,c:32,car:'Ing. Civil',cp:3,v:2024},{n:'Joaquín Ríos',r:4.9,c:18,car:'Arquitectura',cp:0,v:2026},{n:'Renato Vega',r:4.8,c:25,car:'Ing. Industrial',cp:1,v:2025},{n:'Sofía Campos',r:5,c:40,car:'Comunicaciones',cp:3,v:2024},{n:'Andrea Luna',r:4.7,c:14,car:'Ing. de Sistemas',cp:2,v:2025}];
const ME=4;
const U=k=>'https://images.unsplash.com/photo-'+k+'?auto=format&fit=crop&w=600&q=80';
let PR=[
{id:1,t:'Cámara Canon EOS R50',ph:['cam','cam2'],cat:'Cámaras',mode:'ambos',price:1800,rent:60,dep:200,cond:'Semi nuevo',d:1.2,s:0,x:26,y:26,ts:9,desc:'Cámara mirrorless en excelente estado. Incluye batería, cargador y correa original. Ideal para proyectos de fotografía y audiovisual.'},
{id:2,t:'MacBook Air M2',ph:['mac'],cat:'Laptops',mode:'venta',price:2500,cond:'Usado',d:1.5,s:1,x:55,y:18,ts:8,desc:'Equipo en buen estado, batería sana, con cargador original. Perfecto para diseño y programación.'},
{id:3,t:'Trípode profesional Weifeng',ph:['tri'],cat:'Cámaras',mode:'alquiler',rent:30,dep:50,cond:'Usado',d:1.8,s:2,x:72,y:42,ts:7,desc:'Trípode ligero y estable con rótula fluida y bolso de transporte.'},
{id:4,t:'Calculadora Casio ClassWiz fx-82LA',ph:['calc'],cat:'Calculadoras',mode:'ambos',price:55,rent:10,dep:30,cond:'Usado',d:2,s:3,x:18,y:50,ts:6,desc:'Calculadora científica permitida en exámenes. Pantalla en perfecto estado.'},
{id:5,t:'Máquina de coser Brother GS2700',ph:['sew'],cat:'Herramientas',mode:'alquiler',rent:70,dep:150,cond:'Semi nuevo',d:2.4,s:1,x:45,y:58,ts:5,desc:'Máquina familiar con accesorios básicos. Ideal para proyectos de diseño de moda.'},
{id:6,t:'Escalímetro triangular 30 cm',ph:['esc'],cat:'Herramientas',mode:'venta',price:5,cond:'Nuevo',d:2.6,s:2,x:62,y:34,ts:4,desc:'Escalímetro con 6 escalas, ideal para planos de arquitectura e ingeniería.'},
{id:7,t:'Regla T para arquitectura 1 m',ph:['regla'],cat:'Herramientas',mode:'venta',price:8,cond:'Usado',d:3.2,s:3,x:84,y:66,ts:3,desc:'Regla T de 1 m para mesa de dibujo.'},
{id:8,t:'Micrófono RØDE VideoMicro',ph:['mic'],cat:'Audio',mode:'alquiler',rent:60,dep:100,cond:'Usado',d:3,s:0,x:82,y:30,ts:2,desc:'Micrófono on-camera con protector antiviento y cable espiral.'},
{id:9,t:'Libros de Ingeniería (pack de 4)',ph:['pack'],e:'📚',cat:'Libros',mode:'venta',price:40,cond:'Usado',d:3.4,s:3,x:12,y:70,ts:1,desc:'Pack de 4 libros de cálculo, estática y materiales.'},
{id:10,t:'Dron DJI Mini 3 Pro',ph:['dron'],e:'🚁',cat:'Cámaras',mode:'ambos',price:2100,rent:120,dep:400,cond:'Semi nuevo',s:5,x:50,y:50,ts:20,desc:'Excelente para tomas aéreas y topografía. Incluye 3 baterías, control y hélices extra.'},
{id:11,t:'Libro Hidráulica de Canales',ph:['libro'],e:'📘',cat:'Libros',mode:'alquiler',rent:15,dep:40,cond:'Usado',s:5,x:50,y:50,ts:19,desc:'Libro base del curso, edición reciente y sin subrayados.'},
{id:12,t:'Casco blanco de obra 3M',ph:['casco'],e:'⛑️',cat:'Herramientas',mode:'venta',price:35,cond:'Nuevo',s:6,x:50,y:50,ts:18,desc:'Casco certificado, requisito para visitas a obra y laboratorio.'},
{id:13,t:'iPad Pro M1 + Apple Pencil',ph:['ipad'],e:'📱',cat:'Laptops',mode:'venta',price:3100,cond:'Semi nuevo',s:7,x:50,y:50,ts:17,desc:'Impecable, ideal para apuntes y apps de CAD o dibujo digital.'},
{id:14,t:'Uniforme scrub médico (talla M)',ph:['scrub'],e:'🥼',cat:'Ropa',mode:'venta',price:65,cond:'Nuevo',s:8,x:50,y:50,ts:16,desc:'Azul marino, nuevo en bolsa. Para prácticas de laboratorio y salud.'},
{id:15,t:'Botas punta de acero CAT',ph:['botas'],e:'🥾',cat:'Ropa',mode:'ambos',price:180,rent:20,dep:50,cond:'Usado',s:9,x:50,y:50,ts:15,desc:'Talla 42. Para entrar a laboratorio o visitas de campo sin problemas.'},
{id:16,t:'Kit Arduino Uno + sensores',ph:['arduino'],e:'🔌',cat:'Laptops',mode:'venta',price:120,cond:'Semi nuevo',s:9,x:50,y:50,ts:14,desc:'Proyectos de electrónica listos para ensamblar. Incluye cables y protoboard.'},
{id:17,t:'Monitor LG 27" Full HD',ph:['monitor'],e:'🖥️',cat:'Laptops',mode:'venta',price:450,cond:'Usado',s:5,x:50,y:50,ts:13,desc:'Doble pantalla para Costos y presupuestos, Excel y programación.'},
{id:18,t:'Apuntes Costos y Presupuestos',ph:['apuntes'],e:'📝',cat:'Libros',mode:'venta',price:15,cond:'Nuevo',s:7,x:50,y:50,ts:12,desc:'Fórmulas, ACU y plantillas impresas, listas para el examen.'},
{id:19,t:'Calculadora HP Prime',ph:['hpprime'],e:'🧮',cat:'Calculadoras',mode:'ambos',price:350,rent:25,dep:100,cond:'Usado',s:8,x:50,y:50,ts:11,desc:'Calculadora gráfica ideal para ingeniería. Permitida en exámenes.'},
{id:20,t:'Mandil de laboratorio (talla S)',ph:['mandil'],e:'🥼',cat:'Ropa',mode:'venta',price:30,cond:'Semi nuevo',s:8,x:50,y:50,ts:10,desc:'Mandil blanco de algodón, lavado una sola vez.'},
{id:21,t:'Teclado mecánico Keychron K2',ph:['teclado'],e:'⌨️',cat:'Laptops',mode:'venta',price:190,cond:'Usado',s:6,x:50,y:50,ts:9,desc:'Inalámbrico, switches marrones. Perfecto para programar o escribir tesis.'},
{id:22,t:'Tablet gráfica Wacom Intuos',ph:['wacom'],e:'🖊️',cat:'Laptops',mode:'ambos',price:280,rent:20,dep:60,cond:'Semi nuevo',s:9,x:50,y:50,ts:8,desc:'Ideal para ilustración digital y edición de fotos.'},
{id:23,t:'Kit de dibujo técnico completo',ph:['kit'],e:'📐',cat:'Herramientas',mode:'venta',price:45,cond:'Nuevo',s:6,x:50,y:50,ts:7,desc:'Escuadras, compás, rapidógrafos y plantillas para planos.'},
{id:24,t:'Nivel de ingeniero Topcon + trípode',ph:['nivel'],e:'📏',cat:'Herramientas',mode:'alquiler',rent:80,dep:300,cond:'Usado',s:5,x:50,y:50,ts:6,desc:'Para prácticas de topografía y nivelación en campo. Incluye mira y estuche.'}];
const ST={fav:[10,13],orders:[],chats:{10:[{m:0,t:'¡Hola! Sí, el dron tiene sus 3 baterías al 100% 🔋',h:'10:24'}],1:[{m:0,t:'¡Hola Jared! Sí, la cámara sigue disponible 😊',h:'10:24'}],3:[{m:1,t:'¿Sigue disponible el trípode?',h:'Ayer'},{m:0,t:'Sí, te espero en la puerta del campus',h:'Ayer'}]},off:{},mine:[]};
try{Object.assign(ST,JSON.parse(localStorage.getItem('u2u6')||'{}'));PR=[...ST.mine,...PR]}catch(e){}
const save=()=>{try{ST.mine=PR.filter(p=>p.id>100&&!p.remote);localStorage.setItem('u2u6',JSON.stringify(ST))}catch(e){toast('Memoria llena: no se guardó')}};
const DK=[6.2,4.5,8.3,.6];PR.forEach(p=>{if(p.s!=ME)p.d=+(DK[SEL[p.s].cp]+((p.id*13)%9)/10).toFixed(1)});
const src=k=>IM[k]||k,P=id=>PR.find(p=>p.id==id);
const pic=(p,i=0,c='')=>p.ph[i]?`<img src="${src(p.ph[i])}" alt="${esc(p.t||'Producto')}" onerror="imgErr(this,'${p.e||'📦'}')" class="w-full h-full object-cover ${c}">`:`<div class="w-full h-full grid place-items-center text-5xl bg-blue-50">${p.e||'📦'}</div>`;
const price=(p,m)=>{m=m||p.mode;return m=='alquiler'?`${sol(p.rent)}<small class="font-semibold text-slate-500">/día</small>`:m=='venta'?sol(p.price):`${sol(p.price)}<small class="font-semibold text-slate-500"> · ${sol(p.rent)}/día</small>`};
const tag=m=>m=='venta'?['Venta','bg-emerald-100 text-emerald-700']:m=='alquiler'?['Alquiler','bg-sky-100 text-sky-700']:['Venta · Alquiler','bg-violet-100 text-violet-700'];
const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
/* =================== NAVEGACIÓN =================== */
let S={s:'login',a:null,st:[],vm:'venta'},F={tab:'Todo',cat:'Todo',cp:-1,sort:'d',q:'',car:'Todas',cond:'Todos'},CO={},PUB={},PT='pub',STEP=1;
const NAVS=['home','map','msgs','profile'];
function nav(s,a){S.st.push({s:S.s,a:S.a});S.s=s;S.a=a;R()}
function back(){const p=S.st.pop()||{s:'home'};S.s=p.s;S.a=p.a;R()}
function root(s,a){S.st=[];S.s=s;S.a=a;R()}
function R(keep){const v=$('#v'),y=v.scrollTop;v.style.animation='none';v.offsetWidth;v.style.animation='';
 v.innerHTML=V[S.s](S.a);v.scrollTop=keep?y:0;
 const n=$('#nav');n.classList.toggle('hidden',!NAVS.includes(S.s));
 const b=(s,i,l)=>`<button onclick="root('${s}')" class="flex flex-col items-center gap-0.5 ${S.s==s?'text-brand font-semibold':''}"><i data-lucide="${i}"></i>${l}</button>`;
 const t=(s,i,l)=>`<button onclick="root('${s}')" aria-label="${l}" class="p-2 ${S.s==s?'text-brand':'text-slate-500'}"><i data-lucide="${i}" class="w-7 h-7"></i></button>`;
 n.innerHTML=t('home','home','Inicio')+t('map','compass','Explorar')+`<button onclick="startPub()" class="-mt-7 flex flex-col items-center gap-0.5 w-16"><span class="w-14 h-14 rounded-full bg-[#2f4bd8] text-white grid place-items-center shadow-[0_8px_16px_rgba(47,75,216,.35)] border-4 border-[#eef3fb]"><i data-lucide="plus" class="w-7 h-7"></i></span><span class="text-slate-600 text-[11px]">Publicar</span></button>`+t('msgs','message-circle-more','Mensajes')+t('profile','circle-user-round','Perfil');
 fixAlt();lucide.createIcons();if(S.s=='map')initMap(0);if(S.s=='home')initMap(1);const fb=$('#aifab');fb.classList.toggle('hidden',!['home','map'].includes(S.s));fb.style.bottom=S.s=='map'?'250px':'calc(100px + env(safe-area-inset-bottom,0px))'}
function toast(t){const e=$('#toast');e.textContent=t;e.style.opacity=1;clearTimeout(e.t);e.t=setTimeout(()=>e.style.opacity=0,2200)}
function M(h){const m=$('#modal');m.innerHTML=h;fixAlt();m.classList.remove('hidden');m.classList.add('flex');lucide.createIcons()}
function X(){if(window._cfr){const r=_cfr;_cfr=null;r(false)}const m=$('#modal');m.classList.add('hidden');m.classList.remove('flex')}
const hd=(t,r='')=>`<div class="sticky top-0 bg-white/95 backdrop-blur z-20 flex items-center gap-3 px-4 py-3 border-b"><button onclick="back()"><i data-lucide="arrow-left"></i></button><b class="flex-1 truncate">${t}</b>${r}</div>`;
function openP(id){const p=P(id);S.vm=p.mode=='alquiler'?'alquiler':'venta';nav('detail',id)}
function fav(id){const i=ST.fav.indexOf(id);i<0?ST.fav.push(id):ST.fav.splice(i,1);save();R(1)}
/* =================== TARJETA (estilo Marketplace) =================== */
const card=p=>{const t=tag(p.mode);return `<div onclick="openP(${p.id})" class="cursor-pointer active:scale-[.97] transition">
 <div class="relative aspect-square rounded-2xl overflow-hidden bg-slate-100">${pic(p)}
  <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-navy shadow-sm">${p.cond}</span>${p.status=='reserved'||p.status=='sold'?`<div class="absolute inset-0 bg-black/45 grid place-items-center"><span class="bg-white text-navy text-xs font-extrabold px-3 py-1 rounded-full">${p.status=='sold'?'Vendido':'Reservado'}</span></div>`:''}
  <button onclick="event.stopPropagation();fav(${p.id})" class="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow"><i data-lucide="heart" class="w-4 h-4 ${ST.fav.includes(p.id)?'fill-red-500 text-red-500':''}"></i></button>
  <span class="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${t[1]}">${t[0]}</span></div>
 <p class="font-extrabold mt-1.5 text-[15px] leading-none">${price(p)}${fairB(p)}</p>
 <p class="text-[13px] truncate mt-0.5">${esc(p.t)}</p>
 <p class="text-[11px] text-slate-500 truncate">📍 ${CAMP[SEL[p.s].cp]} · ${p.d} km</p></div>`};
/* =================== PANTALLAS =================== */
const V={
login(){return window.io?authForm('login'):V.localLogin()},
register(){return authForm('register')},
boot(){return `<div class="h-full grid place-items-center px-8 text-center"><div><img src="${IM.logo}" alt="U2U" class="w-48 mx-auto"><div class="w-9 h-9 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mt-8" aria-hidden="true"></div><p class="text-sm text-slate-500 mt-4" role="status">Entrando a tu cuenta…</p><button class="mt-6 text-sm font-semibold text-brand" onclick="S.s='login';R()">Usar otra cuenta</button></div></div>`},
localLogin(){const u=LV.pref||{};return `<div class="px-7 pt-14 pb-8"><img src="${IM.logo}" alt="U2U · Compra, vende y alquila entre estudiantes" class="w-60 mx-auto">
 <h1 class="text-[26px] font-extrabold text-navy text-center mt-7 leading-tight">Compra, vende y alquila<br>entre estudiantes</h1>
 <p class="text-slate-500 text-sm text-center mt-2 mb-7">Entra en 5 segundos. Solo escribe tu nombre.</p>
 <input id="un" class="inp text-center text-lg" maxlength="24" placeholder="¿Cómo te llamas?" autocomplete="off" value="${esc(u.name||'')}" onkeydown="event.key=='Enter'&&loginLocal()">
 <p id="er" class="text-red-500 text-xs h-5 text-center"></p>
 <button class="btn" onclick="loginLocal()">Entrar</button>
 <p id="pres" class="text-center text-xs text-slate-400 mt-4"></p>
 <div class="grid grid-cols-3 gap-2 mt-6 text-center text-[11px] text-slate-600">${[['🛍️','Compra y alquila'],['📸','Publica con IA'],['🔐','Entrega con código']].map(a=>`<div class="bg-blue-50 rounded-2xl py-3"><div class="text-xl">${a[0]}</div>${a[1]}</div>`).join('')}</div></div>`},
home(){const l=HL();
 return `<div class="pb-28"><div class="px-5 pt-7 flex items-start justify-between"><div><h1 class="text-[26px] font-bold text-navy leading-tight">Hola, ${esc(uname())} <span class="text-xl">👋</span></h1><p class="text-[17px] text-slate-500 mt-1">¿Qué necesitas este ciclo?</p><button onclick="sedeM()" class="mt-2 text-xs font-bold bg-blue-50 text-brand rounded-full px-3 py-1.5">📍 ${F.cp<0?'Todas las sedes UPC':CAMP[F.cp]} ▾</button></div>
  <button onclick="notifM()" aria-label="Notificaciones" class="relative p-2 rounded-full bg-blue-50 text-brand mt-1"><i data-lucide="bell"></i><span class="absolute top-1.5 right-2 w-2 h-2 bg-pink-500 rounded-full"></span></button></div>
 <div class="px-5 mt-5"><div class="flex items-center bg-white rounded-2xl px-4 shadow-[0_6px_16px_rgba(30,42,120,.12)] border border-slate-100 focus-within:ring-2 focus-within:ring-brand/30"><i data-lucide="search" class="w-5 text-slate-400"></i><input value="${esc(F.q)}" oninput="F.q=this.value;gridR()" placeholder="Buscar productos" class="w-full bg-transparent py-3.5 px-3 text-[15px] outline-none"><button onclick="filtM()" aria-label="Filtros" class="text-slate-500"><i data-lucide="sliders-horizontal" class="w-5"></i></button></div></div>
 <div class="flex justify-between px-4 mt-6">${G.map(g=>`<button onclick="F.cat=F.cat=='${g[0]}'?'Todo':'${g[0]}';R(1)" class="flex flex-col items-center gap-2 w-[80px]"><span class="w-14 h-14 rounded-full grid place-items-center transition ${F.cat==g[0]?'bg-brand text-white shadow-md shadow-brand/30':'bg-blue-50 text-brand'}"><i data-lucide="${g[1]}" class="w-6 h-6"></i></span><span class="text-[10.5px] font-semibold text-center leading-tight text-navy">${g[0]}</span></button>`).join('')}</div>
 <div class="mx-5 mt-6 rounded-3xl p-5 relative overflow-hidden" style="background:linear-gradient(120deg,#dbeafe,#e0f2fe)"><div class="relative z-10 w-[58%]"><h2 class="text-[18px] font-bold leading-tight text-navy">Dale una <span class="text-emerald-500">segunda vida</span> a lo que ya no usas</h2><p class="text-[11px] text-slate-600 mt-2 leading-snug">Compra, vende o alquila materiales y equipos académicos entre estudiantes.</p><button onclick="root('map')" class="mt-3 bg-navy text-white text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1">Explorar ahora <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button></div>
  <div class="absolute right-3 top-3 flex flex-col items-end gap-1 text-[8px] font-semibold text-navy"><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Más oportunidades</span><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Menos residuos</span><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Comunidad estudiantil</span></div>
  <div class="absolute right-4 bottom-3 w-24 h-14 rounded-md bg-amber-200 grid place-items-center font-extrabold text-navy text-lg shadow-md">U2U</div><img src="${IM.cam}" alt="Cámara Canon de ejemplo" class="absolute right-14 bottom-[52px] w-11 h-11 rounded-lg object-cover shadow"><img src="${IM.calc}" alt="Calculadora Casio de ejemplo" class="absolute right-4 bottom-[50px] w-8 h-10 rounded-md object-cover shadow"></div>
 <div class="grid grid-cols-3 gap-2 mx-5 mt-4">${[['calculator','Calculadora de ahorro','ahorroM()'],['building-2','Sedes UPC',"nav('sedes')"],['shield-check','Punto seguro',"toast('Entregas solo en puntos seguros del campus, con carné UPC')"]].map(a=>`<button onclick="${a[2]}" class="bg-blue-50 rounded-2xl p-3 text-[11px] font-semibold text-navy flex flex-col items-center gap-1.5 active:scale-95 transition"><i data-lucide="${a[0]}" class="w-6 h-6 text-brand"></i>${a[1]}</button>`).join('')}</div>
<div class="mx-5 mt-5 rounded-2xl p-4 text-white" style="background:linear-gradient(135deg,#6d28d9,#db2777)"><p class="font-bold flex items-center gap-1.5"><i data-lucide="sparkles" class="w-4"></i>U2U AI · tu asistente</p><p class="text-xs opacity-90 mt-1">Cuéntame qué necesitas y busco en los 4 campus de UPC.</p><div class="flex gap-2 overflow-x-auto no-sb mt-3">${['Algo para topografía','Tengo S/ 100','Para filmar un corto'].map(q=>`<button onclick="aiOpen('${q}')" class="shrink-0 bg-white/20 border border-white/40 rounded-full px-3 py-1.5 text-xs font-semibold">${q}</button>`).join('')}</div></div>
 <div class="px-5 mt-7 flex items-start gap-2"><i data-lucide="map-pin" class="w-5 text-brand mt-0.5"></i><div><h3 class="font-bold text-navy">Explora productos cerca de ti</h3><p class="text-sm text-slate-500 leading-snug">Encuentra estudiantes que venden o alquilan en tu zona.</p></div></div>
 <div class="px-5 mt-3"><div class="relative h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-md"><div id="mini-map" class="absolute inset-0 z-0"></div><div onclick="root('map')" class="absolute inset-0 z-[5] cursor-pointer"></div></div></div>
 <div class="px-5 mt-7 flex items-center justify-between"><h3 class="font-bold text-lg text-navy">Destacados</h3><select onchange="F.sort=this.value;gridR()" class="text-xs font-semibold text-slate-500 bg-transparent outline-none"><option value="d" ${F.sort=='d'?'selected':''}>Más cercanos</option><option value="p" ${F.sort=='p'?'selected':''}>Menor precio</option><option value="r" ${F.sort=='r'?'selected':''}>Más recientes</option></select></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-5 items-center"><span class="text-xs font-bold text-navy shrink-0">🎒 Para tu carrera</span>${CARR.map(c=>`<button class="chip ${F.car==c?'on':''}" onclick="F.car='${c}';R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-3 items-center"><span class="text-xs font-bold text-navy shrink-0">✨ Estado</span>${['Todos','Nuevo','Semi nuevo','Usado'].map(c=>`<button class="chip ${F.cond==c?'on':''}" onclick="F.cond='${c}';R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-3"><button class="chip ${F.cp<0?'on':''}" onclick="F.cp=-1;R(1)">🎓 Todos los campus</button>${CAMP.map((c,i)=>`<button class="chip ${F.cp==i?'on':''}" onclick="F.cp=${i};R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 px-5 mt-3 items-center">${['Todo','Venta','Alquiler'].map(t=>`<button class="chip ${F.tab==t?'on':''}" onclick="F.tab='${t}';R(1)">${t}</button>`).join('')}${filtN()?'<button class="chip" onclick="clrF()">✕ Limpiar filtros</button>':''}<span id="cnt" class="ml-auto text-xs text-slate-400">${l.length} resultado${l.length==1?'':'s'}</span></div>
 <div id="grid" class="px-5 mt-4 grid grid-cols-2 gap-x-3 gap-y-4">${gridH(l)}</div></div>`},
detail(id){const p=P(id),s=SEL[p.s],am=p.mode=='ambos',al=p.mode=='alquiler'||(am&&S.vm=='alquiler'),n=Math.max(1,p.ph.length),rel=PR.filter(x=>x.cat==p.cat&&x.id!=id).slice(0,4),t=tag(p.mode);
 return `<div class="pb-28"><div class="relative h-80 bg-slate-100"><div id="car" onscroll="dots()" class="flex h-full overflow-x-auto snap-x snap-mandatory no-sb">${Array.from({length:n},(_,i)=>`<div class="min-w-full h-full snap-center">${pic(p,i)}</div>`).join('')}</div>
  <button onclick="back()" class="absolute top-4 left-4 bg-white rounded-full p-2 shadow"><i data-lucide="arrow-left"></i></button>
  <div class="absolute top-4 right-4 flex gap-2"><button onclick="navigator.clipboard&&navigator.clipboard.writeText('u2u.pe/p/${p.id}');toast('Enlace copiado')" class="bg-white rounded-full p-2 shadow"><i data-lucide="share-2"></i></button><button onclick="fav(${p.id})" class="bg-white rounded-full p-2 shadow"><i data-lucide="heart" class="${ST.fav.includes(p.id)?'fill-red-500 text-red-500':''}"></i></button></div>
  ${n>1?`<div id="dots" class="absolute bottom-3 inset-x-0 flex justify-center gap-1.5"></div>`:''}</div>
 <div class="px-5 pt-4"><div class="flex items-start justify-between gap-2"><h1 class="text-xl font-bold leading-tight">${esc(p.t)}</h1><span class="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${t[1]}">${t[0]}</span></div>
  ${am?`<div class="grid grid-cols-2 bg-slate-100 rounded-xl p-1 mt-3 text-sm font-semibold">${['venta','alquiler'].map(m=>`<button onclick="S.vm='${m}';R(1)" class="py-1.5 rounded-lg ${S.vm==m?'bg-white shadow text-brand':'text-slate-500'}">${m=='venta'?'Comprar':'Alquilar'}</button>`).join('')}</div>`:''}
  <p class="text-3xl font-extrabold text-brand mt-2">${al?price(p,'alquiler'):sol(ST.off[id]||p.price)}${!al&&ST.off[id]?` <span class="text-xs text-mint font-bold">oferta aceptada</span>`:''}</p>
  ${al?`<p class="text-xs text-slate-500">Depósito reembolsable: ${sol(p.dep||0)} (se preautoriza, no se cobra)</p>`:''}
  <div class="grid grid-cols-2 gap-2 mt-4 text-sm">${[['package','Condición',p.cond],['tag','Categoría',p.cat],['map-pin','Punto de encuentro',CAMP[s.cp]],['navigation','Distancia','a '+p.d+' km']].map(a=>`<div class="bg-slate-50 rounded-xl p-3"><i data-lucide="${a[0]}" class="w-4 text-brand"></i><p class="text-[11px] text-slate-500">${a[1]}</p><b class="text-[13px]">${a[2]}</b></div>`).join('')}</div>
  ${stH(p)}${carH(p)}${aiCard(p)}<h3 class="font-bold mt-4">Descripción</h3><p class="text-sm text-slate-600">${esc(p.desc)}</p>
  <div onclick="nav('seller',${p.s})" class="mt-4 border rounded-2xl p-3 flex items-center gap-3 cursor-pointer"><div class="w-12 h-12 rounded-full bg-brand text-white grid place-items-center font-bold">${s.n[0]}</div><div class="flex-1"><p class="font-bold text-sm">${s.n} <i data-lucide="badge-check" class="inline w-4 text-brand"></i></p><p class="text-xs text-slate-500">${s.car} · ${s.ci} ciclo · ${CAMP[s.cp]}</p><p class="text-xs text-amber-500">${rtH(p.s)}</p></div><i data-lucide="chevron-right" class="text-slate-400"></i></div>
  <div class="mt-3 bg-emerald-50 text-emerald-800 rounded-2xl p-3 text-xs flex gap-2"><i data-lucide="shield-check" class="w-5 shrink-0"></i><span><b>Punto Seguro UPC:</b> entrega en ${SD[s.cp].pt} de ${CAMP[s.cp]}. Ambos presentan carné UPC y la entrega se confirma con un código de 6 dígitos. Paga solo dentro de U2U.</span></div>
  ${reportBtn(p)}
  ${rel.length?`<h3 class="font-bold mt-5 mb-2">Similares</h3><div class="grid grid-cols-2 gap-3">${rel.map(card).join('')}</div>`:''}</div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3 flex gap-2 z-20"><button onclick="openChat(${id})" class="p-3 border border-brand text-brand rounded-2xl"><i data-lucide="message-circle"></i></button>
  ${!al?`<button onclick="offerM(${id})" class="px-4 border border-brand text-brand rounded-2xl font-semibold text-sm">Hacer oferta</button>`:''}
  ${!al&&(p.status=='reserved'||p.status=='sold')?`<button class="btn flex-1 opacity-50" disabled>${p.status=='sold'?'Vendido':'Reservado por otro estudiante'}</button>`:`<button onclick="startCO(${id},'${al?'alquiler':'venta'}')" class="btn flex-1">${al?'Alquilar ahora':'Comprar'}</button>`}</div>`},
seller(i){const s=SEL[i],l=PR.filter(p=>p.s==i);return hd('Perfil del vendedor')+`<div class="p-5 pb-24"><div class="flex items-center gap-4"><div class="w-16 h-16 rounded-full bg-brand text-white grid place-items-center text-2xl font-bold">${s.n[0]}</div><div><p class="font-bold">${s.n} <i data-lucide="badge-check" class="inline w-4 text-brand"></i></p><p class="text-xs text-slate-500">${s.car} · UPC</p><p class="text-xs text-amber-500">${rtH(i)}</p></div></div>
 <div class="grid grid-cols-3 text-center bg-blue-50 rounded-2xl py-3 mt-4 text-xs"><div><b class="block text-base">${l.length}</b>Publicaciones</div><div><b class="block text-base">${rtOf(i).count}</b>Reseñas</div><div><b class="block text-base">${s.v}</b>Miembro desde</div></div>
 <div class="bg-emerald-50 text-emerald-800 text-xs rounded-xl p-3 mt-3 flex gap-2"><i data-lucide="shield-check" class="w-5"></i>Estudiante verificado con correo universitario</div>
 <h3 class="font-bold mt-5 mb-2">Reseñas de estudiantes</h3>${revH(i)}
 <h3 class="font-bold mt-4 mb-2">Publicaciones</h3><div class="grid grid-cols-2 gap-3">${l.map(card).join('')}</div></div>`},
chat(id){const p=P(id),s=SEL[p.s];return `<div class="h-full flex flex-col">${hd(s.n,`<span class="text-xs text-mint font-semibold">● en línea</span>`)}
 <div onclick="openP(${id})" class="flex gap-3 items-center p-3 bg-slate-50 border-b cursor-pointer"><div class="w-12 h-12 rounded-lg overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${esc(p.t)}</p><p class="text-xs text-brand font-bold">${price(p)}</p></div></div>
 <div id="ml" class="flex-1 overflow-y-auto no-sb p-4 space-y-2 bg-slate-50"></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-3 pt-2 items-center"><span class="text-[10px] font-bold text-purple-600 shrink-0">✨ IA sugiere</span>${aiChips(p).map(q=>`<button class="chip" onclick="send(${id},'${q}')">${q}</button>`).join('')}</div>
 <div class="flex gap-2 p-3"><input id="ci" onkeydown="event.key=='Enter'&&send(${id})" placeholder="Escribe un mensaje..." class="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none"><button onclick="send(${id})" class="bg-brand text-white rounded-full p-3"><i data-lucide="send" class="w-5"></i></button></div></div>`},
msgs(){const k=Object.keys(ST.chats);return `<div class="p-5 pb-28"><h1 class="text-2xl font-bold mb-4">Mensajes</h1>${k.map(id=>{const p=P(id),c=ST.chats[id],l=c[c.length-1];return p&&l?`<div onclick="nav('chat',${id})" class="flex gap-3 items-center py-3 border-b cursor-pointer"><div class="w-14 h-14 rounded-xl overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm">${SEL[p.s].n}</p><p class="text-xs text-slate-500 truncate">${esc(p.t)}</p><p class="text-xs truncate ${l.m?'text-slate-400':'text-slate-700'}">${l.m?'Tú: ':''}${esc(l.t)}</p></div><span class="text-[10px] text-slate-400">${l.h}</span></div>`:''}).join('')||'<p class="text-center text-slate-400 py-16">Aún no tienes conversaciones.<br>Contacta a un vendedor desde un producto.</p>'}</div>`},
map(){const l=mapL().sort((a,b)=>a.d-b.d);
 return `<div class="relative h-full overflow-hidden"><div id="map" class="absolute inset-0 z-0"></div>
 <div class="absolute top-4 inset-x-4 z-10"><label class="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm"><i data-lucide="search" class="w-5 text-slate-400"></i><input value="${esc(F.q)}" onchange="F.q=this.value;R()" placeholder="Buscar en esta zona" class="flex-1 outline-none bg-transparent"></label><div class="flex gap-2 mt-2">${['Todo','Venta','Alquiler'].map(t=>`<button onclick="F.tab='${t}';R()" class="chip shadow ${F.tab==t?'on':''}">${t=='Todo'?'Todos':t}</button>`).join('')}</div><div class="flex gap-2 mt-2 overflow-x-auto no-sb">${['Todos',...CAMP.map(c=>c.replace('UPC ',''))].map((c,i)=>`<button class="chip shadow ${F.cp==i-1?'on':''}" onclick="F.cp=${i-1};R()">${c}</button>`).join('')}</div></div>
 <div id="sheet" class="absolute inset-x-0 bottom-0 h-[78%] bg-white rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,.15)] z-20 flex flex-col" style="transform:translateY(calc(100% - 230px))"><div id="hdl" class="py-3 cursor-grab touch-none" onclick="sh()"><div class="w-10 h-1.5 bg-slate-300 rounded mx-auto"></div></div>
 <p class="px-5 font-bold text-brand">${l.length} productos cerca de ti</p><div class="overflow-y-auto no-sb px-5 pb-28 divide-y">${l.map(p=>`<div onclick="openP(${p.id})" class="flex gap-3 py-3 cursor-pointer"><div class="w-20 h-20 rounded-xl overflow-hidden">${pic(p)}</div><div><p class="font-bold text-sm">${esc(p.t)}</p><span class="text-[10px] px-2 py-0.5 rounded-full ${tag(p.mode)[1]}">${tag(p.mode)[0]}</span><p class="font-extrabold text-brand">${price(p)}</p><p class="text-xs text-slate-500">📍 A ${p.d} km · ${CAMP[SEL[p.s].cp]}</p></div></div>`).join('')}</div></div></div>`},
profile(){const me=PR.filter(p=>p.s==ME),n=me.length+ST.orders.length,fv=PR.filter(p=>ST.fav.includes(p.id)),tabs=[['pub','Publicaciones'],['fav','Favoritos'],['ord','Pedidos']];
 return `<div class="p-5 pb-28"><div class="flex justify-between"><h1 class="text-2xl font-bold">Mi cuenta</h1><button onclick="toast('Ajustes próximamente')"><i data-lucide="settings"></i></button></div>
 <div class="flex items-center gap-4 mt-4"><div class="w-16 h-16 rounded-full bg-brand text-white grid place-items-center text-2xl font-bold">${esc(uname())[0].toUpperCase()}</div><div><p class="font-bold">${esc(uname())} <i data-lucide="badge-check" class="inline w-4 text-brand"></i></p><p class="text-xs text-slate-500">${SEL[ME].car} · ${SEL[ME].ci} ciclo · ${CAMP[SEL[ME].cp]}</p><p class="text-xs text-amber-500">${rtH(ME)}</p></div></div>
 <div class="mt-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl p-3 flex gap-2"><i data-lucide="shield-check" class="w-5"></i>Alumno verificado: carné UPC, DNI y correo @upc.edu.pe</div>${LV.adm?adminBtn():''}
 <div class="mt-3 rounded-2xl p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center gap-3"><i data-lucide="leaf" class="w-9 h-9"></i><div><p class="font-bold">${n} artículo${n==1?'':'s'} reutilizado${n==1?'':'s'}</p><p class="text-xs opacity-90">≈ ${n*9} kg de CO₂ evitados (estimado)</p></div></div>
 <div class="grid grid-cols-3 mt-4 bg-slate-100 rounded-xl p-1 text-xs font-semibold">${tabs.map(t=>`<button onclick="PT='${t[0]}';R(1)" class="py-2 rounded-lg ${PT==t[0]?'bg-white shadow text-brand':'text-slate-500'}">${t[1]}</button>`).join('')}</div>
 <div class="mt-4">${PT=='pub'?`<div class="grid grid-cols-2 gap-3">${me.map(card).join('')||''}</div>${me.length?'':empty('package-plus','Aún no publicaste nada','Vende o alquila lo que ya no usas y ayuda a otro estudiante.','Publicar ahora','startPub()')}`:PT=='fav'?`<div class="grid grid-cols-2 gap-3">${fv.map(card).join('')}</div>${fv.length?'':empty('heart','Aún no tienes favoritos','Toca el corazón de un producto para guardarlo y encontrarlo aquí.','Explorar productos',"root('home')")}`:ordersTab()}</div>
 <button onclick="manifM()" class="w-full mt-6 bg-blue-50 text-brand font-semibold py-3 rounded-2xl">💡 Manifiesto U2U · UPC</button>
 <button onclick="logout()" class="w-full mt-3 border border-brand text-brand font-semibold py-3 rounded-2xl">Cerrar sesión</button></div>`},
co(){const p=P(CO.id),al=CO.mode=='alquiler',d=days(),b=al?p.rent*d:(ST.off[p.id]||p.price),dl=CO.del=='home'?15:0,tot=b+10+dl;
 return hd(al?'Confirmar alquiler':'Confirmar compra')+`<div class="p-5 pb-32"><div class="flex gap-3 border rounded-2xl p-3"><div class="w-16 h-16 rounded-xl overflow-hidden">${pic(p)}</div><div><p class="font-bold text-sm">${esc(p.t)}</p><p class="text-brand font-extrabold">${price(p,CO.mode)}</p><p class="text-xs text-slate-500">Vende ${SEL[p.s].n}</p></div></div>
 ${al?`<h3 class="font-bold mt-4">Fechas</h3><div class="grid grid-cols-2 gap-3"><div><label class="text-xs">Inicio</label><input type="date" class="inp" min="${fd(0)}" value="${CO.from}" onchange="CO.from=this.value;if(CO.to<this.value)CO.to=this.value;R(1)"></div><div><label class="text-xs">Fin</label><input type="date" class="inp" min="${CO.from}" value="${CO.to}" onchange="CO.to=this.value;R(1)"></div></div>`:''}
 <h3 class="font-bold mt-2">Entrega</h3>${[['meet','handshake','Punto de encuentro en campus','Gratis · zona segura'],['home','truck','Delivery a domicilio','S/ 15 · coordinado con el vendedor']].map(a=>`<div onclick="CO.del='${a[0]}';R(1)" class="flex gap-3 items-center border-2 rounded-2xl p-3 mb-2 cursor-pointer ${CO.del==a[0]?'border-brand bg-blue-50':'border-slate-200'}"><i data-lucide="${a[1]}" class="text-brand"></i><div><b class="text-sm">${a[2]}</b><p class="text-xs text-slate-500">${a[3]}</p></div></div>`).join('')}
 ${CO.del=='meet'?`<select class="inp" onchange="CO.cp=this.value">${CAMP.map((c,i)=>`<option value="${i}" ${CO.cp==i?'selected':''}>${c}</option>`).join('')}</select>`:''}
 <h3 class="font-bold">Método de pago</h3>${[['visa','Visa •••• 3456'],['yape','Yape'],['plin','Plin'],['bank','Transferencia bancaria (se confirma al conciliar)']].map(a=>`<label class="flex gap-2 items-center border rounded-xl p-3 mb-2 text-sm"><input type="radio" name="pm" ${CO.pay==a[0]?'checked':''} onchange="CO.pay='${a[0]}'">${a[1]}</label>`).join('')}
 <div class="bg-slate-50 rounded-2xl p-4 mt-3 text-sm space-y-1"><div class="flex justify-between"><span>${al?sol(p.rent)+' × '+d+' día'+(d>1?'s':''):'Producto'}</span><b>${sol(b)}</b></div><div class="flex justify-between"><span>Protección al comprador</span><b>${sol(10)}</b></div><div class="flex justify-between"><span>Entrega</span><b>${dl?sol(dl):'Gratis'}</b></div><div class="flex justify-between border-t pt-2 text-base"><span>Total a pagar ahora</span><b class="text-brand">${sol(tot)}</b></div>${al?`<p class="text-xs text-slate-500 pt-1">Depósito ${sol(p.dep||0)}: se preautoriza y se libera al devolver sin daños.</p>`:''}</div>
 <label class="flex gap-2 items-start text-xs mt-3"><input type="checkbox" class="mt-0.5" ${CO.terms?'checked':''} onchange="CO.terms=this.checked;R(1)">Acepto los Términos y condiciones y las Políticas de uso de U2U.</label></div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3"><button class="btn" ${CO.terms?'':'disabled'} onclick="pay(${tot})">Pagar ${sol(tot)}</button></div>`},
publish(){const D=PUB,a=D.ai,lb=t=>`<label class="text-xs font-semibold block mt-3">${t}</label>`;
 const form=`${a?`<div class="mt-4 bg-purple-50 text-purple-700 rounded-xl p-3 text-xs font-semibold flex gap-2 items-center flex-wrap"><i data-lucide="sparkles" class="w-4"></i>Vision AI detectó:${(a.tags||[]).map(t=>`<span class="bg-white rounded-full px-2 py-0.5">${t}</span>`).join('')}</div>`:''}
 ${lb('Título')}<input class="inp" maxlength="60" value="${esc(D.t)}" oninput="PUB.t=this.value">
 ${lb('Categoría')}<select class="inp" onchange="PUB.cat=this.value">${CATS.slice(1).map(c=>`<option ${D.cat==c[0]?'selected':''}>${c[0]}</option>`).join('')}</select>
 ${lb('Estado')}<div class="flex gap-2 mt-1">${['Nuevo','Semi nuevo','Usado'].map(c=>`<button onclick="PUB.cond='${c}';R(1)" class="chip ${D.cond==c?'on':''}">${c}</button>`).join('')}</div>
 ${lb('¿Para qué carreras sirve?')}<div class="flex flex-wrap gap-2 mt-1">${CARR.slice(1).map(c=>`<button onclick="togCar('${c}')" class="chip ${(D.car||[]).includes(c)?'on':''}">${c}</button>`).join('')}</div><p class="text-[11px] text-slate-400 mt-1">Sin selección = sirve para todas las carreras.</p>
 ${lb('¿Qué quieres hacer?')}<div class="grid grid-cols-3 gap-2 mt-1">${[['venta','Vender'],['alquiler','Alquilar'],['ambos','Ambos']].map(x=>`<button onclick="PUB.mode='${x[0]}';R(1)" class="py-2.5 rounded-xl border-2 text-sm font-bold ${D.mode==x[0]?'border-brand bg-blue-50 text-brand':'border-slate-100 text-slate-500'}">${x[1]}</button>`).join('')}</div>
 ${D.mode!='alquiler'?`${lb('Precio de venta (S/)')}<input type="number" class="inp" value="${D.price}" oninput="PUB.price=this.value">${a&&a.price?`<button onclick="PUB.price=${a.price};R(1)" class="text-[11px] text-purple-600 font-semibold -mt-2 mb-2">✨ Sugerido por IA: ${sol(a.price)} · rango ${sol(Math.round(a.price*.9))} – ${sol(Math.round(a.price*1.08))}</button>`:''}`:''}
 ${D.mode!='venta'?`${lb('Alquiler por día (S/)')}<input type="number" class="inp" value="${D.rent}" oninput="PUB.rent=this.value">${a&&a.rent?`<button onclick="PUB.rent=${a.rent};R(1)" class="text-[11px] text-purple-600 font-semibold -mt-2 mb-2">✨ Sugerido por IA: ${sol(a.rent)}/día</button>`:''}${lb('Depósito de garantía (S/)')}<input type="number" class="inp" value="${D.dep}" oninput="PUB.dep=this.value">`:''}
 ${lb('Punto de entrega')}<select class="inp" onchange="PUB.cp=this.value">${CAMP.map((c,i)=>`<option value="${i}" ${D.cp==i?'selected':''}>${c}</option>`).join('')}</select>
 ${lb('Descripción')}<textarea class="inp h-24" oninput="PUB.desc=this.value">${esc(D.desc)}</textarea>`;
 return hd('Publicar con IA')+`<div class="p-5 pb-28">
 <div class="rounded-2xl p-4 text-white flex gap-3 items-center" style="background:linear-gradient(135deg,#6d28d9,#db2777)"><i data-lucide="sparkles" class="w-8 h-8 shrink-0"></i><div><p class="font-bold">Vision AI</p><p class="text-xs opacity-90">Elige una foto y la IA completa título, estado, descripción y precio sugerido.</p></div></div>
 <h3 class="font-bold mt-5 mb-2 text-sm">Fotos de ejemplo</h3>
 <div class="flex gap-3 overflow-x-auto no-sb pb-1">${SAMPLES.map((x,i)=>`<button onclick="pickS(${i})" class="shrink-0 w-24 text-center"><span class="block w-24 h-24 rounded-2xl overflow-hidden border-2 ${D.ph.includes(x.ph)?'border-purple-500':'border-transparent'} shadow-sm"><img src="${src(x.ph)}" alt="Foto de ejemplo ${i+1}" class="w-full h-full object-cover"></span><span class="text-[11px] font-semibold">${x.l}</span></button>`).join('')}
 <label class="shrink-0 w-24 text-center cursor-pointer"><span class="grid place-items-center w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400"><i data-lucide="camera" class="w-7"></i></span><span class="text-[11px] font-semibold">Mi galería</span><input type="file" accept="image/*" class="hidden" onchange="upF(this)"></label></div>
 ${D.ph.length?`<div class="flex gap-2 mt-3 overflow-x-auto no-sb">${D.ph.map((f,i)=>`<div class="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden"><img src="${src(f)}" alt="Foto ${i+1} del producto" class="w-full h-full object-cover"><button onclick="PUB.ph.splice(${i},1);R(1)" aria-label="Quitar" class="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-none">×</button></div>`).join('')}</div>${form}`:'<p class="text-center text-slate-400 text-sm py-10">Elige una foto para empezar ✨</p>'}</div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3"><button class="btn" onclick="pubGo()">Publicar ahora</button></div>`}};
/* =================== LÓGICA =================== */
function loginLocal(){const n=(($('#un')||{}).value||'').trim();if(n.length<2)return $('#er').textContent='Escribe tu nombre (mínimo 2 letras).';liveJoin(n);root('home')}
function dots(){const c=$('#car'),d=$('#dots');if(!c||!d)return;const i=Math.round(c.scrollLeft/c.clientWidth);d.innerHTML=[...c.children].map((_,n)=>`<span class="w-2 h-2 rounded-full ${n==i?'bg-white':'bg-white/50'}"></span>`).join('')}
function sh(){const s=$('#sheet');s.dataset.o=s.dataset.o=='1'?'':'1';s.style.transform=s.dataset.o?'translateY(0)':'translateY(calc(100% - 230px))'}
/* Home: filtros y grilla (el buscador conserva el foco al escribir) */
const HL=()=>{const g=G.find(x=>x[0]==F.cat);return PR.filter(p=>(F.tab=='Todo'||p.mode==F.tab.toLowerCase()||p.mode=='ambos')&&(!g||g[2].includes(p.cat))&&(F.car=='Todas'||carOk(p))&&(F.cond=='Todos'||p.cond==F.cond)&&p.status!='sold'&&(F.cp<0||SEL[p.s].cp==F.cp)&&p.t.toLowerCase().includes(F.q.toLowerCase())).sort((a,b)=>F.sort=='d'?a.d-b.d:F.sort=='p'?(a.price||a.rent)-(b.price||b.rent):b.ts-a.ts)};
const gridH=l=>(window.io&&LV.me&&LV.ld.p)?skGrid(6):l.map(card).join('')||EMPTYQ()||`<div class="col-span-2 text-center text-slate-400 py-8"><p>😕 Sin resultados.</p><button onclick="aiOpen(F.q||'Ayúdame a encontrar algo')" class="mt-3 px-4 py-2 rounded-full text-white text-sm font-semibold" style="background:linear-gradient(135deg,#7c3aed,#ec4899)">✨ Preguntar a U2U AI</button></div>`;
function gridR(){const l=HL();$('#grid').innerHTML=gridH(l);$('#cnt').textContent=l.length+' resultado'+(l.length==1?'':'s');lucide.createIcons()}
function filtM(){M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg mb-3">Filtrar por campus</p><div class="flex flex-wrap gap-2">${[-1,0,1,2,3].map(i=>`<button class="chip ${F.cp==i?'on':''}" onclick="F.cp=${i};X();R(1)">${i<0?'🎓 Todos':CAMP[i]}</button>`).join('')}</div><button class="btn mt-5" onclick="X()">Listo</button></div>`)}
/* Mapa real de Lima */
const mapL=()=>PR.filter(p=>(F.tab=='Todo'||p.mode==F.tab.toLowerCase()||p.mode=='ambos')&&p.t.toLowerCase().includes(F.q.toLowerCase())&&p.status!='sold'&&(F.cond=='Todos'||p.cond==F.cond)&&(F.car=='Todas'||carOk(p))&&(F.cp<0||SEL[p.s].cp==F.cp)).sort((a,b)=>a.d-b.d);
function initMap(mini){const el=$(mini?'#mini-map':'#map');if(!el)return;
 if(!window.L){el.innerHTML='<div class="h-full grid place-items-center text-xs text-slate-400 bg-slate-100">Mapa no disponible sin conexión</div>';return}
 const m=L.map(el,{zoomControl:false,attributionControl:!mini,dragging:!mini,touchZoom:!mini,scrollWheelZoom:!mini,doubleClickZoom:!mini,boxZoom:false,keyboard:false}).setView(!mini&&F.cp>=0?LL[F.cp]:[-12.07,-77.02],mini?11:(F.cp>=0?14:12));
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(m);
 L.circleMarker([-12.079,-77.0905],{radius:8,color:'#fff',weight:3,fillColor:'#3b82f6',fillOpacity:1}).addTo(m);
 CAMP.forEach((c,i)=>{const n=PR.filter(p=>SEL[p.s].cp==i).length;if(mini){L.circleMarker(LL[i],{radius:5,color:'#fff',weight:2,fillColor:'#1e2a78',fillOpacity:1}).addTo(m);return}
  L.marker(LL[i],{zIndexOffset:500,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="campus ${F.cp==i?'on':''}">🎓 ${c.replace('UPC ','')} · ${n}</div>`})}).addTo(m).on('click',()=>{F.cp=F.cp==i?-1:i;R()})});
 (mini?HL():mapL()).forEach(p=>{const sale=p.mode=='venta'||(p.mode=='ambos'&&F.tab!='Alquiler'),c=sale?'#10b981':'#0ea5e9',ll=pll(p);
  if(mini){L.circleMarker(ll,{radius:6,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).addTo(m);return}
  L.marker(ll,{icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="pin" style="border-color:${c};color:${c}">S/${Math.round(sale?p.price:p.rent)}${sale?'':'/d'}</div>`})}).addTo(m).on('click',()=>openP(p.id))});
 setTimeout(()=>m.invalidateSize(),60)}
/* Chat con respuestas simuladas */
function chatR(id){const m=$('#ml');if(!m)return;m.innerHTML=(ST.chats[id]||[]).map(x=>`<div class="flex ${x.m?'justify-end':''}"><div class="max-w-[75%] px-3 py-2 rounded-2xl text-sm ${x.m?'bg-brand text-white rounded-br-sm':'bg-white border rounded-bl-sm'}">${esc(x.t)}<p class="text-[9px] opacity-60 text-right">${x.h}</p></div></div>`).join('')||'<p class="text-center text-xs text-slate-400 mt-10">Escribe o usa una respuesta rápida para empezar.</p>';m.scrollTop=m.scrollHeight}
function send(id,t){const i=$('#ci');t=t||(i&&i.value.trim());if(!t)return;(ST.chats[id]=ST.chats[id]||[]).push({m:1,t,h:hm()});if(i)i.value='';save();chatR(id);
 const p=P(id),m=$('#ml');m.insertAdjacentHTML('beforeend','<p id="tp" class="text-xs text-slate-400">escribiendo...</p>');m.scrollTop=m.scrollHeight;
 setTimeout(()=>{const l=t.toLowerCase(),o=l.match(/ofrezco s\/\s*(\d+)/);let r='¡Hola! Sí, sigue disponible 😊';
  if(o){const v=+o[1],min=p.price*.85;if(v>=min){ST.off[id]=v;r=`¡Trato hecho por ${sol(v)}! Ya puedes comprar a ese precio 🎉`}else r=`Gracias por tu oferta. Lo mínimo que puedo aceptar es ${sol(Math.round(p.price*.92))}.`}
  else if(/dónde|donde|encuentro/.test(l))r=`Podemos vernos en ${CAMP[SEL[p.s].cp]}, frente a la biblioteca.`;else if(/oferta|rebaja|precio/.test(l))r='Podría rebajar un poco. ¿Cuánto ofreces?';
  (ST.chats[id]).push({m:0,t:r,h:hm()});save();if(S.s=='chat'&&S.a==id)chatR(id)},1200)}
function offerM(id){const p=P(id);M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg">Hacer una oferta</p><p class="text-xs text-slate-500">Precio publicado: ${sol(p.price)}</p><input id="of" type="number" class="inp mt-3" value="${Math.round(p.price*.9)}"><div class="flex gap-2 mb-3">${[5,10,15].map(x=>`<button class="chip" onclick="of.value=${Math.round(p.price*(1-x/100))}">-${x}%</button>`).join('')}</div><button class="btn" onclick="X();offerSend(${id},of.value)">Enviar oferta</button><button class="w-full py-3 text-slate-500" onclick="X()">Cancelar</button></div>`)}
/* Checkout y pago */
const days=()=>Math.max(1,Math.round((new Date(CO.to)-new Date(CO.from))/864e5)+1);
function startCO(id,mode){if(!coOk(id,mode))return;CO={id,mode,from:fd(1),to:fd(3),del:'meet',cp:SEL[P(id).s].cp,pay:'visa',terms:false};nav('co')}
function pay(tot){if(window.io&&LV.me)return payLive();M('<div class="bg-white w-full rounded-t-3xl p-8 text-center"><div class="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div><p class="font-bold mt-4">Procesando pago...</p></div>');
 setTimeout(()=>{const p=P(CO.id),code='#U2U-'+Math.floor(1e5+Math.random()*9e5);ST.orders.unshift({code,pin:String(1000+Math.floor(Math.random()*9000)),id:CO.id,k:CO.mode,tot,cp:CO.cp,del:CO.del,st:0,d:new Date().toLocaleDateString('es-PE')});save();
  M(`<div class="bg-white w-full rounded-t-3xl p-7 text-center pop"><div class="w-16 h-16 bg-emerald-100 text-mint rounded-full grid place-items-center mx-auto"><i data-lucide="check" class="w-9 h-9"></i></div><p class="font-extrabold text-xl mt-3">¡Compra exitosa!</p><p class="text-sm text-slate-500">Código <b>${code}</b>. Coordina la entrega con ${SEL[p.s].n} y lleva tu carné UPC.</p><button class="btn mt-5" onclick="X();PT='ord';root('profile')">Ver mi pedido</button><button class="w-full py-3 text-slate-500" onclick="X();root('home')">Seguir explorando</button></div>`)},2000)}
const STS=['Pago confirmado','Coordinando entrega','Entregado','Finalizado'];
function orderC(o,i){const p=P(o.id);return `<div class="border rounded-2xl p-3 mb-3"><div class="flex gap-3"><div class="w-14 h-14 rounded-xl overflow-hidden">${pic(p)}</div><div class="flex-1"><p class="font-bold text-sm">${esc(p.t)}</p><p class="text-xs text-slate-500">${o.code} · ${o.d} · ${o.k=='venta'?'Compra':'Alquiler'}</p><b class="text-brand text-sm">${sol(o.tot)}</b></div></div>
 ${o.pin?`<div class="mt-2 text-xs bg-blue-50 rounded-xl p-2">🔐 Código de entrega: <b class="tracking-widest text-sm">${o.pin}</b> · compártelo al recibir, con tu carné UPC</div>`:''}<div class="mt-3 text-xs">${STS.map((s,n)=>`<div class="flex items-center gap-2 py-0.5 ${n<=o.st?'text-brand font-semibold':'text-slate-400'}"><i data-lucide="${n<=o.st?'check-circle-2':'circle'}" class="w-4"></i>${s}</div>`).join('')}</div>
 ${o.st<3?`<button class="chip mt-2" onclick="ST.orders[${i}].st++;save();R(1)">Avanzar estado (demo)</button>`:'<p class="text-xs text-slate-400 mt-2">Pedido de demostración: las reseñas reales se hacen con pedidos confirmados con código.</p>'}</div>`}
/* Publicar con Vision AI */
const SAMPLES=[
{l:'Dron',ph:'dron',a:{t:'Dron DJI Mini 2 SE',cat:'Cámaras',cond:'Semi nuevo',mode:'ambos',price:1850,rent:100,dep:350,tags:['Dron','Cámara 2.7K','Baterías'],desc:'Dron plegable con cámara 2.7K, ideal para topografía y tomas aéreas de proyectos. Incluye 2 baterías, control y estuche.'}},
{l:'Cámara',ph:'cam2',a:{t:'Cámara mirrorless 24 MP',cat:'Cámaras',cond:'Usado',mode:'ambos',price:1400,rent:50,dep:180,tags:['Mirrorless','24 MP','Lente kit'],desc:'Cámara mirrorless con lente kit para audiovisuales y fotografía. Incluye batería y cargador.'}},
{l:'Monitor',ph:'monitor',a:{t:'Monitor 24" Full HD',cat:'Laptops',cond:'Usado',mode:'venta',price:320,tags:['Monitor','1080p','HDMI'],desc:'Monitor Full HD en buen estado, sin píxeles muertos. Ideal para segunda pantalla.'}},
{l:'Libros',ph:'pack',a:{t:'Pack de libros de Estática',cat:'Libros',cond:'Usado',mode:'ambos',price:60,rent:12,dep:30,tags:['Libros','Ingeniería'],desc:'Pack de libros de estática y resistencia de materiales, con pocas marcas.'}},
{l:'Casco',ph:'casco',a:{t:'Casco de seguridad con barbiquejo',cat:'Herramientas',cond:'Nuevo',mode:'venta',price:30,tags:['Casco','EPP'],desc:'Casco certificado, requisito para visitas a obra y laboratorio.'}}];
function imgErr(el,e){el.outerHTML=`<div class="w-full h-full grid place-items-center text-5xl bg-blue-50">${e}</div>`}
function startPub(){PUB={ph:[],t:'',cat:'Cámaras',cond:'Usado',desc:'',mode:'venta',price:'',rent:'',dep:'',cp:SEL[ME].cp,ai:null,car:[]};STEP=1;nav('publish')}
function pickS(i){const x=SAMPLES[i];if(PUB.ph.includes(x.ph)){PUB.ph=PUB.ph.filter(f=>f!=x.ph);return R(1)}PUB.ph.push(x.ph);aiScan(x.ph,x.a)}
function upF(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas'),k=Math.min(1,600/i.width);c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);const d=c.toDataURL('image/jpeg',.8);PUB.ph.push(d);aiScan(d,SAMPLES[Math.floor(Math.random()*SAMPLES.length)].a)};i.src=e.target.result};r.readAsDataURL(f)}
function aiScan(img,a){const st=['Detectando objeto…','Evaluando estado visual…','Comparando con publicaciones similares…','Calculando precio sugerido…','Redactando descripción…'];
 M(`<div class="bg-white w-full rounded-t-3xl p-6 pop text-center"><div class="relative w-44 h-44 mx-auto rounded-2xl overflow-hidden shadow-lg"><img src="${src(img)}" alt="Foto analizada por la IA" class="w-full h-full object-cover"><div class="scanl"></div></div><p class="font-bold text-lg mt-4 flex items-center justify-center gap-2"><i data-lucide="sparkles" class="w-5 text-purple-600"></i>Vision AI analizando</p><div id="ais" class="text-left text-sm mt-3 space-y-1.5 min-h-[120px]"></div></div>`);
 st.forEach((t,i)=>setTimeout(()=>{const e=$('#ais');if(!e)return;e.innerHTML=st.slice(0,i+1).map((x,n)=>`<p class="flex items-center gap-2 ${n<i?'text-slate-400':'text-slate-800 font-semibold'}"><i data-lucide="${n<i?'check-circle-2':'loader'}" class="w-4 ${n<i?'text-emerald-500':'text-purple-600 animate-spin'}"></i>${x}</p>`).join('');lucide.createIcons()},i*650));
 setTimeout(()=>{Object.assign(PUB,{t:a.t,cat:a.cat,cond:a.cond,mode:a.mode,price:a.price||'',rent:a.rent||'',dep:a.dep||'',desc:a.desc,ai:a});X();R(1);toast('✨ Vision AI completó tu publicación')},st.length*650+300)}
function pubGo(){const D=PUB;if(!D.ph.length)return toast('Elige al menos una foto');if(D.t.trim().length<3)return toast('Escribe un título');
 if((D.mode!='alquiler'&&!(+D.price>0))||(D.mode!='venta'&&!(+D.rent>0)))return toast('Ingresa los precios requeridos');
 PR.unshift({id:Date.now(),t:D.t.trim(),ph:D.ph,cat:D.cat,mode:D.mode,price:+D.price,rent:+D.rent,dep:+D.dep||0,cond:D.cond,d:0.3,s:ME,x:50,y:44,ts:99,desc:D.desc||'Sin descripción',e:'📦',car:[...(D.car||[])],own:LV.me&&LV.me.uid});SEL[ME].cp=+D.cp;save();shareProduct(PR[0]);PT='pub';root('profile');toast(sock&&sock.connected?'✅ Publicado en vivo para todos los conectados':'✅ Publicado · U2U AI lo sugerirá a 18 estudiantes')}
/* ===== U2U AI (simulada, funciona sin conexión) ===== */
const mkt=p=>(((p.id*37)%31)-8);
const fairPct=p=>p.price?Math.round(mkt(p)/(100+mkt(p))*100):0;
const fairB=p=>fairPct(p)>=10?'<span class="ml-1 text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full align-middle">✨ Buen precio</span>':'';
function aiCard(p){const s2=SEL[p.s],k=fairPct(p),be=p.price&&p.rent?Math.ceil(p.price/p.rent):0,li=[];
 if(p.price){const m=Math.round(p.price/(1-k/100));li.push(k>=10?`Está <b>${k}% por debajo</b> del precio de mercado (≈ ${sol(m)}). Buen momento para comprar.`:k<=-5?`Está algo sobre el mercado (≈ ${sol(m)}). Prueba <b>hacer una oferta</b>.`:`Precio alineado al mercado (≈ ${sol(m)}).`)}
 if(be)li.push(`Si lo usarás menos de <b>${be} días</b>, alquilar sale más barato que comprar.`);
 if(p.rent&&p.dep)li.push(`Depósito de ${sol(p.dep)} reembolsable al devolverlo en buen estado.`);
 {const rr=rtOf(p.s);li.push(rr.count?`${s2.n.split(' ')[0]} tiene ${rr.avg.toFixed(1)}★ en ${rr.count} reseña${rr.count>1?'s':''} verificada${rr.count>1?'s':''} y entrega en ${CAMP[s2.cp]}.`:`${s2.n.split(' ')[0]} aún no tiene reseñas; entrega en ${CAMP[s2.cp]}.`)}
 return `<div class="mt-4 rounded-2xl p-4 border border-purple-100" style="background:linear-gradient(135deg,#faf5ff,#fdf2f8)"><p class="text-xs font-bold text-purple-700 flex items-center gap-1 mb-2"><i data-lucide="sparkles" class="w-4"></i>Análisis de U2U AI</p><ul class="text-[13px] text-slate-700 space-y-1.5">${li.map(x=>`<li class="flex gap-2"><span class="text-purple-400">•</span><span>${x}</span></li>`).join('')}</ul></div>`}
function aiChips(p){const c=['¿Sigue disponible?','¿Dónde nos vemos?'];c.push(p.price?'Ofrezco S/ '+Math.round(p.price*.9):'¿Aceptas alquilar 3 días?');return c}
function nGo(id){X();id>=0?openP(id):root('profile')}
function notifM(){const n=[['sparkles','Bajó el precio','El dron DJI Mini 3 Pro bajó de S/ 2,200 a S/ 2,100',10],['map-pin','Nuevo en San Miguel','Juan publicó un nivel de ingeniero Topcon para alquilar',24],['tag','Alerta de precio','Calculadora HP Prime ahora también en alquiler: S/ 25/día',19]];
 M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg mb-2 flex items-center gap-2">Notificaciones <span class="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">✨ filtradas por IA</span></p>${n.map(a=>`<div onclick="nGo(${a[3]})" class="flex gap-3 py-3 border-b cursor-pointer"><span class="w-9 h-9 rounded-full bg-blue-50 text-brand grid place-items-center shrink-0"><i data-lucide="${a[0]}" class="w-4"></i></span><div><p class="font-semibold text-sm">${a[1]}</p><p class="text-xs text-slate-500">${a[2]}</p></div></div>`).join('')}</div>`)}
let AIC=[{r:'ai',t:'¡Hola Jared! Soy U2U AI ✨. Dime qué necesitas (curso, presupuesto o campus) y busco las mejores opciones en los 4 campus de UPC.',n:999,c:[]}],AIB=0;
const nrm=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const STOP='para tengo busco algo necesito quiero hasta soles campus estoy dame recomiendas recomienda conviene alquilar comprar alquiler donde como unos unas este esta pero mejor barato cerca miguel monterrico isidro villa ayudame encontrar quien tiene'.split(' ');
const SYN=[[/topograf|terreno|aere|mapeo|nivelac/,'dron nivel camara'],[/calcul|examen|ecuacion/,'calculadora'],[/obra|visita|campo/,'casco botas'],[/laborator|quimic|medic|salud/,'mandil scrub'],[/plano|dibuj|arquitect|maqueta/,'regla escalimetro dibujo'],[/program|software|codigo|laptop|computad/,'macbook ipad monitor teclado arduino'],[/film|corto|video|foto|audiovis|graba/,'camara tripode microfono dron'],[/costur|moda/,'maquina coser'],[/libro|apunte|estudi|curso|hidraul|costos/,'libro apuntes libros'],[/ilustr|diseno/,'wacom tablet ipad']];
function aiFind(q){const n=nrm(q);
 if(/^(hola|buenas|hey)/.test(n))return{t:'¡Hola! ¿Qué necesitas hoy? Puedo buscar por curso, presupuesto o campus.',c:[]};
 if(/public|subir|vender mi/.test(n)&&!/compr/.test(n))return{t:'Toca el botón + y elige una foto: Vision AI detecta el artículo, completa título, estado y descripción, y te sugiere el precio ✨',c:[]};
 const b=n.match(/(?:s\/\s*)(\d{2,5})|(\d{2,5})\s*soles|(?:hasta|tengo|con)\s*(\d{2,5})/)||[],B=+(b[1]||b[2]||b[3])||0,cp=CAMP.findIndex(c=>n.includes(nrm(c.replace('UPC ','')))),rent=/alquil|prestad|temporal/.test(n),buy=/compr|quedarme/.test(n);
 let ex=n;SYN.forEach(x=>{if(x[0].test(n))ex+=' '+x[1]});
 const tk=ex.split(/\W+/).filter(w=>w.length>3&&!/^\d+$/.test(w)&&!STOP.includes(w));
 const l=PR.map(p=>{const h=nrm(p.t+' '+p.desc+' '+p.cat);let sc=tk.length?0:1;tk.forEach(w=>{if(h.includes(w))sc+=2});return{p,sc,pr:rent?(p.rent||0):(p.price||p.rent||0)}}).filter(o=>o.sc>0&&(!B||(o.pr&&o.pr<=B))&&(cp<0||SEL[o.p.s].cp==cp)&&(!rent||o.p.mode!='venta')&&(!buy||o.p.mode!='alquiler')).sort((a,b)=>b.sc-a.sc||a.p.d-b.p.d);
 if(!l.length)return{t:'No encontré coincidencias exactas 😕. Prueba con otra palabra o publica tu pedido: avisaremos a estudiantes de los 4 campus.',c:[]};
 const top=l.slice(0,3).map(o=>o.p),p0=top[0];
 let t=`Encontré ${l.length} ${l.length>1?'opciones':'opción'} ${cp>=0?'en '+CAMP[cp]:'en los 4 campus'}${B?' hasta '+sol(B):''}. ${top.length>1?'Estas son las mejores:':'La mejor es:'}`;
 if(p0.price&&p0.rent&&!rent&&!buy)t+=` Tip: si usarás "${p0.t}" menos de ${Math.ceil(p0.price/p0.rent)} días, alquilarlo sale más barato.`;
 else if(fairPct(p0)>=10)t+=` "${p0.t}" está ${fairPct(p0)}% bajo el precio de mercado.`;
 return{t,c:top.map(p=>p.id)}}
function aiAsk(q){q=(q||'').trim();if(!q)return;AIC.push({r:'u',t:q});AIB=1;aiR();setTimeout(()=>{const r=aiFind(q);AIB=0;const m={r:'ai',t:r.t,c:r.c,n:0};AIC.push(m);const iv=setInterval(()=>{m.n+=3;aiR();if(m.n>=m.t.length)clearInterval(iv)},18)},900)}
function aiR(){const b=$('#aim');if(!b)return;
 b.innerHTML=AIC.map(m=>m.r=='u'?`<div class="flex justify-end"><div class="max-w-[80%] bg-brand text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">${esc(m.t)}</div></div>`:`<div class="flex gap-2"><span class="w-7 h-7 shrink-0 rounded-full grid place-items-center text-white" style="background:linear-gradient(135deg,#7c3aed,#ec4899)"><i data-lucide="sparkles" class="w-3.5"></i></span><div class="max-w-[85%]"><div class="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm leading-relaxed">${esc(m.t.slice(0,m.n))}${m.n<m.t.length?'<span class="animate-pulse">▍</span>':''}</div>${m.n>=m.t.length?(m.c||[]).map(id=>{const p=P(id);return `<div onclick="X();openP(${id})" class="mt-2 flex gap-3 items-center bg-white border rounded-xl p-2 cursor-pointer active:scale-[.98]"><div class="w-14 h-14 rounded-lg overflow-hidden shrink-0">${pic(p)}</div><div class="min-w-0"><p class="text-sm font-bold truncate">${esc(p.t)}</p><p class="text-brand font-extrabold text-sm">${price(p)}</p><p class="text-[11px] text-slate-500">📍 ${CAMP[SEL[p.s].cp]}</p></div></div>`}).join(''):''}</div></div>`).join('')
 +(AIB?'<div class="flex gap-1 pl-9">'+[0,.15,.3].map(d=>`<span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:${d}s"></span>`).join('')+'</div>':'');
 b.scrollTop=b.scrollHeight;lucide.createIcons()}
function aiOpen(q){M(`<div class="bg-white w-full rounded-t-3xl flex flex-col pop" style="height:84%"><div class="px-5 pt-4 pb-3 border-b flex items-center gap-3"><span class="w-9 h-9 rounded-full grid place-items-center text-white" style="background:linear-gradient(135deg,#7c3aed,#ec4899)"><i data-lucide="sparkles" class="w-5"></i></span><div class="flex-1"><p class="font-bold leading-tight">U2U AI</p><p class="text-[11px] text-emerald-500 font-semibold">● Busca en los 4 campus</p></div><button onclick="X()" aria-label="Cerrar"><i data-lucide="x"></i></button></div><div id="aim" class="flex-1 overflow-y-auto no-sb p-4 space-y-3"></div><div class="flex gap-2 overflow-x-auto no-sb px-4 pt-2">${['Algo para topografía','Tengo S/ 100','Para filmar un corto','Alquiler en San Miguel'].map(c=>`<button class="chip" onclick="aiAsk('${c}')">${c}</button>`).join('')}</div><div class="flex gap-2 p-3 pb-5"><input id="aiq" onkeydown="if(event.key=='Enter'){aiAsk(this.value);this.value=''}" placeholder="Pregunta lo que quieras…" class="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none"><button onclick="const i=$('#aiq');aiAsk(i.value);i.value=''" aria-label="Enviar" class="w-12 h-12 rounded-full text-white grid place-items-center" style="background:linear-gradient(135deg,#7c3aed,#ec4899)"><i data-lucide="send" class="w-5"></i></button></div></div>`);aiR();if(q)aiAsk(q)}
/* Bottom sheet: el arrastre vertical del tirador abre/cierra */
document.addEventListener('pointerdown',e=>{const h=e.target.closest('#hdl');if(h)h.y0=e.clientY,window._h=h});
document.addEventListener('pointerup',e=>{const h=window._h;if(h&&Math.abs(e.clientY-h.y0)>30){const o=$('#sheet').dataset.o=='1';if((e.clientY<h.y0)!=o)sh()}window._h=null});
new MutationObserver(()=>{if(S.s=='chat')chatR(S.a)}).observe($('#v'),{childList:true});
/* ===== V6: enfoque UPC ===== */
const SD=[{d:'Entrega en punto seguro del campus',i:'🏛️',pt:'Biblioteca y patio central'},{d:'Entrega en punto seguro del campus',i:'🏢',pt:'Lobby y cafetería'},{d:'Entrega en punto seguro del campus',i:'🌿',pt:'Rotonda y biblioteca'},{d:'Entrega en punto seguro del campus',i:'🌊',pt:'Cafetería y hall principal'}];
const CIC=['7mo','8vo','9no','6to','8vo','9no','6to','7mo','8vo','5to'];SEL.forEach((s,i)=>s.ci=CIC[i%10]);
const CARR=['Todas','Ing. Civil','Arquitectura','Sistemas','Negocios','Comunicaciones','Diseño de Moda','Salud'];
const C1='Ing. Civil',AR='Arquitectura',CM='Comunicaciones',SW='Sistemas',NG='Negocios',MO='Diseño de Moda',SA='Salud';
const PCAR={1:[CM],2:[SW,AR,CM,NG],3:[CM],4:[C1,SW,NG],5:[MO],6:[AR,C1],7:[AR],8:[CM],9:[C1],10:[C1,AR,CM],11:[C1],12:[C1],13:[AR,MO,SW],14:[SA],15:[C1],16:[SW],17:[SW,C1,NG],18:[C1,NG],19:[C1,SW,NG],20:[SA],21:[SW,NG],22:[MO,CM,AR],23:[AR,C1],24:[C1]};
function sedeM(){M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><p class="font-bold text-lg mb-3">¿En qué sede estás?</p>${[-1,0,1,2,3].map(i=>`<div onclick="F.cp=${i};X();R(1)" class="flex items-center gap-3 border-2 rounded-2xl p-3 mb-2 cursor-pointer ${F.cp==i?'border-brand bg-blue-50':'border-slate-100'}"><span class="text-2xl">${i<0?'🎓':SD[i].i}</span><div><b class="text-sm">${i<0?'Todas las sedes':CAMP[i]}</b><p class="text-xs text-slate-500">${i<0?'Ver artículos de los 4 campus':SD[i].d}</p></div></div>`).join('')}</div>`)}
V.sedes=()=>hd('Sedes UPC')+`<div class="p-5 pb-10"><p class="text-sm text-slate-500 mb-4">Compra y vende dentro de tu campus: sin envíos y con entrega en puntos seguros.</p>${SD.map((s,i)=>{const n=PR.filter(p=>SEL[p.s].cp==i).length;return `<div class="border rounded-2xl p-4 mb-3"><div class="flex items-center gap-3"><span class="text-3xl">${s.i}</span><div class="flex-1"><b>${CAMP[i]}</b><p class="text-xs text-slate-500">${s.d}</p></div><span class="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800">${n} artículos</span></div><p class="text-xs mt-3 bg-emerald-50 text-emerald-800 rounded-xl p-2">🛡️ Punto seguro: ${s.pt}</p><div class="grid grid-cols-2 gap-2 mt-3"><button class="btn !py-2 !text-sm" onclick="F.cp=${i};root('home')">Ver artículos</button><button class="btn !py-2 !text-sm !bg-white !text-brand border border-brand" onclick="F.cp=${i};root('map')">Ver en mapa</button></div></div>`}).join('')}</div>`;
let AH=65;function ahR(){const v=+$('#ahc').value||0;$('#aho').textContent=sol(Math.round(v*AH/100));$('#ahp').textContent=AH+'%'}
function ahorroM(){M(`<div class="bg-white w-full rounded-t-3xl p-6 pop"><p class="font-bold text-lg">Calculadora de ahorro</p><p class="text-xs text-slate-500 mb-3">¿Cuánto gastarías en tienda para este ciclo?</p><input id="ahc" type="number" class="inp" value="700" oninput="ahR()"><label class="text-xs font-semibold">Ahorro estimado vs. tienda: <b id="ahp"></b> (supuesto editable)</label><input type="range" min="30" max="80" value="${AH}" class="w-full my-2" oninput="AH=this.value;ahR()"><div class="bg-emerald-50 rounded-2xl p-4 text-center"><p class="text-xs text-emerald-800 font-semibold">Tu ahorro estimado con U2U</p><p id="aho" class="text-3xl font-black text-emerald-600"></p></div><button class="btn mt-4" onclick="X()">Listo</button></div>`);ahR()}
function manifM(){M(`<div class="bg-white w-full rounded-t-3xl p-6 pop max-h-[85%] overflow-y-auto no-sb"><p class="font-bold text-lg">💡 Manifiesto U2U · UPC</p><div class="text-sm text-slate-700 leading-relaxed space-y-2 mt-3"><p>U2U es una plataforma digital peruana pensada para reducir el costo de los materiales universitarios, enfocada en la <b>Universidad Peruana de Ciencias Aplicadas</b> y sus <b>4 sedes</b>: Monterrico, San Isidro, Villa y San Miguel.</p><p><b>Ciclos avanzados:</b> rentabilizan libros, calculadoras, cámaras y herramientas que ya no usan.</p><p><b>Ciclos iniciales:</b> compran o alquilan equipos a precios justos sin salir del campus.</p><p>Así fomentamos el ahorro estudiantil y una comunidad basada en el consumo responsable y la reutilización.</p></div><button class="btn mt-4" onclick="X()">Cerrar</button></div>`)}
/* ===================== V8: TIEMPO REAL (Socket.io) ===================== */
/* Si /socket.io/socket.io.js no carga (archivo abierto sin servidor), la app sigue en modo local simulado. */
const LV={ld:{p:0,h:0,o:0},me:null,pref:null,idc:null,convs:{},orders:{},pres:{total:0,uids:[]},chips:[],rep:new Set(),rt:{},rv:{},rl:{},adm:false,rpt:null};
let sock=null,MT='chats';
try{LV.pref=JSON.parse(localStorage.getItem('u2u7')||'null')}catch(e){}
PR.forEach(p=>{if(p.cond=='Como nuevo')p.cond='Semi nuevo'});
const uname=()=>LV.me?LV.me.name:'Jared',tm=ts=>new Date(ts).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
/* identidad por dispositivo: uid público + secreto privado. El servidor solo deja entrar con ambos,
   así nadie puede suplantarte para leer tus chats ni tus pedidos. (Dos personas = dos dispositivos o navegadores.) */
const rnd=n=>{const a=new Uint8Array(n);try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<n;i++)a[i]=Math.random()*256}return[...a].map(b=>b.toString(16).padStart(2,'0')).join('')};
function myId(fresh){if(fresh)LV.idc=null;if(LV.idc)return LV.idc;try{if(!fresh)LV.idc=JSON.parse(localStorage.getItem('u2uid')||'null')}catch(e){}
 if(!LV.idc||!LV.idc.uid||!LV.idc.secret){LV.idc={uid:'u_'+rnd(5),secret:rnd(16)};try{localStorage.setItem('u2uid',JSON.stringify(LV.idc))}catch(e){}}return LV.idc}
const myUid=()=>myId().uid,joinData=()=>({uid:LV.me.uid,secret:myId().secret,name:LV.me.name});
function liveJoin(name){if(window.io){LV.ld={p:1,h:1,o:1};clearTimeout(LV.ldT);LV.ldT=setTimeout(()=>{LV.ld={p:0,h:0,o:0};if(['home','msgs','profile'].includes(S.s))R(1)},6000)}SEL[ME].n=name;SEL[ME].uid=myUid();LV.me={uid:myUid(),name};LV.pref={name};try{localStorage.setItem('u2u7',JSON.stringify(LV.pref))}catch(e){}if(sock&&sock.connected)sock.emit('join',joinData())}

function liveStart(){if(!window.io)return;
 sock=io();
 sock.on('connect',()=>{netUI(0);if(LV.me)sock.emit('join',joinData());presUI()});
 sock.on('denied',()=>{if(LV.me)sessionOut('Tu sesión expiró. Inicia sesión de nuevo.')});
 sock.on('disconnect',()=>{netUI(1);presUI()});sock.on('connect_error',()=>netUI(1));sock.io.on('reconnect_attempt',()=>netUI(1));
 sock.on('presence',p=>{LV.pres=p;presUI()});
 sock.on('history',l=>{LV.ld.h=0;const old=LV.convs;LV.convs={};l.forEach(c=>{c.un=(old[c.key]&&old[c.key].un)||0;LV.convs[c.key]=c});if(S.s=='msgs')R(1);if(S.s=='lchat')lchatR(S.a);navDot()});
 sock.on('orders',l=>{LV.ld.o=0;LV.orders={};l.forEach(o=>LV.orders[o.id]=o);if(S.s=='msgs'||S.s=='profile')R(1);navDot()});
 sock.on('order',onOrder);
 sock.on('blocked',()=>sessionOut('Tu cuenta fue bloqueada por incumplir las normas de la comunidad.'));
 sock.on('removed',l=>(l||[]).forEach(id=>dropProduct(id)));
 sock.on('product-removed',d=>dropProduct(d.id,1));
 sock.on('reported',l=>{LV.rep=new Set((l||[]).map(Number));if(S.s=='detail')R(1)});
 sock.on('ratings',m=>{LV.rt=m||{};if(['detail','seller','profile'].includes(S.s))R(1)});
 sock.on('rating',d=>{LV.rt[d.uid]=d.count?{avg:d.avg,count:d.count}:undefined;delete LV.rv[d.uid];if(['detail','seller','profile'].includes(S.s))R(1)});
 sock.on('review:new',d=>toast('⭐ '+d.from+' te calificó con '+d.rating+'★'));
 sock.on('admin:reports',d=>{LV.rpt=d;if(S.s=='admin'||S.s=='profile')R(1)});
 sock.on('msg',onMsg);
 sock.on('products',l=>{LV.ld.p=0;onProducts(l);if(S.s=='home')gridR()});
 sock.on('new-product',onNewProduct);
 sock.on('product-status',d=>{const p=P(d.id);if(!p)return;p.status=d.status;refreshCatalog();if(S.s=='detail'&&S.a==d.id)R(1)})}

/* ---------- Chat privado por producto ---------- */
function onMsg(d){if(!LV.me)return;const k=d.conv.key;
 const c=LV.convs[k]||(LV.convs[k]={key:k,pid:d.conv.pid,buyerId:d.conv.buyerId,buyerName:d.conv.buyerName,msgs:[],un:0});
 if(c.msgs.some(m=>m.id==d.msg.id))return;c.msgs.push(d.msg);c.buyerName=d.conv.buyerName;
 const mine=d.msg.uid==LV.me.uid;
 if(S.s=='lchat'&&S.a==k)lchatR(k);
 else{if(!mine){c.un=(c.un||0)+1;toast('💬 '+d.msg.name+': '+d.msg.text.slice(0,40));try{navigator.vibrate&&navigator.vibrate(80)}catch(e){}}if(S.s=='msgs')R(1)}
 navDot()}
function openChat(pid){
 if(!window.io||!LV.me)return nav('chat',pid);
 const pp=P(pid);if(pp&&(pp.own==LV.me.uid||pp.s==ME))return toast('Esta es tu publicación: las consultas llegan a Mensajes');
 if(pp&&!pp.own)return toast('Producto de ejemplo: el chat funciona con publicaciones de otros estudiantes (botón +)');
 nav('lchat',pid+'|'+LV.me.uid)}
function offerSend(id,v){const t='Hola, te ofrezco S/ '+v+' por '+P(id).t;
 if(!window.io||!LV.me){nav('chat',id);return send(id,t)}
 const pp=P(id);if(pp&&(pp.own==LV.me.uid||pp.s==ME))return toast('Esta es tu publicación');
 if(pp&&!pp.own)return toast('Producto de ejemplo: las ofertas funcionan con publicaciones de otros estudiantes');
 const k=id+'|'+LV.me.uid;nav('lchat',k);lsend(k,t)}
function lsend(k,t){const i=$('#ci');t=(t||(i&&i.value)||'').trim();if(!t)return;
 if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 const[pid,bid]=k.split('|');
 sock.emit('send',{pid:+pid,buyerId:bid,text:t},r=>{if(r&&r.error)toast(r.error)});
 if(i){i.value='';i.focus()}}
V.lchat=key=>{const[pid,bid]=key.split('|'),p=P(pid)||{id:0,t:'Producto no disponible en este dispositivo',ph:[],e:'📦',mode:'venta',price:0,s:0},c=LV.convs[key],own=bid!=LV.me.uid,
 title=own?esc(c?c.buyerName:'Interesado'):esc(SEL[p.s].n);
 LV.chips=own?['¡Hola! Sí, sigue disponible 😊','Nos vemos en el punto seguro del campus','¿Cuánto ofreces?','¡Trato hecho! 🎉']:(p.id?aiChips(p):['¿Sigue disponible?']);
 return `<div class="h-full flex flex-col">${hd(title,'<span id="lst" class="text-xs font-semibold"></span>')}
 <div ${p.id?`onclick="openP(${p.id})"`:''} class="flex gap-3 items-center p-3 bg-slate-50 border-b cursor-pointer"><div class="w-12 h-12 rounded-lg overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${esc(p.t)}</p>${p.id?`<p class="text-xs text-brand font-bold">${price(p)}</p>`:''}</div></div>
 <div id="ml" class="flex-1 overflow-y-auto no-sb p-4 space-y-2 bg-slate-50"></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-3 pt-2 items-center"><span class="text-[10px] font-bold text-purple-600 shrink-0">${own?'⚡ Respuestas rápidas':'✨ IA sugiere'}</span>${LV.chips.map((q,i)=>`<button class="chip" onclick="lsend('${key}',LV.chips[${i}])">${esc(q)}</button>`).join('')}</div>
 <div class="flex gap-2 p-3"><input id="ci" onkeydown="event.key=='Enter'&&lsend('${key}')" autocomplete="off" placeholder="Escribe un mensaje..." class="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none"><button onclick="lsend('${key}')" aria-label="Enviar" class="bg-brand text-white rounded-full p-3"><i data-lucide="send" class="w-5"></i></button></div></div>`};
function lchatR(k){const m=$('#ml');if(!m)return;const c=LV.convs[k];if(c)c.un=0;
 m.innerHTML=c&&c.msgs.length?c.msgs.map(x=>{const me=x.uid==LV.me.uid;return `<div class="flex ${me?'justify-end':''}"><div class="max-w-[78%]">${me?'':`<p class="text-[10px] text-slate-400 ml-1">${esc(x.name)}</p>`}<div class="px-3 py-2 rounded-2xl text-sm break-words ${me?'bg-brand text-white rounded-br-sm':'bg-white border rounded-bl-sm'}">${esc(x.text)}<p class="text-[9px] opacity-60 text-right">${tm(x.ts)}</p></div></div></div>`}).join(''):'<p class="text-center text-xs text-slate-400 mt-10">Escribe o usa una respuesta rápida para empezar.</p>';
 m.scrollTop=m.scrollHeight;navDot()}

/* ---------- Pedidos con código de entrega ---------- */
const fpin=p=>p.slice(0,3)+' '+p.slice(3);
const STB={pending:['Pendiente de entrega','bg-amber-100 text-amber-700'],completed:['Entrega confirmada','bg-emerald-100 text-emerald-700'],cancelled:['Cancelado','bg-slate-100 text-slate-500']};
function coOk(id,mode){if(!window.io||!LV.me)return true;const p=P(id);
 if(p.own==LV.me.uid||p.s==ME)return toast('Esta es tu publicación'),false;
 if(!p.own)return toast('Producto de ejemplo: la compra con código funciona con publicaciones de otros estudiantes (botón +)'),false;
 if(p.status=='sold')return toast('Este producto ya fue vendido'),false;
 if(mode=='venta'&&p.status=='reserved')return toast('Otro estudiante ya inició la compra de este producto'),false;
 const m=mode=='alquiler'?'alquiler':'compra';
 if(Object.values(LV.orders).some(o=>o.pid==id&&o.buyerId==LV.me.uid&&o.mode==m&&o.status=='pending')){toast('Ya tienes un pedido pendiente por este producto');MT='orders';root('msgs');return false}
 return true}
function payLive(){if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 M('<div class="bg-white w-full rounded-t-3xl p-8 text-center"><div class="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div><p class="font-bold mt-4">Creando tu pedido...</p></div>');
 sock.emit('order:create',{pid:CO.id,mode:CO.mode=='alquiler'?'alquiler':'compra',del:CO.del,cp:CO.cp,from:CO.from,to:CO.to},r=>{
  if(!r||r.error){X();return toast((r&&r.error)||'No se pudo crear el pedido')}
  LV.orders[r.order.id]=r.order;pinModal(r.order);navDot()})}
function pinModal(o){M(`<div class="bg-white w-full rounded-t-3xl p-7 text-center pop"><div class="w-16 h-16 bg-emerald-100 text-mint rounded-full grid place-items-center mx-auto"><i data-lucide="check" class="w-9 h-9"></i></div>
 <p class="font-extrabold text-xl mt-3">${o.mode=='compra'?'¡Compra reservada!':'¡Alquiler reservado!'}</p><p class="text-xs text-slate-500">Pedido ${o.id} · ${sol(o.total)}</p>
 <div class="mt-4 rounded-2xl p-4" style="background:linear-gradient(135deg,#eef2ff,#e0f2fe)"><p class="text-[11px] font-semibold text-slate-600">🔐 Tu código de entrega</p><p class="text-4xl font-black tracking-[.25em] text-navy my-1 select-all">${fpin(o.pin)}</p></div>
 <p class="text-xs text-slate-600 mt-3 leading-snug">Quedan en verse en <b>${CAMP[o.cp]}</b>. Cuando <b>${esc(o.ownerName)}</b> te entregue el producto, <b>muéstrale o dícta este código</b>. Al ingresarlo en U2U se completa la transacción. No lo compartas antes.</p>
 <button class="btn mt-5" onclick="X();MT='orders';root('msgs')">Ver mi pedido</button><button class="w-full py-3 text-slate-500" onclick="X();root('home')">Seguir explorando</button></div>`)}
function onOrder(o){if(!LV.me)return;const old=LV.orders[o.id];LV.orders[o.id]=o;const me=LV.me.uid;
 if(!old&&o.ownerId==me)toast('🛒 '+o.buyerName+' quiere '+(o.mode=='compra'?'comprar':'alquilar')+': '+String(o.t).slice(0,26));
 else if(old&&old.status=='pending'&&o.status=='completed')showDone(o);
 else if(old&&old.status=='pending'&&o.status=='cancelled')toast('Pedido cancelado: '+String(o.t).slice(0,30));
 else if(old&&!old.locked&&o.locked&&o.ownerId==me)toast('Pedido bloqueado 5 min por intentos fallidos');
 if(['msgs','profile','detail'].includes(S.s))R(1);navDot()}
function showDone(o){const buyer=o.buyerId==LV.me.uid,k=o.mode=='compra'?'compra':'alquiler';
 M(`<div class="bg-white w-full rounded-t-3xl p-7 text-center pop"><div class="w-16 h-16 bg-emerald-100 text-mint rounded-full grid place-items-center mx-auto"><i data-lucide="check" class="w-9 h-9"></i></div><p class="font-extrabold text-xl mt-3">¡Entrega confirmada! 🎉</p>
 <p class="text-sm text-slate-500 mt-1">${buyer?`Recibiste <b>${esc(o.t)}</b> de ${esc(o.ownerName)}. Tu ${k} quedó completada.`:`Entregaste <b>${esc(o.t)}</b> a ${esc(o.buyerName)}. Tu ${k=='compra'?'venta':'alquiler'} quedó completada.`}</p>
 ${buyer?`<button class="btn mt-5" onclick="rate('${o.id}')">⭐ Calificar</button>`:''}<button class="w-full py-3 text-slate-500" onclick="X()">Listo</button></div>`)}
function confirmOrder(id){const i=document.querySelector(`.pin-in[data-o="${id}"]`),pin=((i&&i.value)||'').replace(/[^0-9]/g,'');
 if(pin.length!=6)return toast('Ingresa los 6 dígitos del código');
 if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 sock.emit('order:confirm',{id,pin},r=>{if(r&&r.error){toast(r.error);if(i)i.value=''}})}
async function cancelOrder(id){if(!await askConfirm({title:'¿Cancelar este pedido?',msg:'Se liberará el producto para otros estudiantes.',ok:'Sí, cancelar pedido',no:'Volver',danger:1,icon:'trash-2'}))return;if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 sock.emit('order:cancel',{id},r=>{if(r&&r.error)toast(r.error)})}
function orderChat(id){const o=LV.orders[id];if(!o)return;const k=o.pid+'|'+o.buyerId;
 if(o.buyerId!=LV.me.uid&&!LV.convs[k])return toast('El comprador aún no te escribió por chat');nav('lchat',k)}
function ordCard(o){const me=LV.me.uid,buyer=o.buyerId==me,sb=STB[o.status],pend=o.status=='pending',p=P(o.pid),
 kind=o.mode=='compra'?'Compra':'Alquiler · '+o.days+' día'+(o.days>1?'s':'');
 return `<div class="border rounded-2xl p-3 mb-3"><div class="flex gap-3"><div class="w-14 h-14 rounded-xl overflow-hidden shrink-0">${p?pic(p):'<div class="w-full h-full grid place-items-center text-3xl bg-blue-50">📦</div>'}</div>
 <div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${esc(o.t)}</p><p class="text-[11px] text-slate-500">${o.id} · ${kind}</p><p class="text-xs text-slate-500">Con ${esc(buyer?o.ownerName:o.buyerName)}</p><b class="text-brand text-sm">${sol(o.total)}</b></div>
 <span class="self-start text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${sb[1]}">${sb[0]}</span></div>
 ${pend&&buyer&&o.pin?`<div class="mt-3 rounded-2xl p-4 text-center" style="background:linear-gradient(135deg,#eef2ff,#e0f2fe)"><p class="text-[11px] font-semibold text-slate-600">🔐 Tu código de entrega</p><p class="text-4xl font-black tracking-[.25em] text-navy my-1 select-all">${fpin(o.pin)}</p><p class="text-[11px] text-slate-500 leading-snug">Muéstraselo o díctaselo a <b>${esc(o.ownerName)}</b> <u>solo cuando recibas el producto</u> en ${CAMP[o.cp]}. Al ingresarlo en U2U se completa la transacción.</p></div>`:''}
 ${pend&&!buyer?`<div class="mt-3 rounded-2xl p-3 bg-blue-50"><p class="text-xs font-semibold text-navy">Al entregar el producto, pídele a ${esc(o.buyerName)} su código de 6 dígitos:</p><div class="flex gap-2 mt-2 items-center"><input data-o="${o.id}" class="pin-in flex-1 min-w-0 text-center text-xl font-bold tracking-[.3em] border rounded-xl py-2 outline-none" inputmode="numeric" maxlength="6" placeholder="••••••" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6)" ${o.locked?'disabled':''}><button class="bg-brand text-white font-bold rounded-xl px-4 py-3 text-sm" onclick="confirmOrder('${o.id}')">Confirmar entrega</button></div>${o.locked?'<p class="text-[11px] text-red-500 mt-1">Bloqueado por intentos fallidos. Inténtalo en unos minutos.</p>':''}</div>`:''}
 ${o.status=='completed'?`<p class="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl p-2">✅ ${buyer?'Recibiste el producto':'Entregaste el producto'} · ${new Date(o.doneAt).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p>`:''}
 <div class="flex gap-2 mt-3 flex-wrap"><button class="chip" onclick="orderChat('${o.id}')">💬 Chat</button>${pend?`<button class="chip" onclick="cancelOrder('${o.id}')">Cancelar pedido</button>`:''}${o.status=='completed'&&buyer?(o.reviewed?'<span class="text-xs text-emerald-700 self-center">✓ Reseña enviada</span>':`<button class="chip" onclick="rate('${o.id}')">⭐ Calificar</button>`):''}</div></div>`}
function liveOrdersH(){if(LV.ld.o)return skRows(3);const l=Object.values(LV.orders).sort((a,b)=>b.ts-a.ts);
 return l.map(ordCard).join('')||empty('package','Aún no tienes pedidos','Cuando compres, alquiles o te compren algo, aparecerá aquí con su código de entrega.','Explorar productos',"root('home')")}
const ordersTab=()=>(window.io&&LV.me)?liveOrdersH():(ST.orders.map((o,i)=>orderC(o,i)).join('')||empty('package','Aún no tienes pedidos','Cuando compres, alquiles o te compren algo, aparecerá aquí con su código de entrega.','Explorar productos',"root('home')"));

/* ---------- Bandeja: chats + pedidos ---------- */
function liveMsgs(){const l=Object.values(LV.convs).filter(c=>c.msgs.length).sort((a,b)=>b.msgs[b.msgs.length-1].ts-a.msgs[a.msgs.length-1].ts),
 nc=l.reduce((a,c)=>a+(c.un||0),0),np=Object.values(LV.orders).filter(o=>o.status=='pending').length,
 bd=n=>n?`<span class="ml-1 min-w-[18px] h-[18px] px-1 bg-pink-500 text-white rounded-full text-[10px] font-bold inline-grid place-items-center">${n}</span>`:'',
 tab=(k,t,n)=>`<button onclick="MT='${k}';R(1)" class="py-2 rounded-lg ${MT==k?'bg-white shadow text-brand':'text-slate-500'}">${t}${bd(n)}</button>`;
 const chats=l.map(c=>{const p=P(c.pid),m=c.msgs[c.msgs.length-1],mine=m.uid==LV.me.uid;if(!p)return '';
  return `<div onclick="nav('lchat','${c.key}')" class="flex gap-3 items-center py-3 border-b cursor-pointer"><div class="w-14 h-14 rounded-xl overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm">${c.buyerId!=LV.me.uid?esc(c.buyerName):esc(SEL[p.s].n)}</p><p class="text-xs text-slate-500 truncate">${esc(p.t)}</p><p class="text-xs truncate ${mine?'text-slate-400':'text-slate-700 font-semibold'}">${mine?'Tú: ':''}${esc(m.text)}</p></div><div class="flex flex-col items-end gap-1"><span class="text-[10px] text-slate-400">${tm(m.ts)}</span>${c.un?`<span class="min-w-[18px] h-[18px] px-1 bg-pink-500 text-white rounded-full text-[10px] font-bold grid place-items-center">${c.un}</span>`:''}</div></div>`}).join('')
  ||(LV.ld.h?skRows(4):empty('message-circle','Aún no tienes conversaciones','Abre una publicación de otro estudiante y toca el chat para escribirle en privado.','Explorar productos',"root('home')"));
 return `<div class="p-5 pb-28"><h1 class="text-2xl font-bold mb-3">Mensajes</h1><div class="grid grid-cols-2 bg-slate-100 rounded-xl p-1 text-sm font-semibold mb-4">${tab('chats','Chats',nc)}${tab('orders','Pedidos',np)}</div>${MT=='orders'?liveOrdersH():chats}</div>`}
const _vMsgs=V.msgs;V.msgs=a=>(window.io&&LV.me)?liveMsgs():_vMsgs(a);

/* ---------- Indicadores ---------- */
function presUI(){const p=LV.pres||{total:0,uids:[]},ok=sock&&sock.connected;
 const a=$('#pres');if(a)a.textContent=ok?`🟢 ${p.total} conectado${p.total==1?'':'s'} ahora`:(sock?'🔴 Conectando con el servidor…':'⚪ Modo local (sin servidor)');
 const b=$('#lst');if(b){let on=false;if(ok&&LV.me&&S.s=='lchat'){const[pid,bid]=String(S.a).split('|'),o=bid==LV.me.uid?(P(pid)||{}).own:bid;on=(p.uids||[]).includes(o)}
  b.innerHTML=!ok?'<span class="text-red-500">● reconectando…</span>':on?'<span class="text-mint">● en línea</span>':'<span class="text-slate-400">○ desconectado</span>'}}
function navDot(){const b=document.querySelector('#nav [aria-label="Mensajes"]');if(!b)return;b.classList.add('relative');
 const n=Object.values(LV.convs).reduce((a,c)=>a+(c.un||0),0)+(LV.me?Object.values(LV.orders).filter(o=>o.status=='pending'&&o.ownerId==LV.me.uid).length:0);let d=b.querySelector('.ud');
 if(n&&!d){b.insertAdjacentHTML('beforeend','<span class="ud absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-pink-500 text-white rounded-full text-[10px] font-bold grid place-items-center"></span>');d=b.querySelector('.ud')}
 if(d){if(n)d.textContent=n;else d.remove()}}

/* ---------- Filtros del catálogo ---------- */
const carOk=p=>{const c=p.car||PCAR[p.id];return !c||!c.length||c.includes(F.car)};
const filtN=()=>(F.car!='Todas')+(F.cond!='Todos')+(F.cp>=0)+(F.cat!='Todo')+(F.tab!='Todo');
function clrF(){F.car='Todas';F.cond='Todos';F.cp=-1;F.cat='Todo';F.tab='Todo';R(1)}
function togCar(c){const a=PUB.car=PUB.car||[],i=a.indexOf(c);i<0?a.push(c):a.splice(i,1);R(1)}
const carH=p=>{const c=p.car||PCAR[p.id]||[];return c.length?`<div class="mt-3"><p class="text-[11px] text-slate-500 mb-1">🎒 Útil para</p><div class="flex flex-wrap gap-1.5">${c.map(x=>`<span class="text-[11px] font-semibold bg-blue-50 text-brand rounded-full px-2.5 py-1">${esc(x)}</span>`).join('')}</div></div>`:''};
const stH=p=>p.status=='reserved'?'<div class="mt-3 bg-amber-50 text-amber-800 rounded-2xl p-3 text-xs flex gap-2"><i data-lucide="clock" class="w-5 shrink-0"></i><span><b>Reservado:</b> otro estudiante ya inició la compra. Si se cancela, vuelve a estar disponible.</span></div>':p.status=='sold'?'<div class="mt-3 bg-slate-100 text-slate-600 rounded-2xl p-3 text-xs">Este producto ya fue vendido.</div>':'';

/* ---------- Publicaciones compartidas en vivo ---------- */
const RS={};/* publicadores remotos: uid -> índice en SEL */
function sellerIdx(uid,name,cp){if(LV.me&&uid==LV.me.uid)return ME;let i=RS[uid];
 if(i==null){SEL.push({n:name,uid,r:5,c:0,car:'Estudiante UPC',cp,v:new Date().getFullYear(),ci:'—'});i=RS[uid]=SEL.length-1}
 else{SEL[i].n=name;SEL[i].cp=cp}return i}
function addRemote(d){if(!d||!d.id)return false;const ex=P(d.id);
 if(ex){if(d.status&&ex.status!=d.status){ex.status=d.status;return true}return false}
 const s=sellerIdx(d.ownerUid,d.ownerName,d.cp),mine=s==ME;if(mine)SEL[ME].cp=d.cp;
 PR.unshift({id:d.id,t:d.t,ph:d.ph,cat:d.cat,mode:d.mode,price:d.price,rent:d.rent,dep:d.dep,cond:d.cond,car:d.car||[],status:d.status||'available',d:mine?0.3:+(DK[d.cp]+((d.id*13)%9)/10).toFixed(1),s,x:50,y:44,ts:99,desc:d.desc,e:'📦',own:d.ownerUid,remote:!mine});
 return true}
function refreshCatalog(){if(S.s=='home')gridR();else if(S.s=='map'||S.s=='sedes')R(1)}
function onNewProduct(d){if(!LV.me)return;if(addRemote(d)){refreshCatalog();toast('🆕 '+d.ownerName+' publicó: '+String(d.t).slice(0,30))}}
function onProducts(list){if(!LV.me)return;list=list||[];let n=0;list.forEach(d=>{if(addRemote(d))n++});
 /* si el servidor se reinició, vuelvo a subir mis publicaciones */
 const have=new Set(list.map(d=>d.id));PR.filter(p=>p.id>100&&!p.remote&&p.s==ME&&!have.has(p.id)&&p.status!='sold').forEach(p=>shareProduct(p,true));
 if(n)refreshCatalog()}
function shareProduct(p,quiet){if(!sock||!sock.connected||!LV.me)return;
 sock.emit('new-product',{id:p.id,t:p.t,ph:p.ph,cat:p.cat,mode:p.mode,price:p.price,rent:p.rent,dep:p.dep,cond:p.cond,car:p.car||[],cp:SEL[ME].cp,desc:p.desc},r=>{
  if(!r||(r.ok&&r.id==p.id))return;
  if(r.removed){dropProduct(p.id);return}
  if(r.error){if(!quiet)toast('Se publicó solo en tu dispositivo: '+r.error);return}
  if(r.id&&r.id!=p.id){p.id=r.id;save()}})}

/* Tras cada render: pintar mensajes, conservar el código que se está escribiendo y actualizar indicadores */
const _R=R;R=function(keep){const pv={};document.querySelectorAll('.pin-in').forEach(i=>pv[i.dataset.o]=i.value);
 _R(keep);document.querySelectorAll('.pin-in').forEach(i=>{if(pv[i.dataset.o])i.value=pv[i.dataset.o]});
 if(S.s=='lchat')lchatR(S.a);navDot();presUI()};
liveStart();

/* ===== v8.2.0 ===== */
function fixAlt(){document.querySelectorAll('img:not([alt])').forEach(i=>i.setAttribute('alt',''))}
const empty=(ic,ti,m,b,a)=>`<div class="col-span-2 flex flex-col items-center text-center py-10 px-6"><div class="w-16 h-16 rounded-full bg-blue-50 text-brand grid place-items-center"><i data-lucide="${ic}" class="w-8 h-8"></i></div><p class="font-bold text-navy mt-4">${ti}</p><p class="text-sm text-slate-500 mt-1">${m}</p>${b?`<button onclick="${a}" class="btn mt-5 !w-auto px-6 !py-2.5 text-sm">${b}</button>`:''}</div>`;
const EMPTYQ=()=>{const h=filtN()||F.q;return empty('search-x','Sin resultados',h?'No encontramos nada con esa búsqueda o esos filtros. Quita alguno o pregunta a la IA.':'Todavía no hay publicaciones. Sé el primero en publicar.',h?'Limpiar filtros':'Publicar ahora',h?"F.q='';clrF()":'startPub()')+`<div class="col-span-2 text-center -mt-6 mb-4"><button onclick="aiOpen(F.q||'Ayúdame a encontrar algo')" class="text-sm font-semibold text-violet-600">✨ Preguntar a U2U AI</button></div>`};
const skGrid=n=>Array.from({length:n},()=>`<div aria-hidden="true"><div class="sk aspect-square rounded-2xl"></div><div class="sk h-4 w-2/3 mt-2"></div><div class="sk h-3 w-full mt-1.5"></div><div class="sk h-3 w-1/2 mt-1.5"></div></div>`).join('');
const skRows=n=>Array.from({length:n},()=>`<div aria-hidden="true" class="flex gap-3 items-center py-3 border-b"><div class="sk w-14 h-14 rounded-xl shrink-0"></div><div class="flex-1"><div class="sk h-3.5 w-1/2"></div><div class="sk h-3 w-3/4 mt-2"></div></div></div>`).join('');
/* modal de confirmación propio (reemplaza confirm()) */
function askConfirm(o){return new Promise(res=>{window._cfr=res;M(`<div class="bg-white w-full rounded-t-3xl p-6 pop text-center" role="alertdialog" aria-modal="true" aria-labelledby="cft"><div class="w-14 h-14 rounded-full ${o.danger?'bg-red-50 text-red-500':'bg-blue-50 text-brand'} grid place-items-center mx-auto"><i data-lucide="${o.icon||'help-circle'}" class="w-7 h-7"></i></div><p id="cft" class="font-bold text-lg mt-3 text-navy">${o.title}</p><p class="text-sm text-slate-500 mt-1">${o.msg||''}</p><button class="btn mt-5 ${o.danger?'!bg-red-500':''}" onclick="cfAns(true)">${o.ok||'Aceptar'}</button><button class="w-full py-3 text-slate-500 font-semibold" onclick="cfAns(false)">${o.no||'Cancelar'}</button></div>`)})}
function cfAns(v){const r=window._cfr;window._cfr=null;X();if(r)r(v)}
document.addEventListener('keydown',e=>{if(e.key=='Escape'&&!$('#modal').classList.contains('hidden'))X()});
/* calificación con estrellas */
const RTX=['','Malo','Regular','Bueno','Muy bueno','Excelente'];let RV=0,RO='';
function rate(oid){
 if(!oid||!window.io||!LV.me)return toast('Las reseñas solo se guardan tras una entrega confirmada con código');
 const o=LV.orders[oid];if(!o||o.buyerId!=LV.me.uid||o.status!='completed')return toast('Solo puedes calificar pedidos con entrega confirmada');
 if(o.reviewed)return toast('Ya calificaste este pedido');
 RV=0;RO=oid;M(`<div class="bg-white w-full rounded-t-3xl p-6 text-center pop" role="dialog" aria-modal="true" aria-labelledby="rtt"><p id="rtt" class="font-bold text-lg text-navy">¿Cómo fue tu experiencia con ${esc(o.ownerName)}?</p><p class="text-xs text-slate-500">${esc(o.t)}</p><div id="rs" role="radiogroup" aria-label="Calificación" class="flex justify-center gap-1 my-3">${[1,2,3,4,5].map(n=>`<button role="radio" aria-checked="false" aria-label="${n} de 5" data-n="${n}" onclick="rateSet(${n})" class="w-12 h-12 text-4xl leading-none text-slate-300 transition active:scale-90">★</button>`).join('')}</div><p id="rt" aria-live="polite" class="text-sm text-slate-500 h-5">Toca una estrella</p><textarea id="rtx" maxlength="300" placeholder="Cuéntanos cómo fue (opcional)" class="inp mt-3 h-20 resize-none"></textarea><button id="rsend" class="btn mt-2" disabled onclick="rateSend()">Enviar reseña</button><button class="w-full py-3 text-slate-500 font-semibold" onclick="X()">Ahora no</button></div>`)}
function rateSet(n){RV=n;document.querySelectorAll('#rs button').forEach(b=>{const k=+b.dataset.n,on=k<=n;b.classList.toggle('text-amber-400',on);b.classList.toggle('text-slate-300',!on);b.classList.toggle('scale-110',on);b.setAttribute('aria-checked',k==n)});const e=$('#rt');e.textContent=n+' de 5 · '+RTX[n];e.className='text-sm font-semibold text-amber-500 h-5';$('#rsend').disabled=false}
function rateSend(){if(!RV||!RO)return;if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');const b=$('#rsend'),n=RV,id=RO;if(b)b.disabled=true;
 sock.emit('review:create',{orderId:id,rating:n,text:($('#rtx')||{}).value||''},r=>{if(r&&r.error){if(b)b.disabled=false;if(/Ya calificaste/.test(r.error)&&LV.orders[id]){LV.orders[id].reviewed=true;X()}return toast(r.error)}
  X();toast('¡Gracias por tu reseña de '+n+' ★!');if(LV.orders[id])LV.orders[id].reviewed=true;if(['msgs','profile'].includes(S.s))R(1)})}
/* banner de reconexión */
function netUI(down){const e=$('#net');if(!e)return;clearTimeout(e.t);
 if(down){e.dataset.d='1';e.className='absolute top-0 inset-x-0 z-[60] text-center text-xs font-semibold py-1.5 bg-amber-500 text-white';e.innerHTML='<span class="inline-block w-3 h-3 mr-1.5 align-[-2px] border-2 border-white border-t-transparent rounded-full animate-spin"></span>Reconectando…'}
 else if(e.dataset.d=='1'){e.dataset.d='';e.className='absolute top-0 inset-x-0 z-[60] text-center text-xs font-semibold py-1.5 bg-emerald-500 text-white';e.textContent='✓ Conexión restablecida';e.t=setTimeout(()=>e.className='hidden',1800)}}
window.addEventListener('offline',()=>netUI(1));window.addEventListener('online',()=>{if(!sock||sock.connected)netUI(0)});

/* ===== v8.3.0: cuentas (registro, login y sesión guardada) ===== */
const TK='u2utk';
async function api(p,body,tok){try{const r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'Content-Type':'application/json'},tok?{Authorization:'Bearer '+tok}:{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{ok:r.ok,status:r.status,j}}catch(e){return{ok:false,status:0,j:{}}}}
function authForm(m){const reg=m=='register',lb='text-xs font-semibold text-slate-600',au='autocapitalize="none" autocorrect="off" spellcheck="false"';
 return `<div class="px-7 pt-10 pb-8"><img src="${IM.logo}" alt="U2U · Compra, vende y alquila entre estudiantes" class="w-48 mx-auto">
 <h1 class="text-[24px] font-extrabold text-navy text-center mt-5">${reg?'Crea tu cuenta':'¡Bienvenido de vuelta!'}</h1>
 <p class="text-slate-500 text-sm text-center mt-1 mb-5">${reg?'Regístrate para comprar, vender y chatear.':'Inicia sesión con tu usuario o correo.'}</p>
 <form onsubmit="event.preventDefault();authGo('${m}')" novalidate>
 ${reg?`<label class="${lb}" for="a_name">Nombre</label><input id="a_name" class="inp" maxlength="24" autocomplete="name" placeholder="¿Cómo te llamas?">
 <label class="${lb}" for="a_user">Usuario</label><input id="a_user" class="inp" maxlength="20" autocomplete="username" ${au} placeholder="ej. ana_upc">
 <label class="${lb}" for="a_mail">Correo</label><input id="a_mail" type="email" class="inp" maxlength="254" autocomplete="email" inputmode="email" ${au} placeholder="tucorreo@ejemplo.com">`
 :`<label class="${lb}" for="a_id">Usuario o correo</label><input id="a_id" class="inp" maxlength="254" autocomplete="username" ${au} placeholder="usuario o correo">`}
 <label class="${lb}" for="a_pw">Contraseña</label><div class="relative"><input id="a_pw" type="password" class="inp" style="padding-right:2.75rem" maxlength="128" autocomplete="${reg?'new-password':'current-password'}" placeholder="${reg?'Mínimo 8 caracteres':'Tu contraseña'}"><button type="button" aria-label="Mostrar u ocultar contraseña" class="absolute right-3 text-slate-400" style="top:1.05rem" onclick="const i=$('#a_pw');i.type=i.type=='password'?'text':'password'"><i data-lucide="eye" class="w-5 h-5"></i></button></div>
 <p id="a_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center"></p>
 <button id="a_btn" type="submit" class="btn mt-1">${reg?'Crear cuenta':'Iniciar sesión'}</button></form>
 <p class="text-center text-sm text-slate-500 mt-5">${reg?'¿Ya tienes cuenta?':'¿No tienes cuenta?'} <button class="font-bold text-brand" onclick="root('${reg?'login':'register'}')">${reg?'Inicia sesión':'Regístrate'}</button></p>
 <p id="pres" class="text-center text-xs text-slate-400 mt-4"></p></div>`}
async function authGo(m){const er=$('#a_er'),btn=$('#a_btn'),v=id=>($('#'+id)||{}).value||'';er.textContent='';let body,path;
 if(m=='register'){const name=v('a_name').trim(),username=v('a_user').trim(),email=v('a_mail').trim(),password=v('a_pw');
  if(name.length<2)return er.textContent='Escribe tu nombre (mínimo 2 letras).';
  if(!/^[a-z0-9_.]{3,20}$/i.test(username))return er.textContent='Usuario: 3 a 20 caracteres (letras, números, _ y .).';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return er.textContent='Escribe un correo válido.';
  if(password.length<8)return er.textContent='La contraseña debe tener al menos 8 caracteres.';
  body={name,username,email,password};path='register'}
 else{const id=v('a_id').trim(),password=v('a_pw');if(!id||!password)return er.textContent='Completa usuario o correo y contraseña.';body={id,password};path='login'}
 btn.disabled=true;btn.textContent=m=='register'?'Creando cuenta…':'Entrando…';
 const r=await api(path,body);
 if(r.ok&&r.j.token)return authOk(r.j);
 btn.disabled=false;btn.textContent=m=='register'?'Crear cuenta':'Iniciar sesión';
 er.textContent=r.status==0?'No hay conexión con el servidor. Reintenta en unos segundos.':(r.j.error||'No se pudo completar. Intenta de nuevo.')}
function authOk(j){LV.adm=!!(j.user&&j.user.admin);try{localStorage.setItem(TK,j.token)}catch(e){}LV.idc={uid:j.user.uid,secret:j.user.secret};try{localStorage.setItem('u2uid',JSON.stringify(LV.idc))}catch(e){}LV.pref={name:j.user.name};netUI(0);liveJoin(j.user.name);root('home')}
/* sesión guardada: al abrir la app se valida el token y se entra directo */
async function boot(n){n=n||0;let tk=null;try{tk=localStorage.getItem(TK)}catch(e){}
 if(!tk){S.s='login';return R()}
 S.s='boot';R();const r=await api('me',null,tk);
 if(r.ok&&r.j.user)return authOk({token:tk,user:r.j.user});
 if(r.status==401||r.status==403){try{localStorage.removeItem(TK)}catch(e){}S.s='login';R();if(r.j&&r.j.blocked)toast(r.j.error);return}
 if(n<25){netUI(1);setTimeout(()=>{if(S.s=='boot')boot(n+1)},Math.min(1000+n*500,5000))}else{S.s='login';R()}}
function bootInit(){let tk=null;try{tk=localStorage.getItem(TK)}catch(e){}if(window.io&&tk)boot();else R()}
async function logout(){if(!await askConfirm({title:'¿Cerrar sesión?',msg:'Tendrás que volver a ingresar tu usuario y contraseña.',ok:'Cerrar sesión',no:'Volver',icon:'log-out'}))return;sessionOut()}
function sessionOut(msg){let tk=null;try{tk=localStorage.getItem(TK)}catch(e){}if(tk&&window.io)api('logout',{},tk);try{localStorage.removeItem(TK);localStorage.removeItem('u2uid')}catch(e){}
 if(sock&&sock.connected)sock.emit('leave');LV.me=null;LV.idc=null;LV.convs={};LV.orders={};LV.adm=false;LV.rpt=null;LV.rep=new Set();LV.rt={};LV.rv={};LV.rl={};LV.ld={p:0,h:0,o:0};S.s='login';S.st=[];X();R();if(msg)toast(msg)}

/* ===== v8.4.0: reportes, reseñas verificadas y panel de moderación (el rol admin lo decide el servidor) ===== */
function dropProduct(id,live){id=+id;const i=PR.findIndex(p=>p.id==id);if(i<0)return;const mine=PR[i].s==ME;PR.splice(i,1);ST.fav=ST.fav.filter(f=>f!=id);save();
 if(live&&S.s=='detail'&&S.a==id){toast('Esta publicación fue eliminada por moderación');back()}
 else if(live&&mine)toast('Una de tus publicaciones fue eliminada por incumplir las normas');
 refreshCatalog();if(['profile','msgs','admin'].includes(S.s))R(1)}
const agoT=ts=>{const m=Math.max(1,Math.round((Date.now()-ts)/6e4));return m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' d'};

/* Reportar publicación: el servidor guarda el motivo y no deja reportar lo mismo dos veces */
const RSN=[['obscena','Contenido obsceno','Imágenes o texto inapropiados'],['estafa','Posible estafa','Pide pagos fuera de U2U o datos sospechosos'],['falsa','Información falsa','El producto no es lo que dice o está mal descrito'],['otro','Otro','Cuéntanos qué pasa']];
let RP={id:0,r:'',n:''};
const reportBtn=p=>{if(LV.adm)return '';return LV.rep.has(+p.id)?`<p class="mt-3 text-xs text-slate-400 flex items-center gap-1"><i data-lucide="flag" class="w-3.5"></i>Ya reportaste esta publicación</p>`:`<button onclick="reportM(${p.id})" class="mt-3 text-xs text-slate-500 flex items-center gap-1"><i data-lucide="flag" class="w-3.5"></i>Reportar publicación</button>`};
function reportM(id){if(!window.io||!LV.me)return toast('Inicia sesión para reportar publicaciones');const p=P(id);
 if(!p)return;if(p.own==LV.me.uid||p.s==ME)return toast('Esta es tu publicación');
 if(!p.own)return toast('Producto de ejemplo: solo se reportan publicaciones de otros estudiantes');
 if(LV.rep.has(+id))return toast('Ya reportaste esta publicación');RP={id:+id,r:'',n:''};M(reportH(1))}
const reportH=first=>`<div class="bg-white w-full rounded-t-3xl p-6 ${first?'pop':''}" role="dialog" aria-modal="true" aria-labelledby="rpt"><p id="rpt" class="font-bold text-lg text-navy">Reportar publicación</p><p class="text-xs text-slate-500 mb-3">Elige el motivo. Un administrador la revisará.</p><div role="radiogroup" aria-label="Motivo" class="space-y-2">${RSN.map(x=>`<button role="radio" aria-checked="${RP.r==x[0]}" onclick="rpSet('${x[0]}')" class="w-full text-left border rounded-xl p-3 flex gap-3 items-center ${RP.r==x[0]?'border-brand bg-blue-50':''}"><span class="w-4 h-4 shrink-0 rounded-full border-2 ${RP.r==x[0]?'border-brand bg-brand':'border-slate-300'}"></span><span><b class="text-sm block">${x[1]}</b><span class="text-xs text-slate-500">${x[2]}</span></span></button>`).join('')}</div><textarea id="rpn" maxlength="200" oninput="RP.n=this.value" placeholder="${RP.r=='otro'?'Cuéntanos el motivo (obligatorio)':'Detalle (opcional)'}" class="inp mt-3 h-20 resize-none">${esc(RP.n)}</textarea><button id="rpb" class="btn mt-2" onclick="rpSend()">Enviar reporte</button><button class="w-full py-3 text-slate-500 font-semibold" onclick="X()">Cancelar</button></div>`;
function rpSet(k){RP.r=k;M(reportH(0))}
function rpSend(){if(!RP.r)return toast('Elige un motivo');if(RP.r=='otro'&&RP.n.trim().length<3)return toast('Cuéntanos brevemente el motivo');
 if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');const b=$('#rpb'),id=RP.id;if(b)b.disabled=true;
 sock.emit('report:create',{pid:id,reason:RP.r,note:RP.n},r=>{
  if(r&&r.error){if(b)b.disabled=false;toast(r.error);if(/Ya reportaste/.test(r.error)){LV.rep.add(id);X();if(S.s=='detail')R(1)}else if(/ya no existe/.test(r.error)){X();dropProduct(id)}return}
  LV.rep.add(id);X();toast('Reporte enviado. Gracias por cuidar la comunidad');if(S.s=='detail')R(1)})}

/* Reseñas reales (solo con entrega confirmada con PIN, una por pedido) */
const rtOf=i=>{const u=SEL[i]&&SEL[i].uid,r=u&&LV.rt[u];return r?{avg:r.avg,count:r.count}:{avg:0,count:0}};
const rtH=i=>{const r=rtOf(i);return r.count?`${stars(r.avg)} <span class="text-slate-500">${r.avg.toFixed(1)} (${r.count} reseña${r.count>1?'s':''})</span>`:'<span class="text-slate-400">Sin reseñas todavía</span>'};
function ensureRev(u,i){if(LV.rl[u]||!sock||!sock.connected)return;LV.rl[u]=1;
 sock.emit('reviews:get',{uid:u},r=>{LV.rl[u]=0;LV.rv[u]=(r&&r.ok)?r.list:[];if(r&&r.ok)LV.rt[u]=r.count?{avg:r.avg,count:r.count}:undefined;if(S.s=='seller'&&S.a==i)R(1)})}
function revH(i){const u=SEL[i]&&SEL[i].uid;if(!u)return '<p class="text-xs text-slate-400 mb-2">Este vendedor aún no tiene reseñas verificadas.</p>';
 const L=LV.rv[u];if(!L){ensureRev(u,i);return '<div class="sk h-14 rounded-xl mb-2"></div><div class="sk h-14 rounded-xl mb-2"></div>'}
 return L.length?L.map(r=>`<div class="border rounded-xl p-3 mb-2 text-sm"><div class="flex justify-between"><b>${esc(r.buyerName)}</b><span class="text-amber-500 text-xs">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><p class="text-[10px] text-slate-400">${esc(r.pt)} · ${r.mode=='alquiler'?'Alquiler':'Compra'} verificada · ${new Date(r.ts).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})}</p>${r.text?`<p class="text-slate-600 text-xs mt-1">${esc(r.text)}</p>`:''}</div>`).join(''):'<p class="text-xs text-slate-400 mb-2">Todavía no hay reseñas. Aparecerán cuando un comprador califique una entrega confirmada con código.</p>'}

/* Panel de moderación: solo se muestra si el servidor lo marcó admin; cada acción la revalida el servidor */
const RSL={obscena:'Obscena',estafa:'Estafa',falsa:'Falsa',otro:'Otro'};let AT='open';
const adminBtn=()=>{const n=LV.rpt?LV.rpt.reports.filter(r=>r.status=='open').length:0;return `<button onclick="nav('admin')" class="mt-3 w-full flex items-center gap-3 border-2 border-red-200 bg-red-50 text-red-700 rounded-2xl p-3 text-left"><i data-lucide="shield-alert" class="w-6 h-6 shrink-0"></i><span class="flex-1"><b class="text-sm block">Panel de moderación</b><span class="text-xs">Reportes, publicaciones y usuarios</span></span>${n?`<span class="min-w-[22px] h-[22px] px-1.5 bg-red-600 text-white rounded-full text-xs font-bold grid place-items-center">${n}</span>`:''}</button>`};
const repCard=r=>{const open=r.status=='open',st=r.status=='dismissed'?'Reporte descartado':(r.resolution=='blocked'?'Usuario bloqueado':'Publicación eliminada');
 return `<div class="border rounded-2xl p-3 mb-3"><div class="flex items-start justify-between gap-2"><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600">${RSL[r.reason]||esc(r.reason)}</span><span class="text-[10px] text-slate-400">${agoT(r.ts)}</span></div>
 <p class="font-bold text-sm mt-2">${esc(r.pt)}</p><p class="text-xs text-slate-500">${r.pmode=='alquiler'?sol(r.prent||0)+'/día':sol(r.pprice||0)} · ${esc(r.pcat||'')}</p>
 <p class="text-xs text-slate-500 mt-1">Vendedor: <b>${esc(r.ownerName)}</b> · Reportó: <b>${esc(r.reporterName)}</b>${r.count>1?` · <b class="text-red-600">${r.count} reportes de esta publicación</b>`:''}</p>
 ${r.note?`<p class="text-xs bg-slate-50 rounded-xl p-2 mt-2 text-slate-700">“${esc(r.note)}”</p>`:''}
 ${open?`<div class="grid grid-cols-2 gap-2 mt-3">${r.live?`<button class="chip" onclick="admView(${r.pid})">👁 Ver publicación</button>`:'<span class="chip opacity-50 text-center">Ya no está en línea</span>'}<button class="chip" onclick="admDismiss('${r.id}')">Descartar reporte</button><button class="chip !bg-red-50 !text-red-600" onclick="admDelete(${r.pid})">🗑 Eliminar publicación</button><button class="chip !bg-red-50 !text-red-600" onclick="admBlock('${r.ownerUid}')">⛔ Bloquear usuario</button></div>`:`<p class="text-xs mt-2 font-semibold text-slate-600">${st}${r.resolvedAt?' · '+agoT(r.resolvedAt):''}</p>`}</div>`};
const blkCard=u=>`<div class="border rounded-2xl p-3 mb-3 flex items-center gap-3"><div class="flex-1"><p class="font-bold text-sm">${esc(u.name)}</p><p class="text-xs text-slate-500">@${esc(u.username)}${u.blockedAt?' · bloqueado '+agoT(u.blockedAt):''}</p></div><button class="chip" onclick="admUnblock('${u.uid}')">Desbloquear</button></div>`;
V.admin=()=>{if(!LV.adm)return hd('Moderación')+'<p class="p-6 text-center text-slate-500">No autorizado</p>';
 const d=LV.rpt;if(!d)return hd('Moderación')+`<div class="p-5">${skRows(3)}</div>`;
 const open=d.reports.filter(r=>r.status=='open'),done=d.reports.filter(r=>r.status!='open'),
 tab=(k,t,n)=>`<button onclick="AT='${k}';R(1)" class="py-2 rounded-lg ${AT==k?'bg-white shadow text-brand':'text-slate-500'}">${t}${n?' ('+n+')':''}</button>`,
 body=AT=='open'?(open.map(repCard).join('')||empty('shield-check','Sin reportes pendientes','Cuando alguien reporte una publicación aparecerá aquí.')):AT=='done'?(done.map(repCard).join('')||empty('inbox','Aún no hay reportes resueltos','')):(d.blocked.map(blkCard).join('')||empty('user-check','No hay usuarios bloqueados',''));
 return hd('Moderación')+`<div class="p-5 pb-28"><div class="grid grid-cols-3 bg-slate-100 rounded-xl p-1 text-xs font-semibold mb-4">${tab('open','Pendientes',open.length)}${tab('done','Resueltos',0)}${tab('blk','Bloqueados',d.blocked.length)}</div>${body}</div>`};
function admEmit(ev,data,ok){if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');sock.emit(ev,data,r=>{if(r&&r.error)return toast(r.error);if(ok)toast(ok)})}
function admView(pid){if(!P(pid))return toast('La publicación ya no existe');openP(pid)}
async function admDelete(pid){if(!await askConfirm({title:'¿Eliminar esta publicación?',msg:'Desaparecerá para todos al instante y se resolverán sus reportes.',ok:'Sí, eliminar',no:'Volver',danger:1,icon:'trash-2'}))return;admEmit('admin:delete',{pid},'Publicación eliminada')}
function admDismiss(id){admEmit('admin:dismiss',{id},'Reporte descartado')}
async function admBlock(uid){const r=LV.rpt&&LV.rpt.reports.find(x=>x.ownerUid==uid);if(!await askConfirm({title:'¿Bloquear a '+esc(r?r.ownerName:'este usuario')+'?',msg:'No podrá iniciar sesión y todas sus publicaciones se eliminarán.',ok:'Sí, bloquear',no:'Volver',danger:1,icon:'ban'}))return;admEmit('admin:block',{uid},'Usuario bloqueado')}
function admUnblock(uid){admEmit('admin:unblock',{uid},'Usuario desbloqueado')}

bootInit();
