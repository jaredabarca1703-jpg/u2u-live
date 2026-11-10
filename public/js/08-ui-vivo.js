/* ---------- Filtros del catálogo ---------- */
const carOk=p=>{const c=p.car;return !c||!c.length||c.includes(F.car)};
const filtN=()=>(F.car!='Todas')+(F.cond!='Todos')+(F.cp>=0)+(F.cat!='Todo')+(F.tab!='Todo')+(F.src!='all');
function clrF(){F.car='Todas';F.cond='Todos';F.cp=-1;F.cat='Todo';F.tab='Todo';F.src='all';R(1)}
function togCar(c){const a=PUB.car=PUB.car||[],i=a.indexOf(c);i<0?a.push(c):a.splice(i,1);R(1)}
const carH=p=>{const c=p.car||[];return c.length?`<div class="mt-3"><p class="text-[11px] text-slate-500 mb-1">🎒 Útil para</p><div class="flex flex-wrap gap-1.5">${c.map(x=>`<span class="text-[11px] font-semibold bg-blue-50 text-brand rounded-full px-2.5 py-1">${esc(x)}</span>`).join('')}</div></div>`:''};
const stH=p=>p.status=='reserved'?'<div class="mt-3 bg-amber-50 text-amber-800 rounded-2xl p-3 text-xs flex gap-2"><i data-lucide="clock" class="w-5 shrink-0"></i><span><b>Reservado:</b> otro estudiante ya inició la compra. Si se cancela, vuelve a estar disponible.</span></div>':p.status=='sold'?'<div class="mt-3 bg-slate-100 text-slate-600 rounded-2xl p-3 text-xs">Este producto ya fue vendido.</div>':'';

/* ---------- Publicaciones compartidas en vivo ---------- */
const RS={};/* publicadores remotos: uid -> índice en SEL */
function sellerIdx(uid,name,cp,off){if(LV.me&&uid==LV.me.uid)return ME;let i=RS[uid];
 if(i==null){SEL.push({n:name,uid,r:0,c:0,car:off?'Vendedor oficial':'Estudiante UPC',cp,v:new Date().getFullYear(),ci:'—',official:!!off});i=RS[uid]=SEL.length-1}
 else{SEL[i].n=name;SEL[i].cp=cp;if(off)SEL[i].official=true}return i}
function addRemote(d){if(!d||!d.id)return false;const ex=P(d.id);
 if(ex){if(d.status&&ex.status!=d.status){ex.status=d.status;return true}return false}
 const s=sellerIdx(d.ownerUid,d.ownerName,d.cp,d.official),mine=s==ME;if(mine)SEL[ME].cp=d.cp;else if(d.ownerProfile)SEL[s].prof=d.ownerProfile;
 PR.unshift({id:d.id,t:d.t,ph:d.ph,cat:d.cat,mode:d.mode,price:d.price,rent:d.rent,dep:d.dep,cond:d.cond,car:d.car||[],official:!!d.official,status:d.status||'available',d:mine?0.3:+(DK[d.cp]+((d.id*13)%9)/10).toFixed(1),s,x:50,y:44,ts:99,desc:d.desc,e:'📦',own:d.ownerUid,remote:!mine});
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

