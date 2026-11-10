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
V.lchat=key=>{const[pid,bid]=key.split('|'),p=(pid==0&&LV.off?offP():P(pid))||{id:0,t:'Producto no disponible en este dispositivo',ph:[],e:'📦',mode:'venta',price:0,s:0},c=LV.convs[key],own=bid!=LV.me.uid,
 title=own?esc(c?c.buyerName:'Interesado'):esc(SEL[p.s].n);
 LV.chips=own?['¡Hola! Sí, sigue disponible 😊','Nos vemos en el punto seguro del campus','¿Cuánto ofreces?','¡Trato hecho! 🎉']:(p.id?aiChips(p):(pid==0?['¿Cómo publico mi primer producto?','Tengo una duda sobre un pedido','¿Cómo funciona el código de entrega?']:['¿Sigue disponible?']));
 return `<div class="h-full flex flex-col">${hd(title,'<span id="lst" class="text-xs font-semibold"></span>')}
 <div ${p.id?`onclick="openP(${p.id})"`:''} class="flex gap-3 items-center p-3 bg-slate-50 border-b cursor-pointer"><div class="w-12 h-12 rounded-lg overflow-hidden">${pic(p)}</div><div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${esc(p.t)}</p>${p.id?`<p class="text-xs text-brand font-bold">${price(p)}</p>`:''}</div></div>
 <div id="ml" class="flex-1 overflow-y-auto no-sb p-4 space-y-2 bg-slate-50"></div>
 <div class="flex gap-2 overflow-x-auto no-sb px-3 pt-2 items-center"><span class="text-[10px] font-bold text-purple-600 shrink-0">${own?'⚡ Respuestas rápidas':'✨ IA sugiere'}</span>${LV.chips.map((q,i)=>`<button class="chip" onclick="lsend('${key}',LV.chips[${i}])">${esc(q)}</button>`).join('')}</div>
 <div class="flex gap-2 p-3"><input id="ci" onkeydown="event.key=='Enter'&&lsend('${key}')" autocomplete="off" placeholder="Escribe un mensaje..." class="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none"><button onclick="lsend('${key}')" aria-label="Enviar" class="bg-brand text-white rounded-full p-3"><i data-lucide="send" class="w-5"></i></button></div></div>`};
function lchatR(k){const m=$('#ml');if(!m)return;const c=LV.convs[k];if(c){c.un=0;seenSet(k)}
 const lm=c&&c.msgs[c.msgs.length-1],stick=!m.firstElementChild||m.scrollHeight-m.scrollTop-m.clientHeight<80||!!(lm&&LV.me&&lm.uid==LV.me.uid); /* si estás leyendo mensajes viejos, un mensaje nuevo no te baja */
 const sy=m.scrollTop;
 m.innerHTML=c&&c.msgs.length?c.msgs.map(x=>{const me=x.uid==LV.me.uid;return `<div class="flex ${me?'justify-end':''}"><div class="max-w-[78%]">${me?'':`<p class="text-[10px] text-slate-400 ml-1">${esc(x.name)}</p>`}<div class="px-3 py-2 rounded-2xl text-sm break-words ${me?'bg-brand text-white rounded-br-sm':'bg-white border rounded-bl-sm'}">${esc(x.text)}<p class="text-[9px] opacity-60 text-right">${tm(x.ts)}</p></div></div></div>`}).join(''):'<p class="text-center text-xs text-slate-400 mt-10">Escribe o usa una respuesta rápida para empezar.</p>';
 m.scrollTop=stick?m.scrollHeight:sy;navDot()}

