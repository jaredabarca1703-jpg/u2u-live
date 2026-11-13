/* U2U · comisión del 3 % por venta (parte B, pantallas). Script clásico, carga después de 12-cuenta.js.
 * Todo lo decide el servidor (parte A): aquí solo se muestra. Con COMMISSION_MODE=shadow u off el servidor no manda deuda ni modo activo,
 * así que este archivo no muestra ni restringe nada. Sin onclick con datos de usuario: botones con data-com + un solo escuchador. */
const COM={cfg:null,cm:null,busy:false,cur:'',adm:{items:[],summary:null,filter:'',loading:false}};
const COM_MSG='Envío de mensajes restringido. Por favor, reporta tu comisión pendiente';
const solC=c=>'S/ '+(Math.round(c)/100).toFixed(2);
const comPct=r=>{const p=Math.round(r*1000)/10;return (p%1?p.toFixed(1):String(p))+' %'};
const comOpNorm=s=>String(s==null?'':s).toUpperCase().replace(/\s+/g,'');
function comValidate(op,nm){const o=comOpNorm(op),n=String(nm==null?'':nm).replace(/\s+/g,' ').trim(),e={};
 if(!/^[A-Z0-9]{4,20}$/.test(o))e.op='Escribe el número de operación de Yape (4 a 20 letras o números, sin símbolos).';
 if(n.length<2||n.length>60)e.nm='Escribe el nombre o celular del titular (2 a 60 caracteres).';
 return{op:o,nm:n,err:e,ok:!e.op&&!e.nm}}
const comActive=()=>!!(COM.cm&&COM.cm.mode==='active');
const comItems=()=>(COM.cm&&COM.cm.items)||[];
const comTodo=()=>comItems().filter(i=>i.status==='pending_commission'||i.status==='rejected');
const comWait=()=>comItems().filter(i=>i.status==='commission_reported');
const comRestricted=()=>comActive()&&COM.cm.can_message===false;
const comToOff=k=>{const pid=parseInt(String(k).split('|')[0],10)||0;if(pid===0)return true;const p=typeof P==='function'?P(pid):null;return !!(p&&p.official)}; /* el chat con U2U Oficial siempre queda activo */
const comTk=()=>(typeof tkGet==='function'?tkGet():null);

/* ---------- datos: al abrir la app (GET /api/me/commissions) y en vivo (evento 'commission') ---------- */
async function comLoad(){if(typeof LV==='undefined'||!LV.me||LV.adm){COM.cm=null;COM.cfg=null;return comUI()}const tk=comTk();if(!tk)return;
 const [a,b]=await Promise.all([api('me/commissions',null,tk),api('config/commission',null,tk)]);
 if(b.ok&&b.j&&b.j.ok)COM.cfg={mode:b.j.mode,rate:b.j.rate};
 if(a.ok&&a.j&&a.j.ok)COM.cm={mode:a.j.mode,can_message:a.j.can_message,due:a.j.due,items:a.j.items||[],yape:a.j.yape||null};
 comUI()}
function comBind(){if(typeof sock==='undefined'||!sock||sock.__com)return;sock.__com=1;
 sock.on('commission',d=>{COM.cm=Object.assign({},COM.cm,d,{mode:'active'});comUI();comLoad()});
 const em=sock.emit; /* cualquier respuesta FEE_DUE del servidor (enviar, publicar, reservar) → aviso + modal */
 sock.emit=function(){const a=[].slice.call(arguments),n=a.length-1;
  if(typeof a[n]==='function'){const f=a[n];a[n]=function(r){if(r&&r.code==='FEE_DUE')comFeeDue(r);return f.apply(this,arguments)}}
  return em.apply(this,a)}}
function comFeeDue(r){toast((r&&r.error)||COM_MSG);comLoad().then(()=>comModal())}
function comAfterSale(){comLoad().then(()=>{if(comTodo().length)comModal(true)})}

