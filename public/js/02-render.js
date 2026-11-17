/* =================== NAVEGACIÓN =================== */
let S={s:'login',a:null,st:[],vm:'venta'},F={tab:'Todo',cat:'Todo',cp:-1,sort:'r',q:'',car:'Todas',cond:'Todos',src:'all'},CO={},PUB={},PT='pub',STEP=1;
const NAVS=['home','map','msgs','profile'];
function getScrollY(){const v=$('#v');return (v&&v.scrollTop)||window.scrollY||(document.documentElement&&document.documentElement.scrollTop)||0}
function restoreScroll(y){
 if(y==null)return;
 const v=$('#v');
 const apply=()=>{if(v)v.scrollTop=y;if(window.scrollY!==y)window.scrollTo(0,y);if(document.documentElement&&document.documentElement.scrollTop!==y)document.documentElement.scrollTop=y};
 apply();
 requestAnimationFrame(()=>{apply();setTimeout(apply,35);setTimeout(apply,120)});
}
function nav(s,a){S.st.push({s:S.s,a:S.a,y:getScrollY()});S.s=s;S.a=a;R()}
function back(){const p=S.st.pop()||{s:'home',y:0};S.s=p.s;S.a=p.a;R(false,p.y||0)}
function root(s,a){S.st=[];S.s=s;S.a=a;R()}
/* Hooks post-render: cada módulo se registra con onAfterRender(fn) en vez de envolver R (fn recibe keep, restoreY; los errores no rompen el render) */
window._afterR=[];window.onAfterRender=fn=>{if(typeof fn==='function')_afterR.push(fn)};
function R(keep,restoreY){const pv={};document.querySelectorAll('.pin-in').forEach(i=>pv[i.dataset.o]=i.value); /* conserva lo que se está escribiendo en los campos de código */
 const v=$('#v'),y=getScrollY(),xs=keep?[...v.querySelectorAll('.no-sb')].map(e=>e.scrollLeft):[];
 if(!keep&&restoreY===undefined){v.style.animation='none';v.offsetWidth;v.style.animation=''} /* R(1) = repintado por eventos del servidor: sin animación de entrada ni saltos */
 v.innerHTML=V[S.s](S.a);
 if(keep){v.scrollTop=y;v.querySelectorAll('.no-sb').forEach((e,i)=>{if(xs[i])e.scrollLeft=xs[i]})}
 else if(restoreY!==undefined){restoreScroll(restoreY)}
 else{v.scrollTop=0;window.scrollTo(0,0)}
 if(keep)v.querySelectorAll('.no-sb').forEach((e,i)=>{if(xs[i])e.scrollLeft=xs[i]});
 const n=$('#nav');n.classList.toggle('hidden',!NAVS.includes(S.s));
 const b=(s,i,l)=>`<button onclick="root('${s}')" class="flex flex-col items-center gap-0.5 ${S.s==s?'text-brand font-semibold':''}"><i data-lucide="${i}"></i>${l}</button>`;
 const t=(s,i,l)=>`<button onclick="root('${s}')" aria-label="${l}" class="p-2 ${S.s==s?'text-brand':'text-slate-500'}"><i data-lucide="${i}" class="w-7 h-7"></i></button>`;
 n.innerHTML=t('home','home','Inicio')+t('map','compass','Explorar')+`<button onclick="startPub()" class="-mt-7 flex flex-col items-center gap-0.5 w-16"><span class="w-14 h-14 rounded-full bg-[#2f4bd8] text-white grid place-items-center shadow-[0_8px_16px_rgba(47,75,216,.35)] border-4 border-[#eef3fb]"><i data-lucide="plus" class="w-7 h-7"></i></span><span class="text-slate-600 text-[11px]">Publicar</span></button>`+t('msgs','message-circle-more','Mensajes')+t('profile','circle-user-round','Perfil');
 fixAlt();lucide.createIcons();if(S.s=='map')initMap(0);if(S.s=='home')initMap(1);const fb=$('#aifab');fb.classList.toggle('hidden',!['home','map'].includes(S.s));fb.style.bottom=S.s=='map'?'250px':'calc(100px + env(safe-area-inset-bottom,0px))';
 document.querySelectorAll('.pin-in').forEach(i=>{if(pv[i.dataset.o])i.value=pv[i.dataset.o]});
 _afterR.forEach(fn=>{try{fn(keep,restoreY)}catch(e){}})}
