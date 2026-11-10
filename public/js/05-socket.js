/* ===================== V8: TIEMPO REAL (Socket.io) ===================== */
/* Si /socket.io/socket.io.js no carga (archivo abierto sin servidor), la app sigue en modo local simulado. */
const LV={off:null,ld:{p:0,h:0,o:0},me:null,pref:null,idc:null,convs:{},orders:{},pres:{total:0,uids:[]},chips:[],rep:new Set(),rt:{},rv:{},rl:{},adm:false,rpt:null};
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
 sock.on('history',l=>{LV.ld.h=0;const old=LV.convs;LV.convs={};l.forEach(c=>{c.un=old[c.key]?old[c.key].un:unSeen(c);LV.convs[c.key]=c});if(S.s=='msgs')R(1);if(S.s=='lchat')lchatR(S.a);navDot()});
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
 sock.on('official',d=>{LV.off=d||null;if(S.s=='home'||S.s=='profile')R(1)});
 sock.on('products',l=>{LV.ld.p=0;onProducts(l);if(S.s=='home')gridR()});
 sock.on('new-product',onNewProduct);
 sock.on('product-status',d=>{const p=P(d.id);if(!p)return;p.status=d.status;refreshCatalog();if(S.s=='detail'&&S.a==d.id)R(1)})}