/* ---------- 1. modal de cobro ---------- */
function comModal(first){if(!comActive())return;const todo=comTodo(),it=todo[0];
 if(!it){M(`<div class="bg-white w-full rounded-t-3xl p-7 text-center pop" role="dialog" aria-modal="true" aria-labelledby="cmt"><div class="w-16 h-16 bg-amber-100 rounded-full grid place-items-center mx-auto text-3xl" aria-hidden="true">⏳</div><p id="cmt" class="font-extrabold text-xl mt-3 text-navy">Pago en revisión</p><p class="text-sm text-slate-500 mt-1">${comWait().length?'El equipo U2U está verificando tu pago. Apenas lo apruebe podrás escribir de nuevo.':'No tienes comisiones pendientes.'}</p><button class="btn mt-5" onclick="X()">Entendido</button></div>`);return}
 COM.cur=it.orderId;const y=COM.cm.yape,total=todo.reduce((s,i)=>s+i.amount,0),lb='text-xs font-semibold text-slate-600';
 M(`<div class="bg-white w-full rounded-t-3xl p-6 pop max-h-[92%] overflow-y-auto no-sb" role="dialog" aria-modal="true" aria-labelledby="cmt">
 <p id="cmt" class="font-extrabold text-xl text-navy text-center">${first?'¡Venta exitosa!':'Reportar pago de comisión'}</p>
 ${it.status==='rejected'?`<p class="mt-3 text-xs bg-red-50 text-red-700 rounded-xl p-3">Tu reporte fue rechazado${it.rejectReason?': '+esc(it.rejectReason):''}. Revisa los datos y repórtalo de nuevo con el número de operación correcto.</p>`:''}
 <p class="text-sm text-slate-600 mt-3 leading-snug">Para mantener tu cuenta activa y seguir enviando mensajes, paga la comisión de servicio de U2U (${comPct((COM.cfg&&COM.cfg.rate)||0.03)}): <b class="text-navy">${solC(it.amount)}</b> ${y?`por Yape al <b class="text-navy select-all">${esc(y.number)}</b>${y.holder?' a nombre de <b class="text-navy">'+esc(y.holder)+'</b>':''}`:'por Yape. Escríbele a U2U Oficial para recibir el número de pago'}.</p>
 ${todo.length>1?`<p class="text-[11px] text-slate-500 mt-2">Tienes ${todo.length} comisiones pendientes (${solC(total)}). Se reportan una por una.</p>`:''}
 ${y?`<button type="button" data-com="copy" class="chip mt-3">📋 Copiar número</button>`:''}
 <label class="${lb} block mt-4" for="cm_op">Número de operación de Yape</label><input id="cm_op" class="inp" style="font-size:16px" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ej. 12345678"><p id="cm_e_op" role="alert" class="text-red-500 text-xs -mt-2 mb-2 min-h-[1rem]"></p>
 <label class="${lb} block" for="cm_nm">Nombre o celular del titular</label><input id="cm_nm" class="inp" style="font-size:16px" maxlength="60" autocomplete="off" placeholder="Quién hizo el Yape"><p id="cm_e_nm" role="alert" class="text-red-500 text-xs -mt-2 mb-2 min-h-[1rem]"></p>
 <p id="cm_e_gen" role="alert" class="text-red-500 text-xs text-center min-h-[1rem]"></p>
 <button id="cm_go" type="button" data-com="go" class="btn">Reportar pago</button><button type="button" class="w-full py-3 text-slate-500 font-semibold" onclick="X()">Pagar después</button>
 <p class="text-[10px] text-slate-400 text-center">Si no pagas, no podrás enviar mensajes hasta que U2U apruebe tu pago. El número de operación solo lo ve el administrador.</p></div>`)}