function toast(t){const e=$('#toast');e.textContent=t;e.style.opacity=1;clearTimeout(e.t);e.t=setTimeout(()=>e.style.opacity=0,2200)}
let _focusBack=null;
function M(h){const m=$('#modal');if(m.classList.contains('hidden'))_focusBack=document.activeElement;m.innerHTML=h;fixAlt();m.classList.remove('hidden');m.classList.add('flex');lucide.createIcons();const f=m.querySelector('input,select,textarea,button');if(f){m.tabIndex=-1;try{f.focus({preventScroll:true})}catch(e){}}}
function X(){if(window._cfr){const r=_cfr;_cfr=null;r(false)}const m=$('#modal');m.classList.add('hidden');m.classList.remove('flex');if(_focusBack&&_focusBack.focus){try{_focusBack.focus({preventScroll:true})}catch(e){}}_focusBack=null}
const hd=(t,r='')=>`<div class="sticky top-0 bg-white z-20 flex items-center gap-3 px-4 py-3 border-b"><button onclick="back()" aria-label="Volver"><i data-lucide="arrow-left"></i></button><b class="flex-1 truncate">${t}</b>${r}</div>`;
function openP(id){const p=P(id);S.vm=p.mode=='alquiler'?'alquiler':'venta';nav('detail',id)}
function fav(id){const i=ST.fav.indexOf(id);i<0?ST.fav.push(id):ST.fav.splice(i,1);save();R(1)}
/* =================== TARJETA (estilo Marketplace) =================== */
const card=p=>{const t=tag(p.mode);return `<div onclick="openP(${p.id})" class="cursor-pointer active:scale-[.97] transition">
 <div class="relative aspect-square rounded-2xl overflow-hidden bg-slate-100">${pic(p)}
  <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-navy shadow-sm">${p.cond}</span>${p.status=='reserved'||p.status=='sold'?`<div class="absolute inset-0 bg-black/45 grid place-items-center"><span class="bg-white text-navy text-xs font-extrabold px-3 py-1 rounded-full">${p.status=='sold'?'Vendido':'Reservado'}</span></div>`:''}
  <button onclick="event.stopPropagation();fav(${p.id})" aria-label="Guardar en favoritos" class="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow"><i data-lucide="heart" class="w-4 h-4 ${ST.fav.includes(p.id)?'fill-red-500 text-red-500':''}"></i></button>
  <span class="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${t[1]}">${t[0]}</span>${p.official?'<span class="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white shadow-sm">Oficial ✓</span>':''}</div>
 <p class="font-extrabold mt-1.5 text-[15px] leading-none">${price(p)}${fairB(p)}</p>
 <p class="text-[13px] truncate mt-0.5">${esc(p.t)}</p>
 <p class="text-[11px] text-slate-500 truncate">${(pcp(p)==((LV.me&&LV.me.cp!==undefined)?LV.me.cp:SEL[ME].cp))?`<span class="text-emerald-700 font-semibold">📍 ${CAMP[pcp(p)].replace('UPC ','')} · En tu campus ✓</span>`:`📍 ${CAMP[pcp(p)].replace('UPC ','')}`}</p></div>`};
