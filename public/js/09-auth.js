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