async function comReport(){if(COM.busy||!COM.cur)return;const g=id=>document.querySelector('#'+id),set=(id,t)=>{const e=g(id);if(e)e.textContent=t||''};
 const v=comValidate((g('cm_op')||{}).value,(g('cm_nm')||{}).value);set('cm_e_op',v.err.op);set('cm_e_nm',v.err.nm);set('cm_e_gen','');if(!v.ok)return;
 COM.busy=true;const b=g('cm_go');if(b){b.disabled=true;b.textContent='Enviando…'}
 const r=await api('orders/'+encodeURIComponent(COM.cur)+'/report-yape',{operationNumber:v.op,senderName:v.nm},comTk());COM.busy=false;
 if(r.ok&&r.j&&r.j.ok){await comLoad();toast('Pago en revisión');return comModal()}
 if(b){b.disabled=false;b.textContent='Reportar pago'}const j=r.j||{},m=j.error||(r.status==0?'No hay conexión con el servidor. Reintenta en unos segundos.':'No se pudo enviar. Intenta de nuevo.');
 if(j.field==='operationNumber')set('cm_e_op',m);else if(j.field==='senderName')set('cm_e_nm',m);else set('cm_e_gen',m);
 if(j.code==='NOT_FOUND')comLoad()}
function comCopy(){const n=COM.cm&&COM.cm.yape&&COM.cm.yape.number;if(!n)return;
 const ok=()=>toast('Número copiado'),old=()=>{const t=document.createElement('textarea');t.value=n;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();try{document.execCommand('copy');ok()}catch(e){toast('Cópialo a mano: '+n)}t.remove()};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(n).then(ok,old);else old()}

/* ---------- 2. aviso permanente ---------- */
function comBannerH(){if(!comActive())return '';const t=comTodo(),w=comWait();if(!t.length&&!w.length)return '';
 const sum=t.reduce((s,i)=>s+i.amount,0);
 return `<button type="button" data-com="banner" class="com-b mx-5 mt-4 w-[calc(100%-2.5rem)] rounded-2xl border p-3 text-xs flex gap-2 items-center text-left ${t.length?'bg-amber-50 border-amber-200 text-amber-900':'bg-blue-50 border-blue-200 text-navy'}"><span class="text-lg" aria-hidden="true">${t.length?'💳':'⏳'}</span><span class="flex-1">${t.length?`<b>Tienes una comisión pendiente de ${solC(sum)}</b> · <u>Reportar pago</u>`:'<b>Tu pago está en revisión</b>'}</span></button>`}

/* ---------- 3. chat restringido + 4. transparencia: se aplican sobre el DOM después de cada render ---------- */
function comChatUI(){if(S.s!=='lchat')return;const ci=document.querySelector('#v #ci');if(!ci)return;
 const sb=document.querySelector('#v button[aria-label="Enviar"]'),chips=[...document.querySelectorAll('#v .chip[onclick^="lsend("]')],off=comToOff(S.a),res=comRestricted();
 if(res&&!off){if(ci.dataset.ph===undefined)ci.dataset.ph=ci.placeholder;ci.disabled=true;ci.placeholder=COM_MSG;if(sb)sb.disabled=true;chips.forEach(c=>{c.disabled=true;c.style.opacity='.5'})}
 else{if(ci.dataset.ph!==undefined){ci.placeholder=ci.dataset.ph;delete ci.dataset.ph}ci.disabled=false;if(sb)sb.disabled=false;chips.forEach(c=>{c.disabled=false;c.style.opacity=''})}
 if(res&&off&&ci.parentElement)ci.parentElement.insertAdjacentHTML('afterend','<p class="com-b px-4 pb-2 text-xs text-slate-500">Tienes una comisión pendiente. <button type="button" data-com="banner" class="font-bold text-brand underline">Reportar comisión</button></p>')}
