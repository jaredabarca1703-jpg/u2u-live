/* ===== v8.4.0: reportes, reseñas verificadas y panel de moderación (el rol admin lo decide el servidor) ===== */
function dropProduct(id,live){id=+id;const i=PR.findIndex(p=>p.id==id);if(i<0)return;const mine=PR[i].s==ME;PR.splice(i,1);ST.fav=ST.fav.filter(f=>f!=id);save();
 if(live&&S.s=='detail'&&S.a==id){toast('Esta publicación fue eliminada por moderación');back()}
 else if(live&&mine)toast('Una de tus publicaciones fue eliminada por incumplir las normas');
 refreshCatalog();if(['profile','msgs','admin'].includes(S.s))R(1)}
const agoT=ts=>{const m=Math.max(1,Math.round((Date.now()-ts)/6e4));return m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' d'};

/* Reportar publicación: el servidor guarda el motivo y no deja reportar lo mismo dos veces */
const RSN=[['obscena','Contenido obsceno','Imágenes o texto inapropiados'],['estafa','Posible estafa','Pide pagos fuera de U2U o datos sospechosos'],['falsa','Información falsa','El producto no es lo que dice o está mal descrito'],['otro','Otro','Cuéntanos qué pasa']];
let RP={id:0,r:'',n:''};
const reportBtn=p=>{if(LV.adm)return `<button onclick="admDelete(${p.id})" class="mt-3 text-xs text-red-600 flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5"></i>Eliminar esta publicación (moderación)</button>`;return LV.rep.has(+p.id)?`<p class="mt-3 text-xs text-slate-400 flex items-center gap-1"><i data-lucide="flag" class="w-3.5"></i>Ya reportaste esta publicación</p>`:`<button onclick="reportM(${p.id})" class="mt-3 text-xs text-slate-500 flex items-center gap-1"><i data-lucide="flag" class="w-3.5"></i>Reportar publicación</button>`};
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
 body=AT=='off'?offList():AT=='open'?(open.map(repCard).join('')||empty('shield-check','Sin reportes pendientes','Cuando alguien reporte una publicación aparecerá aquí.')):AT=='done'?(done.map(repCard).join('')||empty('inbox','Aún no hay reportes resueltos','')):(d.blocked.map(blkCard).join('')||empty('user-check','No hay usuarios bloqueados',''));
 return hd('Moderación')+`<div class="p-5 pb-28"><div class="grid grid-cols-4 bg-slate-100 rounded-xl p-1 text-[11px] font-semibold mb-4">${tab('open','Pendientes',open.length)}${tab('done','Resueltos',0)}${tab('off','Oficiales',PR.filter(p=>p.official).length)}${tab('blk','Bloqueados',d.blocked.length)}</div>${body}</div>`};
function admEmit(ev,data,ok){if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');sock.emit(ev,data,r=>{if(r&&r.error)return toast(r.error);if(ok)toast(ok)})}
function admView(pid){if(!P(pid))return toast('La publicación ya no existe');openP(pid)}
async function admDelete(pid){if(!await askConfirm({title:'¿Eliminar esta publicación?',msg:'Desaparecerá para todos al instante y se resolverán sus reportes.',ok:'Sí, eliminar',no:'Volver',danger:1,icon:'trash-2'}))return;admEmit('admin:delete',{pid},'Publicación eliminada');setTimeout(()=>{if(S.s=='admin')R(1)},350)}
function admDismiss(id){admEmit('admin:dismiss',{id},'Reporte descartado')}
async function admBlock(uid){const r=LV.rpt&&LV.rpt.reports.find(x=>x.ownerUid==uid);if(!await askConfirm({title:'¿Bloquear a '+esc(r?r.ownerName:'este usuario')+'?',msg:'No podrá iniciar sesión y todas sus publicaciones se eliminarán.',ok:'Sí, bloquear',no:'Volver',danger:1,icon:'ban'}))return;admEmit('admin:block',{uid},'Usuario bloqueado')}
function admUnblock(uid){admEmit('admin:unblock',{uid},'Usuario desbloqueado')}

/* ===== v8.6.0: cuenta oficial (insignia, filtro, chat directo) ===== */
function srcOk(p){return F.src=='all'||(F.src=='official')===!!p.official}
const offP=()=>({id:0,t:'Chat con '+(LV.off?LV.off.name:'U2U Oficial'),ph:[],e:'🎓',mode:'venta',price:0,s:LV.off?sellerIdx(LV.off.uid,LV.off.name,0,true):0,official:true});
function chatOff(){if(!window.io||!LV.me)return toast('Inicia sesión para chatear');if(!LV.off)return toast('La cuenta oficial no está disponible ahora');if(LV.adm)return nav('msgs');nav('lchat','0|'+LV.me.uid)}
const offBtn=()=>LV.off&&!LV.adm?`<button onclick="chatOff()" class="mx-5 mt-4 w-[calc(100%-2.5rem)] flex items-center gap-3 border-2 border-blue-200 bg-blue-50 text-navy rounded-2xl p-3 text-left active:scale-[.98] transition"><span class="text-2xl">🎓</span><span class="flex-1"><b class="text-sm block">Chatear con ${esc(LV.off.name)} <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white align-middle">Oficial ✓</span></b><span class="text-xs text-slate-500">Dudas, ayuda con tu primera publicación y pedidos</span></span><i data-lucide="chevron-right" class="text-slate-400"></i></button>`:'';
const offBadge=()=>'<span class="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white align-middle">Oficial ✓</span>';
const SEEN_K='u2useen',seenGet=()=>{try{return JSON.parse(localStorage.getItem(SEEN_K)||'{}')}catch(e){return{}}};
function seenSet(k){const s=seenGet();s[k]=Date.now();const ks=Object.keys(s);if(ks.length>300)delete s[ks[0]];try{localStorage.setItem(SEEN_K,JSON.stringify(s))}catch(e){}}
function unSeen(c){const s=seenGet()[c.key];if(s===undefined)return(c.welcome&&c.buyerId==LV.me.uid)?1:0;return c.msgs.filter(m=>m.uid!=LV.me.uid&&m.ts>s).length}
function offList(){const l=PR.filter(p=>p.official).sort((a,b)=>b.id-a.id);return l.length?l.map(p=>`<div class="border rounded-2xl p-3 mb-3 flex gap-3 items-center"><div class="w-14 h-14 rounded-xl overflow-hidden shrink-0">${pic(p)}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${esc(p.t)}</p><p class="text-xs text-slate-500">${price(p)}${p.status=='sold'?' · Vendido':p.status=='reserved'?' · Reservado':''}</p></div><button class="chip" onclick="admView(${p.id})">Ver</button><button class="chip !bg-red-50 !text-red-600" onclick="admDelete(${p.id})">Eliminar</button></div>`).join(''):empty('package','Sin productos oficiales','Se crean desde seed.json al iniciar el servidor.')}

bootInit();
