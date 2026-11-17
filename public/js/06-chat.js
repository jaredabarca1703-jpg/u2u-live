/* ---------- Chat privado por producto ---------- */
const DEL_CONVS=(()=>{try{return JSON.parse(localStorage.getItem('u2u_del_convs')||'{}')}catch(e){return {}}})();
const DEL_MSGS=(()=>{try{return JSON.parse(localStorage.getItem('u2u_del_msgs')||'{}')}catch(e){return {}}})();
function saveDelConvs(){try{localStorage.setItem('u2u_del_convs',JSON.stringify(DEL_CONVS))}catch(e){}}
function saveDelMsgs(){try{localStorage.setItem('u2u_del_msgs',JSON.stringify(DEL_MSGS))}catch(e){}}

function delConvAsk(k){
 M(`<div class="bg-white w-full rounded-t-3xl p-6 pop text-center">
  <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 grid place-items-center mx-auto mb-3"><i data-lucide="trash-2" class="w-6 h-6"></i></div>
  <p class="font-extrabold text-lg text-navy">¿Eliminar conversación?</p>
  <p class="text-xs text-slate-500 mt-1 mb-5">Esta conversación desaparecerá de tu bandeja. El otro estudiante conservará su historial.</p>
  <button class="btn !bg-red-500" onclick="delConv('${k}')">Sí, eliminar de mi bandeja</button>
  <button class="w-full py-3 text-slate-500 font-semibold text-sm mt-1" onclick="X()">Cancelar</button>
 </div>`);
}

function delConv(k){
 X();
 DEL_CONVS[k]=Date.now();
 saveDelConvs();
 if(window.io&&LV.me&&LV.convs){delete LV.convs[k]}
 if(ST.chats&&ST.chats[k]){delete ST.chats[k];save()}
 toast('Conversación eliminada de tu bandeja');
 if(S.s=='lchat'&&S.a==k)back();
 else if(S.s=='chat'&&S.a==k)back();
 else if(S.s=='msgs')R(1);
 if(typeof navDot==='function')navDot();
}

function delMsgForMeAsk(k,mid){
 M(`<div class="bg-white w-full rounded-t-3xl p-6 pop text-center">
  <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 grid place-items-center mx-auto mb-3"><i data-lucide="trash-2" class="w-6 h-6"></i></div>
  <p class="font-extrabold text-lg text-navy">¿Eliminar mensaje?</p>
  <p class="text-xs text-slate-500 mt-1 mb-5">Solo se eliminará de tu vista en este chat. El otro estudiante seguirá viéndolo.</p>
  <button class="btn !bg-red-500" onclick="delMsgForMe('${k}','${mid}')">Eliminar para mí</button>
  <button class="w-full py-3 text-slate-500 font-semibold text-sm mt-1" onclick="X()">Cancelar</button>
 </div>`);
}

function delMsgForMe(k,mid){
 X();
 DEL_MSGS[mid]=true;
 saveDelMsgs();
 const c=LV.convs[k];
 if(c&&c.msgs){
  c.msgs=c.msgs.filter(m=>m.id!=mid);
 }
 toast('Mensaje eliminado para ti');
 lchatR(k);
}

function onMsg(d){if(!LV.me)return;const k=d.conv.key;
 if(DEL_CONVS[k]){delete DEL_CONVS[k];saveDelConvs()}
 if(DEL_MSGS[d.msg.id])return;
 const c=LV.convs[k]||(LV.convs[k]={key:k,pid:d.conv.pid,buyerId:d.conv.buyerId,buyerName:d.conv.buyerName,msgs:[],un:0});
 if(c.msgs.some(m=>m.id==d.msg.id))return;c.msgs.push(d.msg);c.buyerName=d.conv.buyerName;
 const mine=d.msg.uid==LV.me.uid;
 if(S.s=='lchat'&&S.a==k)lchatR(k);
 else{if(!mine){c.un=(c.un||0)+1;toast('💬 '+d.msg.name+': '+d.msg.text.slice(0,40));try{navigator.vibrate&&navigator.vibrate(80)}catch(e){}}if(S.s=='msgs')R(1)}
 navDot()}
function openChat(pid){
 if(!window.io||!LV.me)return toast('Inicia sesión para chatear');
 const pp=P(pid);if(pp&&(pp.own==LV.me.uid||pp.s==ME))return toast('Esta es tu publicación: las consultas llegan a Mensajes');
 if(pp&&!pp.own)return toast('Producto de ejemplo: el chat funciona con publicaciones de otros estudiantes (botón +)');
 nav('lchat',pid+'|'+LV.me.uid)}
function offerSend(id,v){const t='Hola, te ofrezco S/ '+v+' por '+P(id).t;
 if(!window.io||!LV.me)return toast('Inicia sesión para chatear');
 const pp=P(id);if(pp&&(pp.own==LV.me.uid||pp.s==ME))return toast('Esta es tu publicación');
 if(pp&&!pp.own)return toast('Producto de ejemplo: las ofertas funcionan con publicaciones de otros estudiantes');
 const k=id+'|'+LV.me.uid;nav('lchat',k);lsend(k,t)}