const comTransH=()=>{const c=COM.cfg;return c&&c.mode&&c.mode!=='off'?`<p class="com-b text-[11px] text-slate-500 mt-3 flex gap-1.5 items-start"><span aria-hidden="true">ℹ️</span><span>Comisión de servicio U2U: ${comPct(c.rate)} al confirmar la entrega</span></p>`:''};
function comTransUI(){const h=comTransH();if(!h)return;let box=null;
 if(S.s==='publish')box=document.querySelector('#v .p-5');
 else if(S.s==='detail')box=document.querySelector('#v .px-5.pt-4');
 else if(S.s==='co')box=document.querySelector('#v .bg-slate-50.rounded-2xl.p-4');
 if(box)box.insertAdjacentHTML(S.s==='co'?'beforeend':'beforeend',h);
 document.querySelectorAll('#v .pin-in').forEach(i=>{const b=i.closest('.bg-blue-50');if(b&&!b.querySelector('.com-b'))b.insertAdjacentHTML('beforeend',h)})} /* resumen del pedido (lado del vendedor) */
function comUI(){try{const v=document.querySelector('#v');if(!v)return;document.querySelectorAll('.com-b').forEach(e=>e.remove());
 if(['home','map','msgs','profile'].includes(S.s)){const b=comBannerH();if(b)v.insertAdjacentHTML('afterbegin',b)}
 comChatUI();comTransUI()}catch(e){}}

/* ---------- 5. Términos y Privacidad: cláusula de comisión (borrador) ---------- */
if(typeof LEGAL!=='undefined'&&Array.isArray(LEGAL)&&!LEGAL.some(x=>x[0]&&x[0].indexOf('Comisión')>=0))LEGAL.splice(Math.max(0,LEGAL.length-1),0,['Comisión de servicio de U2U (borrador por revisar con un abogado y un contador)','Qué es: U2U puede cobrar al vendedor una comisión de servicio sobre el precio de venta acordado (hoy 3 %, sin incluir otros cargos). Cuándo se genera: al confirmar la entrega con el código de 6 dígitos en la app. Cómo se paga: por Yape, al número que U2U muestra en la app; reportas el número de operación y el nombre o celular del titular, y el administrador lo verifica. Si no se paga: mientras la comisión esté pendiente no podrás enviar mensajes (sí leerlos y escribirle a U2U Oficial). Si hay un error o una disputa: escríbele a U2U Oficial por el chat para pedir que se corrija o se perdone. Datos personales: el número de operación y el nombre o celular del titular solo los ve el administrador (y tú). La comisión solo se activará después de avisar a los usuarios. Este texto es un borrador por revisar con un abogado y un contador (RUC, SUNAT y comprobantes).']);

/* ---------- 6. panel de moderación → «Comisiones» (solo admin; cada acción la revalida el servidor) ---------- */
const COM_FIL=[['','Todas'],['commission_reported','Por revisar'],['pending_commission','Pendientes'],['rejected','Rechazadas'],['completed','Cobradas'],['waived','Perdonadas'],['shadow','Sombra']];
const COM_ST={pending_commission:['Pendiente','bg-amber-100 text-amber-700'],commission_reported:['Por revisar','bg-blue-100 text-blue-700'],rejected:['Rechazada','bg-red-100 text-red-600'],completed:['Cobrada','bg-emerald-100 text-emerald-700'],waived:['Perdonada','bg-slate-100 text-slate-500'],shadow:['Sombra','bg-violet-100 text-violet-700']};
const comDate=ts=>ts?new Date(ts).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
function comAdmCard(i){const st=COM_ST[i.status]||[i.status,'bg-slate-100 text-slate-500'],id=esc(i.orderId),rep=i.status==='commission_reported',open=rep||i.status==='pending_commission'||i.status==='rejected';
 return `<div class="border rounded-2xl p-3 mb-3"><div class="flex items-start justify-between gap-2"><span class="text-[10px] font-bold px-2 py-1 rounded-full ${st[1]}">${st[0]}</span><span class="text-[10px] text-slate-400">${comDate(i.reportedAt||i.createdAt)}</span></div>
 <p class="font-bold text-sm mt-2">${solC(i.amount)} <span class="text-xs font-normal text-slate-500">de ${solC(i.base)}</span></p>
 <p class="text-xs text-slate-500">Vendedor: <b>${esc(i.sellerName)}</b> · Pedido ${id} · ${esc(i.t)}</p>
 ${i.opNumber?`<p class="text-xs bg-slate-50 rounded-xl p-2 mt-2">Operación: <b class="select-all">${esc(i.opNumber)}</b> · Titular: <b>${esc(i.senderName)}</b></p>`:''}
 ${i.rejectReason?`<p class="text-[11px] text-red-600 mt-1">Motivo del rechazo: ${esc(i.rejectReason)}</p>`:''}${i.note?`<p class="text-[11px] text-slate-500 mt-1">Perdonada: ${esc(i.note)}</p>`:''}
 ${open?`<div class="grid grid-cols-${rep?3:1} gap-2 mt-3">${rep?`<button type="button" class="chip !bg-emerald-50 !text-emerald-700" data-com="approve" data-id="${id}">✓ Aprobar</button><button type="button" class="chip !bg-red-50 !text-red-600" data-com="reject" data-id="${id}">Rechazar</button>`:''}<button type="button" class="chip" data-com="waive" data-id="${id}">Perdonar</button></div>`:''}</div>`}
