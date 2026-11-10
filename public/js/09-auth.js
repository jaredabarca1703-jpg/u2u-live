/* ===== v8.3.0 → v8.6.8: cuentas (login, sesión guardada y arranque).
   El registro con código, la recuperación, «Mi cuenta» y los Términos viven en 12-cuenta.js (bloque 8). ===== */
const TK='u2utk';
let ACC=null; /* MI cuenta tal como la entrega el servidor (uid, nombre, correo, perfil UPC, verified, pending). Nunca datos de otros usuarios. */
let LG={id:''}; /* lo que se escribió en «Correo o usuario»: se conserva al ir a recuperar contraseña y volver */
const tkGet=()=>{try{return localStorage.getItem(TK)}catch(e){return null}};
async function api(p,body,tok,m){try{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:Object.assign({'Content-Type':'application/json'},tok?{Authorization:'Bearer '+tok}:{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{ok:r.ok,status:r.status,j}}catch(e){return{ok:false,status:0,j:{}}}}
function authForm(m){if(m=='register')return regForm();
 const lb='text-xs font-semibold text-slate-600',au='autocapitalize="none" autocorrect="off" spellcheck="false"';
 return `<div class="px-7 pt-10 pb-8"><img src="${IM.logo}" alt="U2U · Compra, vende y alquila entre estudiantes" class="w-48 mx-auto">
 <h1 class="text-[24px] font-extrabold text-navy text-center mt-5">¡Bienvenido de vuelta!</h1>
 <p class="text-slate-500 text-sm text-center mt-1 mb-5">Inicia sesión con tu correo UPC.</p>
 <form onsubmit="event.preventDefault();authGo()" novalidate>
 <label class="${lb}" for="a_id">Correo UPC o usuario</label><input id="a_id" class="inp" maxlength="254" autocomplete="username" ${au} placeholder="usuario@upc.edu.pe" value="${esc(LG.id)}" oninput="LG.id=this.value">
 <label class="${lb}" for="a_pw">Contraseña</label><div class="relative"><input id="a_pw" type="password" class="inp" style="padding-right:2.75rem" maxlength="128" autocomplete="current-password" placeholder="Tu contraseña"><button type="button" aria-label="Mostrar u ocultar contraseña" class="absolute right-3 text-slate-400" style="top:1.05rem" onclick="const i=$('#a_pw');i.type=i.type=='password'?'text':'password'"><i data-lucide="eye" class="w-5 h-5"></i></button></div>
 <p id="a_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center"></p>
 <button id="a_btn" type="submit" class="btn mt-1">Iniciar sesión</button></form>
 <p class="text-center mt-3"><button class="text-sm font-semibold text-brand" onclick="rcOpen()">¿Olvidaste tu contraseña?</button></p>
 <p class="text-center text-sm text-slate-500 mt-4">¿No tienes cuenta? <button class="font-bold text-brand" onclick="root('register')">Regístrate</button></p>
 <p id="pres" class="text-center text-xs text-slate-400 mt-4"></p></div>`}
async function authGo(){const er=$('#a_er'),btn=$('#a_btn'),v=id=>($('#'+id)||{}).value||'';er.textContent='';
 const id=v('a_id').trim(),password=v('a_pw');LG.id=id;
 if(!id||!password)return er.textContent='Completa tu correo y contraseña.';
 btn.disabled=true;btn.textContent='Entrando…';
 const r=await api('login',{id,password});
 if(r.ok&&r.j.token)return authOk(r.j);
 btn.disabled=false;btn.textContent='Iniciar sesión';
 er.textContent=r.status==0?'No hay conexión con el servidor. Reintenta en unos segundos.':(r.j.error||'No se pudo completar. Intenta de nuevo.')}
/* dest: pantalla de destino. Por defecto: app si la cuenta está verificada, pantalla de código si no. Al abrir con sesión guardada se pasa 'home'. */
function authOk(j,dest){const u=j.user;ACC=u;LV.adm=!!u.admin;try{localStorage.setItem(TK,j.token)}catch(e){}LV.idc={uid:u.uid,secret:u.secret};try{localStorage.setItem('u2uid',JSON.stringify(LV.idc))}catch(e){}LV.pref={name:u.name};netUI(0);liveJoin(u.name);meSet(u);root(dest||(u.verified?'home':'verify'))}
/* sesión guardada: al abrir la app se valida el token y se entra directo */
async function boot(n){n=n||0;let tk=tkGet();
 if(!tk){S.s='login';return R()}
 S.s='boot';R();const r=await api('me',null,tk);
 if(r.ok&&r.j.user)return authOk({token:tk,user:r.j.user},'home');
 if(r.status==401||r.status==403){try{localStorage.removeItem(TK)}catch(e){}S.s='login';R();if(r.j&&r.j.blocked)toast(r.j.error);return}
 if(n<25){netUI(1);setTimeout(()=>{if(S.s=='boot')boot(n+1)},Math.min(1000+n*500,5000))}else{S.s='login';R()}}
function bootInit(){let tk=tkGet();if(window.io&&tk)boot();else R()}
async function logout(){if(!await askConfirm({title:'¿Cerrar sesión?',msg:'Tendrás que volver a ingresar tu correo y contraseña.',ok:'Cerrar sesión',no:'Volver',icon:'log-out'}))return;sessionOut()}
function sessionOut(msg){let tk=tkGet();if(tk&&window.io)api('logout',{},tk);try{localStorage.removeItem(TK);localStorage.removeItem('u2uid')}catch(e){}
 if(sock&&sock.connected)sock.emit('leave');LV.me=null;LV.idc=null;LV.convs={};LV.orders={};LV.adm=false;LV.rpt=null;LV.rep=new Set();LV.rt={};LV.rv={};LV.rl={};LV.ld={p:0,h:0,o:0};ACC=null;REG=REG0();RC=RC0();SEL[ME].prof=null;S.s='login';S.st=[];X();R();if(msg)toast(msg)}