function lsend(k,t){const i=$('#ci');t=(t||(i&&i.value)||'').trim();if(!t)return;
 if(!sock||!sock.connected)return toast('Sin conexión con el servidor, reintentando…');
 const[pid,bid]=k.split('|');
 LV.cid=LV.cid||{};const ck=k+'|'+t,cid=LV.cid[ck]||(LV.cid[ck]=Date.now().toString(36)+Math.random().toString(36).slice(2,8)); /* mismo cid en reintentos: el servidor no duplica */
 sock.emit('send',{pid:+pid,buyerId:bid,text:t,cid},r=>{if(r&&r.error)toast(r.error);else delete LV.cid[ck]});
 if(i){i.value='';i.focus()}}
V.lchat=key=>{const[pid,bid]=key.split('|'),p=(pid==0&&LV.off?offP():P(pid))||{id:0,t:'Producto no disponible en este dispositivo',ph:[],e:'📦',mode:'venta',price:0,s:0},c=LV.convs[key],own=bid!=LV.me.uid,
 title=own?esc(c?c.buyerName:'Interesado'):(p.id?esc(SEL[p.s].n):(c&&c.buyerId===LV.me.uid?'Vendedor':'Interesado'));
 LV.chips=own?['¡Hola! Sí, sigue disponible 😊','Nos vemos en el punto seguro del campus','¿Cuánto ofreces?','¡Trato hecho! 🎉']:(p.id?aiChips(p):(pid==0?['¿Cómo publico mi primer producto?','Tengo una duda sobre un pedido','¿Cómo funciona el código de entrega?']:['¿Sigue disponible?']));
 return `<div class="h-full flex flex-col">${hd(title,`<div class="flex items-center gap-2"><span id="lst" class="text-xs font-semibold"></span><button onclick="delConvAsk('${key}')" class="p-1.5 text-slate-400 hover:text-red-500 rounded-full transition" title="Borrar conversación"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`)}
 <div ${p.id?`onclick="openP(${p.id})"`:''} class="flex gap-3 items-center p-3 bg-slate-50 border-b cursor-pointer"><div class="w-12 h-12 rounded-lg overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${esc(p.t)}</p>${p.id?`<p class="text-xs text-brand font-bold">${price(p)}</p>`:''}</div></div>
 <div id="ml" class="flex-1 overflow-y-auto no-sb p-4 space-y-2 bg-slate-50"></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-3 pt-2 items-center"><span class="text-[10px] font-bold text-purple-600 shrink-0">${own?'⚡ Respuestas rápidas':'✨ IA sugiere'}</span>${LV.chips.map((q,i)=>`<button class="chip" onclick="lsend('${key}',LV.chips[${i}])">${esc(q)}</button>`).join('')}</div>
 <div class="flex gap-2 p-3"><input id="ci" onkeydown="event.key=='Enter'&&lsend('${key}')" autocomplete="off" placeholder="Escribe un mensaje..." class="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none"><button onclick="lsend('${key}')" aria-label="Enviar" class="bg-brand text-white rounded-full p-3"><i data-lucide="send" class="w-5"></i></button></div></div>`};
/* historial por demanda: el servidor manda los últimos 50; el resto se pide de a 50 */
function moreHist(k){const c=LV.convs[k];if(!c||!sock||!sock.connected||!c.msgs.length)return toast('Sin conexión con el servidor');
 sock.emit('history:more',{key:k,before:c.msgs[0].ts},r=>{if(!r||!r.ok)return toast((r&&r.error)||'No se pudo cargar');const have=new Set(c.msgs.map(m=>m.id));c.msgs=r.msgs.filter(m=>!have.has(m.id)&&!DEL_MSGS[m.id]).concat(c.msgs);c.more=!!r.more;lchatR(k)})}
function lchatR(k){const m=$('#ml');if(!m)return;const c=LV.convs[k];if(c){c.un=0;seenSet(k)}
 const lm=c&&c.msgs[c.msgs.length-1],stick=!m.firstElementChild||m.scrollHeight-m.scrollTop-m.clientHeight<80||!!(lm&&LV.me&&lm.uid==LV.me.uid); /* si estás leyendo mensajes viejos, un mensaje nuevo no te baja */
 const sy=m.scrollTop;
 m.innerHTML=(c&&c.more?`<button class="chip mx-auto block" onclick="moreHist('${k}')">Cargar mensajes anteriores</button>`:'')+(c&&c.msgs.length?c.msgs.map(x=>{
  const me=x.uid==LV.me.uid,del=`<button onclick="delMsgForMeAsk('${k}','${x.id}')" aria-label="Eliminar mensaje para mí" class="p-1 text-slate-300 hover:text-red-400 mb-0.5 transition" title="Eliminar para mí"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`;
  return `<div class="flex items-end gap-1 ${me?'justify-end':''}">
   ${me?del:''}
   <div class="max-w-[78%]">${me?'':`<p class="text-[10px] text-slate-400 ml-1">${esc(x.name)}</p>`}
    <div class="px-3 py-2 rounded-2xl text-sm break-words ${me?'bg-brand text-white rounded-br-sm':'bg-white border rounded-bl-sm'}">
     ${esc(x.text)}
     <p class="text-[9px] opacity-60 text-right mt-0.5">${tm(x.ts)}</p>
    </div>
   </div>
   ${me?'':del}
  </div>`;
 }).join(''):'<p class="text-center text-xs text-slate-400 mt-10">Escribe o usa una respuesta rápida para empezar.</p>');
 m.scrollTop=stick?m.scrollHeight:sy;lucide.createIcons();navDot()}