function comAdmH(){const a=COM.adm;if(a.loading&&!a.items.length)return skRows(3);const s=a.summary||{potentialShadow:0,collected:0,pendingCharge:0,reportedCount:0};
 return `<div class="grid grid-cols-3 gap-2 text-center text-[11px]"><div class="bg-violet-50 rounded-2xl p-2"><b class="block text-sm text-violet-700">${solC(s.potentialShadow)}</b>Potencial (sombra)</div><div class="bg-emerald-50 rounded-2xl p-2"><b class="block text-sm text-emerald-700">${solC(s.collected)}</b>Cobrado</div><div class="bg-amber-50 rounded-2xl p-2"><b class="block text-sm text-amber-700">${solC(s.pendingCharge)}</b>Por cobrar</div></div>
 <div class="flex gap-2 overflow-x-auto no-sb mt-3 items-center">${COM_FIL.map(f=>`<button type="button" class="chip ${a.filter===f[0]?'on':''}" data-com="fil" data-id="${f[0]}">${f[1]}</button>`).join('')}<button type="button" class="chip" data-com="refresh">↻ Actualizar</button></div>
 <div class="mt-3">${a.items.map(comAdmCard).join('')||empty('inbox','Sin comisiones aquí','Aparecerán cuando un vendedor confirme una entrega con la comisión en modo sombra o activo.')}</div>`}
async function comAdmLoad(){COM.adm.loading=true;R(1);const r=await api('admin/commissions'+(COM.adm.filter?'?status='+COM.adm.filter:''),null,comTk());COM.adm.loading=false;
 if(r.ok&&r.j&&r.j.ok){COM.adm.items=r.j.items||[];COM.adm.summary=r.j.summary||null}else toast((r.j&&r.j.error)||'No se pudo cargar las comisiones');R(1)}
async function comAdmAct(kind,id,reason){const r=await api('admin/orders/'+encodeURIComponent(id)+'/'+kind,{reason:reason||''},comTk());
 if(r.ok&&r.j&&r.j.ok){toast(kind==='approve'?'Pago aprobado':kind==='reject'?'Pago rechazado':'Comisión perdonada');await comAdmLoad();return true}
 toast((r.j&&r.j.error)||'No se pudo completar');return false}
