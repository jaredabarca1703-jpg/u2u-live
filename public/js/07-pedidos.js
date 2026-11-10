/* ---------- Pedidos con código de entrega ---------- */
const fpin=p=>p.slice(0,3)+' '+p.slice(3);
const STB={pending:['Pendiente de entrega','bg-amber-100 text-amber-700'],completed:['Entrega confirmada','bg-emerald-100 text-emerald-700'],cancelled:['Cancelado','bg-slate-100 text-slate-500']};
function coOk(id,mode){if(LV.adm){toast('La cuenta oficial vende y modera: no compra ni alquila');return false}if(!window.io||!LV.me)return true;const p=P(id);
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
 const chats=l.map(c=>{const p=c.pid==0?offP():P(c.pid),m=c.msgs[c.msgs.length-1],mine=m.uid==LV.me.uid;if(!p)return '';
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