/* =================== PANTALLAS =================== */
const V={
login(){return window.io?authForm('login'):noConn()},
register(){return authForm('register')},
boot(){return `<div class="h-full grid place-items-center px-8 text-center"><div><img src="${IM.logo}" alt="U2U" class="w-48 mx-auto"><div class="w-9 h-9 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mt-8" aria-hidden="true"></div><p class="text-sm text-slate-500 mt-4" role="status">Entrando a tu cuenta…</p><button class="mt-6 text-sm font-semibold text-brand" onclick="S.s='login';R()">Usar otra cuenta</button></div></div>`},
home(){const l=HL(),isQ=Boolean(F.q&&F.q.trim());
 return `<div class="pb-28">
  <div class="px-5 pt-7 flex items-start justify-between">
   <div>
    <h1 class="text-[26px] font-bold text-navy leading-tight">Hola, ${esc(uname())} <span class="text-xl">👋</span></h1>
    <p class="text-[17px] text-slate-500 mt-1">¿Qué necesitas este ciclo?</p>
    <button onclick="sedeM()" class="mt-2 text-xs font-bold bg-blue-50 text-brand rounded-full px-3 py-1.5">📍 ${F.cp<0?'Todas las sedes UPC':CAMP[F.cp]} ▾</button>
   </div>
   <button onclick="notifM()" aria-label="Notificaciones" class="relative p-2 rounded-full bg-blue-50 text-brand mt-1"><i data-lucide="bell"></i></button>
  </div>
  <div class="px-5 mt-5">
   <div class="flex items-center bg-white rounded-2xl px-4 shadow-[0_6px_16px_rgba(30,42,120,.12)] border border-slate-100 focus-within:ring-2 focus-within:ring-brand/30">
    <i data-lucide="search" class="w-5 text-slate-400"></i>
    <input id="qs" value="${esc(F.q)}" oninput="qIn(this.value)" placeholder="Buscar productos (ej. calculadora, mandil, dron)" class="w-full bg-transparent py-3.5 px-3 text-[15px] outline-none">
    ${F.q?`<button onclick="F.q='';R(1)" aria-label="Borrar búsqueda" class="text-slate-400 hover:text-slate-600 mr-2"><i data-lucide="x" class="w-4"></i></button>`:''}
    <button onclick="filtM()" aria-label="Filtros" class="text-slate-500"><i data-lucide="sliders-horizontal" class="w-5"></i></button>
   </div>
  </div>
  ${isQ ? `
  <div class="px-5 mt-4">
   <div class="flex items-center justify-between">
    <h2 class="text-base font-extrabold text-navy">Resultados para "${esc(F.q)}"</h2>
    <span id="cnt" class="text-xs text-slate-400">${l.length} producto${l.length==1?'':'s'}</span>
   </div>
   <div class="flex gap-2 overflow-x-auto no-sb mt-3">
    ${['Todo','Venta','Alquiler'].map(t=>`<button class="chip ${F.tab==t?'on':''}" onclick="F.tab='${t}';R(1)">${t}</button>`).join('')}
    <button class="chip" onclick="F.q='';R(1)">✕ Limpiar búsqueda</button>
   </div>
   <div id="grid" class="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">${gridH(l)}</div>
  </div>` : `
 <div class="flex justify-between px-4 mt-6">${G.map(g=>`<button onclick="F.cat=F.cat=='${g[0]}'?'Todo':'${g[0]}';R(1)" class="flex flex-col items-center gap-2 w-[80px]"><span class="w-14 h-14 rounded-full grid place-items-center transition ${F.cat==g[0]?'bg-brand text-white shadow-md shadow-brand/30':'bg-blue-50 text-brand'}"><i data-lucide="${g[1]}" class="w-6 h-6"></i></span><span class="text-[10.5px] font-semibold text-center leading-tight text-navy">${g[0]}</span></button>`).join('')}</div>
 <div class="mx-5 mt-6 rounded-3xl p-5 relative overflow-hidden" style="background:linear-gradient(120deg,#dbeafe,#e0f2fe)"><div class="relative z-10 w-[58%]"><h2 class="text-[18px] font-bold leading-tight text-navy">Dale una <span class="text-emerald-500">segunda vida</span> a lo que ya no usas</h2><p class="text-[11px] text-slate-600 mt-2 leading-snug">Compra, vende o alquila materiales y equipos académicos entre estudiantes.</p><button onclick="root('map')" class="mt-3 bg-navy text-white text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1">Explorar ahora <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button></div>
  <div class="absolute right-3 top-3 flex flex-col items-end gap-1 text-[8px] font-semibold text-navy"><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Más oportunidades</span><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Menos residuos</span><span class="bg-white rounded-full px-2 py-0.5 shadow-sm">Comunidad estudiantil</span></div>
  <div class="absolute right-4 bottom-3 w-24 h-14 rounded-md bg-amber-200 grid place-items-center font-extrabold text-navy text-lg shadow-md">U2U</div><img src="${IM.cam}" alt="Cámara Canon de ejemplo" class="absolute right-14 bottom-[52px] w-11 h-11 rounded-lg object-cover shadow"><img src="${IM.calc}" alt="Calculadora Casio de ejemplo" class="absolute right-4 bottom-[50px] w-8 h-10 rounded-md object-cover shadow"></div>
 <div class="grid grid-cols-3 gap-2 mx-5 mt-4">${[['calculator','Calculadora de ahorro','ahorroM()'],['building-2','Sedes UPC',"nav('sedes')"],['shield-check','Punto seguro',"toast('Entregas solo en puntos seguros del campus, con carné UPC')"]].map(a=>`<button onclick="${a[2]}" class="bg-blue-50 rounded-2xl p-3 text-[11px] font-semibold text-navy flex flex-col items-center gap-1.5 active:scale-95 transition"><i data-lucide="${a[0]}" class="w-6 h-6 text-brand"></i>${a[1]}</button>`).join('')}</div>
${offBtn()}<div class="mx-5 mt-5 rounded-2xl p-4 text-white" style="background:linear-gradient(135deg,#6d28d9,#db2777)"><p class="font-bold flex items-center gap-1.5"><i data-lucide="sparkles" class="w-4"></i>U2U AI · tu asistente</p><p class="text-xs opacity-90 mt-1">Cuéntame qué necesitas y busco en los 4 campus de UPC.</p><div class="flex gap-2 overflow-x-auto no-sb mt-3">${['Algo para topografía','Tengo S/ 100','Para filmar un corto'].map(q=>`<button onclick="aiOpen('${q}')" class="shrink-0 bg-white/20 border border-white/40 rounded-full px-3 py-1.5 text-xs font-semibold">${q}</button>`).join('')}</div></div>
 <div class="px-5 mt-7 flex items-start gap-2"><i data-lucide="map-pin" class="w-5 text-brand mt-0.5"></i><div><h3 class="font-bold text-navy">Explora productos cerca de ti</h3><p class="text-sm text-slate-500 leading-snug">Encuentra estudiantes que venden o alquilan en tu zona.</p></div></div>
 <div class="px-5 mt-3"><div class="relative h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-md"><div id="mini-map" class="absolute inset-0 z-0"></div><div onclick="root('map')" class="absolute inset-0 z-[5] cursor-pointer"></div></div></div>
 <div class="px-5 mt-7 flex items-center justify-between"><h3 class="font-bold text-lg text-navy">Destacados</h3><select onchange="F.sort=this.value;gridR()" class="text-xs font-semibold text-slate-500 bg-transparent outline-none"><option value="d" ${F.sort=='d'?'selected':''}>En tu sede primero</option><option value="p" ${F.sort=='p'?'selected':''}>Menor precio</option><option value="r" ${F.sort=='r'?'selected':''}>Más recientes</option></select></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-5 items-center"><span class="text-xs font-bold text-navy shrink-0">🎒 Para tu carrera</span>${CARR.map(c=>`<button class="chip ${F.car==c?'on':''}" onclick="F.car='${c}';R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-3 items-center"><span class="text-xs font-bold text-navy shrink-0">✨ Estado</span>${['Todos','Nuevo','Semi nuevo','Usado'].map(c=>`<button class="chip ${F.cond==c?'on':''}" onclick="F.cond='${c}';R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 overflow-x-auto no-sb px-5 mt-3"><button class="chip ${F.cp<0?'on':''}" onclick="F.cp=-1;R(1)">🎓 Todos los campus</button>${CAMP.map((c,i)=>`<button class="chip ${F.cp==i?'on':''}" onclick="F.cp=${i};R(1)">${c}</button>`).join('')}</div>
 <div class="flex gap-2 px-5 mt-3 items-center">${[['all','Todos'],['official','Oficiales ✓'],['community','Comunidad']].map(a=>`<button class="chip ${F.src==a[0]?'on':''}" onclick="F.src='${a[0]}';R(1)">${a[1]}</button>`).join('')}</div>
  <div class="flex gap-2 px-5 mt-2 items-center">${['Todo','Venta','Alquiler'].map(t=>`<button class="chip ${F.tab==t?'on':''}" onclick="F.tab='${t}';R(1)">${t}</button>`).join('')}${filtN()?'<button class="chip" onclick="clrF()">✕ Limpiar filtros</button>':''}<span id="cnt" class="ml-auto text-xs text-slate-400">${l.length} resultado${l.length==1?'':'s'}</span></div>
 <div id="grid" class="px-5 mt-4 grid grid-cols-2 gap-x-3 gap-y-4">${gridH(l)}</div>`}
 </div>`},
detail(id){const p=P(id);if(!p)return hd('Publicación no disponible')+empty('package-x','Esta publicación ya no existe','Puede haber sido vendida o eliminada por su autor.','Volver al inicio',"root('home')");
 const s=SEL[p.s],am=p.mode=='ambos',al=p.mode=='alquiler'||(am&&S.vm=='alquiler'),n=Math.max(1,p.ph.length),rel=PR.filter(x=>x.cat==p.cat&&x.id!=id).slice(0,4),t=tag(p.mode);
 return `<div class="pb-28"><div class="relative h-80 bg-slate-100 flex items-center justify-center overflow-hidden"><div id="car" onscroll="dots()" class="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-sb">${Array.from({length:n},(_,i)=>`<div class="min-w-full h-full snap-center flex items-center justify-center bg-slate-100 relative">${pic(p,i,'!object-contain')}</div>`).join('')}</div>
  <button onclick="back()" aria-label="Volver" class="absolute top-4 left-4 bg-white rounded-full p-2 shadow"><i data-lucide="arrow-left"></i></button>
  <div class="absolute top-4 right-4 flex gap-2"><button onclick="navigator.clipboard&&navigator.clipboard.writeText(location.origin);toast('Enlace copiado')" aria-label="Compartir" class="bg-white rounded-full p-2 shadow"><i data-lucide="share-2"></i></button><button onclick="fav(${p.id})" aria-label="Guardar en favoritos" class="bg-white rounded-full p-2 shadow"><i data-lucide="heart" class="${ST.fav.includes(p.id)?'fill-red-500 text-red-500':''}"></i></button></div>
  ${n>1?`<div id="dots" class="absolute bottom-3 inset-x-0 flex justify-center gap-1.5"></div>`:''}</div>
 <div class="px-5 pt-4"><div class="flex items-start justify-between gap-2"><h1 class="text-xl font-bold leading-tight">${esc(p.t)}</h1><span class="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${t[1]}">${t[0]}</span></div>
  ${am?`<div class="grid grid-cols-2 bg-slate-100 rounded-xl p-1 mt-3 text-sm font-semibold">${['venta','alquiler'].map(m=>`<button onclick="S.vm='${m}';R(1)" class="py-1.5 rounded-lg ${S.vm==m?'bg-white shadow text-brand':'text-slate-500'}">${m=='venta'?'Comprar':'Alquilar'}</button>`).join('')}</div>`:''}
  <p class="text-3xl font-extrabold text-brand mt-2">${al?price(p,'alquiler'):sol(ST.off[id]||p.price)}${!al&&ST.off[id]?` <span class="text-xs text-mint font-bold">oferta aceptada</span>`:''}</p>
  ${al?`<p class="text-xs text-slate-500">Depósito acordado con el vendedor, se entrega aparte: ${sol(p.dep||0)}</p>`:''}
  <div class="grid grid-cols-2 gap-2 mt-4 text-sm">${[['package','Condición',p.cond],['tag','Categoría',p.cat],['map-pin','Punto de encuentro',CAMP[pcp(p)]],['shield-check','Entrega','Punto seguro del campus']].map(a=>`<div class="bg-slate-50 rounded-xl p-3"><i data-lucide="${a[0]}" class="w-4 text-brand"></i><p class="text-[11px] text-slate-500">${a[1]}</p><b class="text-[13px]">${a[2]}</b></div>`).join('')}</div>
  ${stH(p)}${carH(p)}${aiCard(p)}<h3 class="font-bold mt-4">Descripción</h3><p class="text-sm text-slate-600">${esc(p.desc)}</p>
  <div onclick="nav('seller',${p.s})" class="mt-4 border rounded-2xl p-3 flex items-center gap-3 cursor-pointer"><div class="w-12 h-12 rounded-full bg-brand text-white grid place-items-center font-bold">${s.n[0]}</div><div class="flex-1"><p class="font-bold text-sm">${s.n} ${s.official?offBadge():'<i data-lucide="badge-check" class="inline w-4 text-brand"></i>'}${window.onlineDot?onlineDot(s.uid):''}</p><p class="text-xs text-slate-500">${s.official?'Vendedor oficial de U2U · UPC':profLine(s)}</p>${s.official?'':verTag(s)}<p class="text-xs text-amber-500">${rtH(p.s)}</p></div><i data-lucide="chevron-right" class="text-slate-400"></i></div>
  <div class="mt-3 bg-emerald-50 text-emerald-800 rounded-2xl p-3 text-xs flex gap-2"><i data-lucide="shield-check" class="w-5 shrink-0"></i><span><b>Punto Seguro UPC:</b> entrega en ${SD[pcp(p)].pt} de ${CAMP[pcp(p)]}. Ambos presentan carné UPC y la entrega se confirma con un código de 6 dígitos. Paga directamente al vendedor al entregar, en el punto seguro.</span></div>
  ${((LV.me&&p.own==LV.me.uid)||p.s==ME)?`<button onclick="myProductDelete(${p.id})" class="mt-3 text-xs text-red-600 flex items-center gap-1 font-semibold"><i data-lucide="trash-2" class="w-3.5"></i>Eliminar mi publicación</button>`:reportBtn(p)}
  ${rel.length?`<h3 class="font-bold mt-5 mb-2">Similares</h3><div class="grid grid-cols-2 gap-3">${rel.map(card).join('')}</div>`:''}</div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3 flex gap-2 z-20"><button onclick="openChat(${id})" class="p-3 border border-brand text-brand rounded-2xl"><i data-lucide="message-circle"></i></button>
  ${!al?`<button onclick="offerM(${id})" class="px-4 border border-brand text-brand rounded-2xl font-semibold text-sm">Hacer oferta</button>`:''}
  ${!al&&(p.status=='reserved'||p.status=='sold')?`<button class="btn flex-1 opacity-50" disabled>${p.status=='sold'?'Vendido':'Reservado por otro estudiante'}</button>`:`<button onclick="startCO(${id},'${al?'alquiler':'venta'}')" class="btn flex-1">${al?'Alquilar ahora':'Comprar'}</button>`}</div>`},
seller(i){const s=SEL[i],l=PR.filter(p=>p.s==i);return hd('Perfil del vendedor')+`<div class="p-5 pb-24"><div class="flex items-center gap-4"><div class="w-16 h-16 rounded-full bg-brand text-white grid place-items-center text-2xl font-bold">${s.n[0]}</div><div><p class="font-bold">${s.n} ${s.official?offBadge():'<i data-lucide="badge-check" class="inline w-4 text-brand"></i>'}${window.onlineDot?onlineDot(s.uid):''}</p><p class="text-xs text-slate-500">${s.official?'Vendedor oficial de U2U · UPC':profLine(s)}</p>${s.official?'':verTag(s)}<p class="text-xs text-amber-500">${rtH(i)}</p></div></div>
 <div class="grid grid-cols-3 text-center bg-blue-50 rounded-2xl py-3 mt-4 text-xs"><div><b class="block text-base">${l.length}</b>Publicaciones</div><div><b class="block text-base">${rtOf(i).count}</b>Reseñas</div><div><b class="block text-base">${s.v}</b>Miembro desde</div></div>
 ${s.official?'':verBox(s)}
 <h3 class="font-bold mt-5 mb-2">Reseñas de estudiantes</h3>${revH(i)}
 <h3 class="font-bold mt-4 mb-2">Publicaciones</h3><div class="grid grid-cols-2 gap-3">${l.map(card).join('')}</div></div>`},
chat(){return noConn()},
msgs(){return noConn()},
map(){const l=mapL();
 return `<div class="relative h-full overflow-hidden"><div id="map" class="absolute inset-0 z-0"></div>
 <div class="absolute top-4 inset-x-4 z-10"><label class="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm"><i data-lucide="search" class="w-5 text-slate-400"></i><input value="${esc(F.q)}" onchange="F.q=this.value;R()" placeholder="Buscar en esta zona" class="flex-1 outline-none bg-transparent"></label><div class="flex gap-2 mt-2">${['Todo','Venta','Alquiler'].map(t=>`<button onclick="F.tab='${t}';R()" class="chip shadow ${F.tab==t?'on':''}">${t=='Todo'?'Todos':t}</button>`).join('')}</div><div class="flex gap-2 mt-2 overflow-x-auto no-sb">${['Todos',...CAMP.map(c=>c.replace('UPC ',''))].map((c,i)=>`<button class="chip shadow ${F.cp==i-1?'on':''}" onclick="F.cp=${i-1};R()">${c}</button>`).join('')}</div></div>
 <div id="sheet" class="absolute inset-x-0 bottom-0 h-[78%] bg-white rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,.15)] z-20 flex flex-col" style="transform:translateY(calc(100% - 230px))"><div id="hdl" class="py-3 cursor-grab touch-none" onclick="sh()"><div class="w-10 h-1.5 bg-slate-300 rounded mx-auto"></div></div>
 <p class="px-5 font-bold text-brand">${l.length} productos cerca de ti</p><div class="overflow-y-auto no-sb px-5 pb-28 divide-y">${l.map(p=>`<div onclick="openP(${p.id})" class="flex gap-3 py-3 cursor-pointer"><div class="w-20 h-20 rounded-xl overflow-hidden">${pic(p)}</div><div><p class="font-bold text-sm">${esc(p.t)}</p><span class="text-[10px] px-2 py-0.5 rounded-full ${tag(p.mode)[1]}">${tag(p.mode)[0]}</span><p class="font-extrabold text-brand">${price(p)}</p><p class="text-xs text-slate-500">📍 ${CAMP[pcp(p)]}</p></div></div>`).join('')}</div></div></div>`},
profile(){const me=PR.filter(p=>p.s==ME),n=me.length,fv=PR.filter(p=>ST.fav.includes(p.id)),tabs=[['pub','Publicaciones'],['fav','Favoritos'],['ord','Pedidos']];
 return `<div class="p-5 pb-28"><div class="flex justify-between"><h1 class="text-2xl font-bold">Mi cuenta</h1><button onclick="openCuenta()" aria-label="Mi cuenta: editar datos"><i data-lucide="settings"></i></button></div>
 <div class="flex items-center gap-4 mt-4"><div class="w-16 h-16 rounded-full bg-brand text-white grid place-items-center text-2xl font-bold">${esc(uname()||'?')[0].toUpperCase()}</div><div><p class="font-bold">${esc(uname())} <i data-lucide="badge-check" class="inline w-4 text-brand"></i></p><p class="text-xs text-slate-500">${profLine(SEL[ME])}</p><p class="text-xs text-amber-500">${rtH(ME)}</p></div></div>
 ${acctBox()}${LV.adm?adminBtn():''}${offBtn().replace('mx-5 mt-4 w-[calc(100%-2.5rem)]','mt-3 w-full')}
 <div class="mt-3 rounded-2xl p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center gap-3"><i data-lucide="leaf" class="w-9 h-9"></i><div><p class="font-bold">${n} artículo${n==1?'':'s'} reutilizado${n==1?'':'s'}</p></div></div>
 <div class="grid grid-cols-3 mt-4 bg-slate-100 rounded-xl p-1 text-xs font-semibold">${tabs.map(t=>`<button onclick="PT='${t[0]}';R(1)" class="py-2 rounded-lg ${PT==t[0]?'bg-white shadow text-brand':'text-slate-500'}">${t[1]}</button>`).join('')}</div>
 <div class="mt-4">${PT=='pub'?`<div class="grid grid-cols-2 gap-3">${me.map(card).join('')||''}</div>${me.length?'':empty('package-plus','Aún no publicaste nada','Vende o alquila lo que ya no usas y ayuda a otro estudiante.','Publicar ahora','startPub()')}`:PT=='fav'?`<div class="grid grid-cols-2 gap-3">${fv.map(card).join('')}</div>${fv.length?'':empty('heart','Aún no tienes favoritos','Toca el corazón de un producto para guardarlo y encontrarlo aquí.','Explorar productos',"root('home')")}`:ordersTab()}</div>
 <button onclick="manifM()" class="w-full mt-6 bg-blue-50 text-brand font-semibold py-3 rounded-2xl">💡 Manifiesto U2U · UPC</button>
 <button onclick="logout()" class="w-full mt-3 border border-brand text-brand font-semibold py-3 rounded-2xl">Cerrar sesión</button></div>`},
co(){if(CO.to<CO.from)CO.to=CO.from;
 const p=P(CO.id),al=CO.mode=='alquiler',d=days(),b=al?p.rent*d:(ST.off[p.id]||p.price),dl=CO.del=='home'?15:0,dep=al?(p.dep||0):0,tot=b+dl;
 return hd(al?'Confirmar alquiler':'Confirmar compra')+`<div class="p-5 pb-32"><div class="flex gap-3 border rounded-2xl p-3"><div class="w-16 h-16 rounded-xl overflow-hidden">${pic(p)}</div><div><p class="font-bold text-sm">${esc(p.t)}</p><p class="text-brand font-extrabold">${price(p,CO.mode)}</p><p class="text-xs text-slate-500">Vende ${SEL[p.s].n}</p></div></div>
 ${al?`<h3 class="font-bold mt-4">Fechas</h3><div class="grid grid-cols-2 gap-3"><div><label class="text-xs">Inicio</label><input type="date" class="inp" min="${fd(0)}" value="${CO.from}" onchange="CO.from=this.value;if(CO.to<this.value)CO.to=this.value;R(1)"></div><div><label class="text-xs">Fin</label><input type="date" class="inp" min="${CO.from}" value="${CO.to}" onchange="CO.to=this.value;R(1)"></div></div>`:''}
 <h3 class="font-bold mt-2">Entrega</h3>${[['meet','handshake','Punto de encuentro en campus','Gratis · zona segura'],['home','truck','Delivery a domicilio','S/ 15 · coordinado con el vendedor']].map(a=>`<div onclick="CO.del='${a[0]}';R(1)" class="flex gap-3 items-center border-2 rounded-2xl p-3 mb-2 cursor-pointer ${CO.del==a[0]?'border-brand bg-blue-50':'border-slate-200'}"><i data-lucide="${a[1]}" class="text-brand"></i><div><b class="text-sm">${a[2]}</b><p class="text-xs text-slate-500">${a[3]}</p></div></div>`).join('')}
 ${CO.del=='meet'?`<select class="inp" onchange="CO.cp=this.value">${CAMP.map((c,i)=>`<option value="${i}" ${CO.cp==i?'selected':''}>${c}</option>`).join('')}</select>`:''}
  <h3 class="font-bold mt-2">¿Cómo le pagarás al vendedor?</h3>
  <p class="text-xs text-slate-500 mb-2">Pago directo al encontrarse en el campus:</p>
  ${[['yape','📱 Yape'],['plin','🟣 Plin'],['cash','💵 Efectivo contraentrega']].map(a=>`<label class="flex gap-2 items-center border rounded-xl p-3 mb-2 text-sm cursor-pointer ${CO.pay==a[0]?'border-brand bg-blue-50 font-semibold':'border-slate-200'}"><input type="radio" name="pm" class="accent-brand" ${CO.pay==a[0]?'checked':''} onchange="CO.pay='${a[0]}';R(1)">${a[1]}</label>`).join('')}
  <div class="bg-blue-50 text-navy rounded-xl p-2.5 text-xs flex gap-2 items-center mb-3"><i data-lucide="info" class="w-4 h-4 shrink-0 text-brand"></i><span>Pagas directamente al vendedor al encontrarse en el punto seguro y revisar el producto.</span></div>
  <div class="bg-slate-50 rounded-2xl p-4 mt-3 text-sm space-y-1">
    <div class="flex justify-between"><span>${al?sol(p.rent)+' × '+d+' día'+(d>1?'s':''):'Precio acordado'}</span><b>${sol(b)}</b></div>
    ${al&&dep?`<div class="flex justify-between text-amber-700"><span>Garantía (informativa · no se paga en la app)</span><b>${sol(dep)}</b></div>`:''}
    <div class="flex justify-between"><span>Entrega en campus</span><b>${dl?sol(dl):'Gratis'}</b></div>
    <div class="flex justify-between border-t pt-2 text-base"><span>Total del pedido</span><b class="text-brand">${sol(tot)}</b></div>
    ${al?`<p class="text-[11px] text-slate-500 pt-1">La garantía reembolsable (${sol(dep)}) se entrega al recibir y el vendedor te la devuelve íntegra al devolver el equipo en buen estado.</p>`:''}
  </div>
 <label class="flex gap-2 items-start text-xs mt-3"><input type="checkbox" class="mt-0.5" ${CO.terms?'checked':''} onchange="CO.terms=this.checked;R(1)">Acepto los Términos y condiciones y las Políticas de uso de U2U.</label></div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3"><button class="btn" ${CO.terms?'':'disabled'} onclick="pay(${tot})">Confirmar reserva (${sol(tot)})</button></div>`},
publish(){const D=PUB,a=D.ai,lb=t=>`<label class="text-xs font-semibold block mt-3">${t}</label>`;
 const form=`${a?`<div class="mt-4 bg-purple-50 text-purple-700 rounded-xl p-3 text-xs font-semibold flex gap-2 items-center flex-wrap"><i data-lucide="sparkles" class="w-4"></i>Etiquetas:${(a.tags||[]).map(t=>`<span class="bg-white rounded-full px-2 py-0.5">${t}</span>`).join('')}</div>`:''}
 ${lb('Título')}<input class="inp" maxlength="60" value="${esc(D.t)}" oninput="PUB.t=this.value">
 ${lb('Categoría')}<select class="inp" onchange="PUB.cat=this.value">${CATS.slice(1).map(c=>`<option ${D.cat==c[0]?'selected':''}>${c[0]}</option>`).join('')}</select>
 ${lb('Estado')}<div class="flex gap-2 mt-1">${['Nuevo','Semi nuevo','Usado'].map(c=>`<button onclick="PUB.cond='${c}';R(1)" class="chip ${D.cond==c?'on':''}">${c}</button>`).join('')}</div>
 ${lb('¿Para qué carreras sirve?')}<div class="flex flex-wrap gap-2 mt-1">${CARR.slice(1).map(c=>`<button onclick="togCar('${c}')" class="chip ${(D.car||[]).includes(c)?'on':''}">${c}</button>`).join('')}</div><p class="text-[11px] text-slate-400 mt-1">Sin selección = sirve para todas las carreras.</p>
 ${lb('¿Qué quieres hacer?')}<div class="grid grid-cols-3 gap-2 mt-1">${[['venta','Vender'],['alquiler','Alquilar'],['ambos','Ambos']].map(x=>`<button onclick="PUB.mode='${x[0]}';R(1)" class="py-2.5 rounded-xl border-2 text-sm font-bold ${D.mode==x[0]?'border-brand bg-blue-50 text-brand':'border-slate-100 text-slate-500'}">${x[1]}</button>`).join('')}</div>
 ${D.mode!='alquiler'?`${lb('Precio de venta (S/)')}<input type="number" class="inp" value="${D.price}" oninput="PUB.price=this.value">${a&&a.price?`<button onclick="PUB.price=${a.price};R(1)" class="text-[11px] text-purple-600 font-semibold -mt-2 mb-2">✨ Sugerido por IA: ${sol(a.price)} · rango ${sol(Math.round(a.price*.9))} – ${sol(Math.round(a.price*1.08))}</button>`:''}`:''}
 ${D.mode!='venta'?`${lb('Alquiler por día (S/)')}<input type="number" class="inp" value="${D.rent}" oninput="PUB.rent=this.value">${a&&a.rent?`<button onclick="PUB.rent=${a.rent};R(1)" class="text-[11px] text-purple-600 font-semibold -mt-2 mb-2">✨ Sugerido por IA: ${sol(a.rent)}/día</button>`:''}${lb('Depósito de garantía (S/)')}<input type="number" class="inp" value="${D.dep}" oninput="PUB.dep=this.value">`:''}
 ${lb('Punto de entrega')}<select class="inp" onchange="PUB.cp=this.value">${CAMP.map((c,i)=>`<option value="${i}" ${D.cp==i?'selected':''}>${c}</option>`).join('')}</select>
 ${lb('Descripción')}<textarea class="inp h-24" oninput="PUB.desc=this.value">${esc(D.desc)}</textarea>`;
 return hd('Publicar')+`<div class="p-5 pb-28">
  <div class="rounded-2xl p-4 text-white flex gap-3 items-center" style="background:linear-gradient(135deg,#2f4bd8,#1e3a8a)"><i data-lucide="camera" class="w-8 h-8 shrink-0"></i><div><p class="font-bold">Publica tu artículo</p><p class="text-xs opacity-90">Sube hasta 3 fotos y completa título, estado y precio. Las plantillas rápidas te ahorran escribir.</p></div></div>
  <h3 class="font-bold mt-5 mb-2 text-sm">Fotos de tu producto</h3>
  <div class="flex gap-3 overflow-x-auto no-sb pb-1">
    <label class="shrink-0 w-24 text-center cursor-pointer"><span class="grid place-items-center w-24 h-24 rounded-2xl border-2 border-dashed border-brand bg-blue-50/60 text-brand shadow-sm"><i data-lucide="camera" class="w-8 h-8"></i></span><span class="text-[11px] font-bold text-navy mt-1 block">+ Subir foto</span><input type="file" accept="image/*" class="hidden" onchange="upF(this)"></label>
    
  </div>
  <h3 class="font-bold mt-4 mb-2 text-sm">Plantillas rápidas</h3><div class="flex gap-2 flex-wrap">${SAMPLES.map((x,i)=>`<button class="chip" onclick="pickS(${i})">Plantilla: ${x.l}</button>`).join('')}</div>
 ${D.ph.length?`<div class="flex gap-2 mt-3 overflow-x-auto no-sb">${D.ph.map((f,i)=>`<div class="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden"><img src="${src(f)}" alt="Foto ${i+1} del producto" class="w-full h-full object-cover"><button onclick="PUB.ph.splice(${i},1);R(1)" aria-label="Quitar" class="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-none">×</button></div>`).join('')}</div>${form}`:'<p class="text-center text-slate-400 text-sm py-10">Elige una foto para empezar ✨</p>'}</div>
 <div class="absolute bottom-0 inset-x-0 bg-white border-t p-3"><button class="btn" onclick="pubGo()">Publicar ahora</button></div>`}};