function comReasonM(kind,id){COM.cur=id;M(`<div class="bg-white w-full rounded-t-3xl p-6 pop" role="dialog" aria-modal="true" aria-labelledby="cmr"><p id="cmr" class="font-bold text-lg text-navy">${kind==='reject'?'Rechazar el pago':'Perdonar la comisión'}</p><p class="text-xs text-slate-500 mb-2">Escribe el motivo: ${kind==='reject'?'el vendedor lo verá y podrá reportar de nuevo.':'queda registrado.'}</p><textarea id="cm_reason" class="inp h-24 resize-none" style="font-size:16px" maxlength="200" placeholder="Motivo (mínimo 3 letras)"></textarea><p id="cm_e_gen" role="alert" class="text-red-500 text-xs min-h-[1rem]"></p><button id="cm_ok" type="button" class="btn" data-com="reason-${kind}">${kind==='reject'?'Rechazar':'Perdonar'}</button><button type="button" class="w-full py-3 text-slate-500 font-semibold" onclick="X()">Cancelar</button></div>`)}
{const _adm=V.admin;V.admin=function(a){const h=_adm.call(this,a);if(!LV.adm)return h;
 const mk='grid grid-cols-4 bg-slate-100 rounded-xl p-1 text-[11px] font-semibold mb-4">',i=h.indexOf(mk);if(i<0)return h;const j=h.indexOf('</div>',i),n=COM.adm.summary&&COM.adm.summary.reportedCount;
 const head=h.slice(0,i)+mk.replace('grid-cols-4','grid-cols-5')+h.slice(i+mk.length,j)+`<button type="button" data-com="tab" class="py-2 rounded-lg ${AT==='com'?'bg-white shadow text-brand':'text-slate-500'}">Comisiones${n?' ('+n+')':''}</button></div>`;
 return AT==='com'?head+comAdmH()+'</div>':head+h.slice(j+6)}}

/* ---------- ganchos: un solo escuchador de clics + envolturas de funciones existentes ---------- */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-com]');if(!b)return;const k=b.dataset.com,id=b.dataset.id||'';
 if(k==='banner')comModal();else if(k==='copy')comCopy();else if(k==='go')comReport();
 else if(k==='tab'){AT='com';comAdmLoad()}else if(k==='refresh')comAdmLoad();else if(k==='fil'){COM.adm.filter=id;comAdmLoad()}
 else if(k==='approve'){askConfirm({title:'¿Aprobar este pago?',msg:'Confirma que ya viste el Yape en tu app. El vendedor volverá a poder escribir.',ok:'Sí, aprobar',no:'Volver',icon:'check-circle-2'}).then(ok=>{if(ok)comAdmAct('approve',id)})}
 else if(k==='reject'||k==='waive')comReasonM(k,id);
 else if(k==='reason-reject'||k==='reason-waive'){const t=((document.querySelector('#cm_reason')||{}).value||'').trim();if(t.length<3){const e2=document.querySelector('#cm_e_gen');if(e2)e2.textContent='Escribe el motivo (mínimo 3 letras).';return}
  b.disabled=true;comAdmAct(k.slice(7),COM.cur,t).then(ok=>{if(ok)X();else b.disabled=false})}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&(e.target.id==='cm_op'||e.target.id==='cm_nm'))comReport()});
function confirmOrder(id){const i=document.querySelector(`.pin-in[data-o="${id}"]`),pin=((i&&i.value)||'').replace(/[^0-9]/g,''); /* misma función de 07-pedidos.js + abre el modal de cobro */
 if(pin.length!=6)return toast('Ingresa los 6 dígitos del código');
 if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 sock.emit('order:confirm',{id,pin},r=>{if(r&&r.error){toast(r.error);if(i)i.value='';return}if(r&&r.commission)comAfterSale()})}
{const f=window.lsend;if(typeof f==='function')window.lsend=function(k){if(comRestricted()&&!comToOff(k)){toast(COM_MSG);comModal();return}return f.apply(this,arguments)}}
{const f=window.authOk;if(typeof f==='function')window.authOk=function(){const r=f.apply(this,arguments);COM.cm=null;COM.cfg=null;comBind();comLoad();return r}}
{const f=window.sessionOut;if(typeof f==='function')window.sessionOut=function(){COM.cm=null;COM.cfg=null;COM.adm={items:[],summary:null,filter:'',loading:false};return f.apply(this,arguments)}}
{const f=window.R;if(typeof f==='function')window.R=function(keep){f.call(this,keep);comUI()}}
comBind();
