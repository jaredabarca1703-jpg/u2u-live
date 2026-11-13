/* U2U · cuenta UPC (v8.6.8, bloque 8)
 * Registro en 2 pasos (datos → código de 6 dígitos con reenvío), recuperación de contraseña, «Mi cuenta», Términos y Privacidad,
 * y bloqueo de publicar / reservar / chatear mientras la cuenta no esté verificada. TODO lo decide el servidor (bloques 5-7):
 * aquí solo se muestra y se valida primero en el cliente para no gastar intentos. Script clásico, sin módulos; carga después de 10 y 11. */

/* ---------- listas (iguales a las del servidor: auth.js) ---------- */
const CAREERS=['Ing. Civil','Arquitectura','Sistemas','Negocios','Comunicaciones','Diseño de Moda','Salud','Otra'];
const CAREER_LB={Sistemas:'Ing. de Sistemas',Otra:'Otra carrera'};
const SEDES=['Monterrico','San Isidro','Villa','San Miguel']; /* mismo orden que CAMP (sin «UPC ») */
const careerLb=c=>CAREER_LB[c]||c,cycleLb=c=>c=='Egresado'?'Egresado':'Ciclo '+c,campusIdx=c=>SEDES.indexOf(c);
const CAR_O=CAREERS.map(c=>[c,careerLb(c)]),SED_O=SEDES.map(s=>[s,'UPC '+s]),CYC_O=[1,2,3,4,5,6,7,8,9,10].map(n=>[String(n),'Ciclo '+n]);
const FLB='text-xs font-semibold text-slate-600',FAU='autocapitalize="none" autocorrect="off" spellcheck="false"';
const optsH=(l,cur,ph)=>(ph?`<option value="">${ph}</option>`:'')+l.map(o=>`<option value="${esc(o[0])}" ${cur==o[0]?'selected':''}>${esc(o[1])}</option>`).join('');
const pwField=(id,ac,ph,oi,val)=>`<div class="relative"><input id="${id}" type="password" class="inp" style="padding-right:2.75rem" maxlength="128" autocomplete="${ac}" placeholder="${ph}" value="${esc(val||'')}" ${oi?`oninput="${oi}"`:''}><button type="button" aria-label="Mostrar u ocultar contraseña" class="absolute right-3 text-slate-400" style="top:1.05rem" onclick="const i=$('#${id}');i.type=i.type=='password'?'text':'password'"><i data-lucide="eye" class="w-5 h-5"></i></button></div>`;
/* Correo UPC: minúsculas, sin espacios, un solo @ y dominio EXACTO upc.edu.pe (misma regla que el servidor; el servidor decide siempre) */
const UPC_RE=/^[a-z0-9][a-z0-9._-]{0,63}@upc\.edu\.pe$/;
const upcMail=s=>{s=String(s==null?'':s).trim().toLowerCase();return s.length<=254&&UPC_RE.test(s)&&!s.split('@')[0].includes('..')?s:null};
/* Mensajes claros por código de error del servidor */
function humanErr(r){const j=(r&&r.j)||{},c=j.code,m=j.error||'No se pudo completar. Intenta de nuevo.';
 if(r&&r.status==0)return 'No hay conexión con el servidor. Reintenta en unos segundos.';
 if(c=='CODE_EXPIRED')return 'Tu código venció (dura 10 minutos). Toca «Reenviar código» para recibir uno nuevo.';
 if(c=='RATE_LIMIT'&&j.field=='code')return 'Agotaste los 5 intentos de este código. Toca «Reenviar código» para recibir uno nuevo.';
 if(c=='RATE_LIMIT'&&/Hoy se alcanz/.test(m))return 'Hoy se alcanzó el límite de códigos enviados. Vuelve mañana.';
 return m}

/* ---------- perfil UPC: línea «Ing. de Sistemas · Ciclo 5 · UPC Monterrico» (nunca correo ni usuario) ---------- */
function profLine(s){const p=s&&s.prof;if(!p||!(p.career||p.cycle||p.campus))return 'Estudiante UPC';
 return esc([p.career&&careerLb(p.career),p.cycle&&cycleLb(p.cycle),p.campus&&'UPC '+p.campus].filter(Boolean).join(' · '))}
const verTag=s=>s&&s.prof&&s.prof.verified?'<p class="text-[11px] font-semibold text-emerald-600">Correo UPC verificado ✓</p>':'';
const verBox=s=>s&&s.prof&&s.prof.verified?'<div class="bg-emerald-50 text-emerald-800 text-xs rounded-xl p-3 mt-3 flex gap-2"><i data-lucide="shield-check" class="w-5"></i>Correo UPC verificado ✓</div>':'';
/* Mis datos del servidor → SEL[ME] (lo que usan las tarjetas) y banderas de LV.me. Va DESPUÉS de liveJoin (que crea LV.me). La sede elegida queda como sede por defecto al publicar. */
function meSet(u){const m=SEL[ME];
 m.prof=u.condition?{career:u.career,cycle:u.cycle,campus:u.campus,verified:!!u.verified&&/@upc\.edu\.pe$/.test(u.email||'')}:null;
 m.car=u.career?careerLb(u.career):'Estudiante UPC';m.ci=u.cycle||'—';
 const k=campusIdx(u.campus);if(k>=0)m.cp=k;
 if(LV.me){LV.me.verified=!!u.verified;LV.me.pending=!!u.pending}}
/* Cuadro de estado en «Mi cuenta» */
function acctBox(){const u=ACC,b='mt-4 text-xs rounded-xl p-3 flex gap-2 ';
 if(LV.adm)return `<div class="${b}bg-emerald-50 text-emerald-800"><i data-lucide="shield-check" class="w-5"></i><span><b>Oficial ✓</b> · cuenta oficial de U2U: vendes, atiendes pedidos y moderas</span></div>`;
 if(!u)return '';
 if(!u.verified)return `<div class="${b}bg-amber-50 text-amber-900"><i data-lucide="mail" class="w-5 shrink-0"></i><span>${u.pending?'<b>Cuenta pendiente de aprobación.</b> El equipo U2U la revisará. Mientras tanto no puedes publicar, reservar ni chatear.':'<b>Cuenta sin verificar.</b> Si no verificas en 72 h, se elimina. <button class="font-bold text-brand underline" onclick="nav(\'verify\')">Ingresar código</button>'}</span></div>`;
 if(u.condition&&/@upc\.edu\.pe$/.test(u.email||''))return `<div class="${b}bg-emerald-50 text-emerald-800"><i data-lucide="shield-check" class="w-5"></i>Correo UPC verificado ✓</div>`;
 return ''}

/* ---------- Registro, paso 1: datos ---------- */
const REG0=()=>({name:'',email:'',pw:'',cond:'estudiante',career:'',cycle:'',campus:'',t1:false,t2:false,busy:false});
let REG=REG0();
function regCond(c){REG.cond=c;REG.cycle=c=='egresado'?'Egresado':(REG.cycle=='Egresado'?'':REG.cycle);R(1)}
function regForm(){const r=REG,egr=r.cond=='egresado';
 return `<div class="px-7 pt-8 pb-8"><img src="${IM.logo}" alt="U2U · Compra, vende y alquila entre estudiantes" class="w-40 mx-auto">
 <p class="text-center text-[11px] font-semibold text-brand mt-4">Paso 1 de 2 · Tus datos</p>
 <h1 class="text-[24px] font-extrabold text-navy text-center mt-1">Crea tu cuenta</h1>
 <p class="text-slate-500 text-sm text-center mt-1 mb-5">Para estudiantes y egresados UPC. Te enviaremos un código de 6 dígitos a tu correo.</p>
 <form onsubmit="event.preventDefault();regGo()" novalidate>
 <label class="${FLB}" for="a_name">Nombre</label><input id="a_name" class="inp" maxlength="24" autocomplete="name" placeholder="¿Cómo te llamas?" value="${esc(r.name)}" oninput="REG.name=this.value">
 <label class="${FLB}" for="a_mail">Correo UPC</label><input id="a_mail" type="email" class="inp" maxlength="254" autocomplete="email" inputmode="email" ${FAU} placeholder="usuario@upc.edu.pe" value="${esc(r.email)}" oninput="REG.email=this.value">
 <label class="${FLB}" for="a_pw">Contraseña</label>${pwField('a_pw','new-password','Mínimo 8 caracteres','REG.pw=this.value',r.pw)}
 <p class="${FLB}">Soy</p><div class="flex gap-2 mt-1 mb-3">${[['estudiante','Estudiante'],['egresado','Egresado']].map(a=>`<button type="button" class="chip ${r.cond==a[0]?'on':''}" aria-pressed="${r.cond==a[0]}" onclick="regCond('${a[0]}')">${a[1]}</button>`).join('')}</div>
 <label class="${FLB}" for="a_car">Carrera</label><select id="a_car" class="inp" onchange="REG.career=this.value">${optsH(CAR_O,r.career,'Elige tu carrera')}</select>
 ${egr?'<p class="text-xs text-slate-500 mb-3">Ciclo: <b>Egresado</b></p>':`<label class="${FLB}" for="a_cyc">Ciclo</label><select id="a_cyc" class="inp" onchange="REG.cycle=this.value">${optsH(CYC_O,r.cycle,'Elige tu ciclo')}</select>`}
 <label class="${FLB}" for="a_cam">Sede</label><select id="a_cam" class="inp" onchange="REG.campus=this.value">${optsH(SED_O.map(o=>[o[0],o[1]]),r.campus,'Elige tu sede')}</select>
 <label class="flex gap-2 items-start text-xs mt-1"><input id="a_t1" type="checkbox" class="mt-0.5" ${r.t1?'checked':''} onchange="REG.t1=this.checked"><span>Acepto los <button type="button" class="font-bold text-brand underline" onclick="nav('legal')">Términos y Privacidad</button>.</span></label>
 <label class="flex gap-2 items-start text-xs mt-2"><input id="a_t2" type="checkbox" class="mt-0.5" ${r.t2?'checked':''} onchange="REG.t2=this.checked"><span>Entiendo que mi carrera, ciclo y sede serán visibles para otros usuarios.</span></label>
 <p id="a_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center mt-2"></p>
 <button id="a_btn" type="submit" class="btn mt-1">Continuar</button></form>
 <p class="text-center text-sm text-slate-500 mt-5">¿Ya tienes cuenta? <button class="font-bold text-brand" onclick="root('login')">Inicia sesión</button></p>
 <p id="pres" class="text-center text-xs text-slate-400 mt-4"></p></div>`}
async function regGo(){const r=REG,er=$('#a_er'),btn=$('#a_btn');if(r.busy)return;er.textContent='';
 const bad=(m,f)=>{er.textContent=m;const e=f&&$('#'+f);if(e&&e.focus)e.focus()},name=r.name.trim(),email=upcMail(r.email);
 if(name.length<2)return bad('Escribe tu nombre (mínimo 2 letras).','a_name');
 if(!email)return bad('Usa tu correo UPC: usuario@upc.edu.pe (sin espacios).','a_mail');
 if(r.pw.length<8)return bad('La contraseña debe tener al menos 8 caracteres.','a_pw');
 if(!r.career)return bad('Elige tu carrera (o «Otra»).','a_car');
 if(r.cond=='estudiante'&&!CYC_O.some(o=>o[0]==r.cycle))return bad('Elige tu ciclo (1 a 10).','a_cyc');
 if(!SEDES.includes(r.campus))return bad('Elige tu sede.','a_cam');
 if(!r.t1)return bad('Debes aceptar los Términos y Privacidad.','a_t1');
 if(!r.t2)return bad('Confirma que entiendes que tu carrera, ciclo y sede serán visibles.','a_t2');
 r.busy=true;btn.disabled=true;btn.textContent='Creando cuenta…';
 const res=await api('register',{name,email,password:r.pw,cond:r.cond,career:r.career,cycle:r.cond=='egresado'?'Egresado':r.cycle,campus:r.campus,terms:true,visibility:{career:true,cycle:true,campus:true}});
 r.busy=false;
 if(res.ok&&res.j.token){const j=res.j;REG=REG0();VR={left:j.verify?j.verify.resendIn:0,sent:j.sent!==false,err:'',busy:false};return authOk(j)}
 btn.disabled=false;btn.textContent='Continuar';
 bad(humanErr(res),{name:'a_name',email:'a_mail',password:'a_pw',career:'a_car',cycle:'a_cyc',campus:'a_cam'}[res.j.field])}

/* ---------- Registro, paso 2: código de 6 dígitos con reenvío (60 s) ---------- */
let VR={left:0,sent:true,err:'',busy:false};
let CDT=null; /* un solo reloj de 1 s para las cuentas regresivas de «Reenviar código»; se apaga solo al salir de la pantalla */
function cdStart(){if(CDT)return;CDT=setInterval(()=>{const o=S.s=='verify'?VR:S.s=='recover'?RC:null;if(!o){clearInterval(CDT);CDT=null;return}if(o.left>0)o.left--;cdBtn()},1000)}
function cdBtn(){const v=S.s=='verify',o=v?VR:RC,b=$(v?'#vr_rs':'#rc_rs');if(!b)return;b.disabled=o.left>0||!!o.busy;b.textContent=o.left>0?'Reenviar código en '+o.left+' s':'Reenviar código'}
const rsLabel=o=>o.left>0?'Reenviar código en '+o.left+' s':'Reenviar código';
const logoBox=`<img src="${IM.logo}" alt="U2U" class="w-40 mx-auto">`;
V.verify=()=>{const u=ACC;
 if(!u)return `<div class="px-7 pt-14 text-center">${logoBox}<button class="btn mt-8" onclick="root('login')">Iniciar sesión</button></div>`;
 const hdr=S.st.length?hd('Verifica tu correo'):'',later=`<button class="w-full py-3 text-slate-500 font-semibold" onclick="verLater()">${u.pending||u.verified?'Explorar U2U':'Verificar más tarde'}</button><button class="w-full py-2 text-xs text-slate-400" onclick="logout()">Usar otra cuenta</button>`;
 if(u.verified)return hdr+`<div class="px-7 pt-10 pb-8 text-center">${logoBox}<h1 class="text-xl font-extrabold text-navy mt-5">Tu cuenta ya está verificada ✓</h1>${later}</div>`;
 if(u.pending)return hdr+`<div class="px-7 pt-10 pb-8 text-center">${logoBox}<h1 class="text-xl font-extrabold text-navy mt-5">Tu cuenta espera aprobación</h1><p class="text-sm text-slate-500 mt-2">El equipo U2U revisará tu registro. Mientras tanto puedes explorar, pero no podrás publicar, reservar ni chatear.</p>${later}</div>`;
 cdStart();
 return hdr+`<div class="px-7 pt-8 pb-8">${logoBox}<p class="text-center text-[11px] font-semibold text-brand mt-4">Paso 2 de 2 · Verifica tu correo</p>
 <h1 class="text-[22px] font-extrabold text-navy text-center mt-1">Escribe tu código</h1>
 <p class="text-slate-500 text-sm text-center mt-1 mb-4">Enviamos un código de 6 dígitos a <b class="text-slate-700">${esc(u.email||'tu correo UPC')}</b>. Vence en 10 minutos.</p>
 <form onsubmit="event.preventDefault();vrGo()" novalidate>
 <label class="sr-only" for="v_code">Código de 6 dígitos</label><input id="v_code" class="inp text-center text-xl font-bold tracking-[.4em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6)">
 <p id="v_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center">${esc(VR.err||(VR.sent?'':'No pudimos enviar el correo. Toca «Reenviar código» en unos segundos.'))}</p>
 <button id="v_btn" type="submit" class="btn mt-1">Verificar</button></form>
 <button id="vr_rs" class="w-full py-3 font-semibold text-brand disabled:opacity-50" onclick="vrResend()" ${VR.left>0?'disabled':''}>${rsLabel(VR)}</button>
 <p class="text-[11px] text-slate-400 text-center">Si no verificas en 72 h, tu cuenta se elimina.</p>${later}</div>`};
function verLater(){S.st.length?back():root('home')}
async function vrGo(){if(VR.busy)return;const i=$('#v_code'),er=$('#v_er'),b=$('#v_btn'),code=((i&&i.value)||'').replace(/\D/g,'');er.textContent='';
 if(code.length!=6)return er.textContent='Escribe los 6 dígitos del código.';
 VR.busy=true;b.disabled=true;b.textContent='Verificando…';
 const r=await api('verify',{code,email:ACC&&ACC.email},tkGet());VR.busy=false;
 if(r.ok&&r.j.verified&&r.j.user){ACC=r.j.user;liveJoin(ACC.name);meSet(ACC);VR={left:0,sent:true,err:'',busy:false};toast('✅ Correo verificado. ¡Bienvenido a U2U!');return root('home')}
 b.disabled=false;b.textContent='Verificar';VR.err=humanErr(r);er.textContent=VR.err;if(r.j.code=='CODE_INVALID'&&i){i.value='';i.focus()}}
async function vrResend(){if(VR.busy||VR.left>0)return;VR.busy=true;cdBtn();const er=$('#v_er');if(er)er.textContent='';
 const r=await api('resend',{email:ACC&&ACC.email},tkGet());VR.busy=false;
 if(r.ok){VR.left=r.j.resendIn||60;VR.sent=r.j.sent!==false;VR.err=VR.sent?'':'No pudimos enviar el correo. Espera un momento y vuelve a intentarlo.';const i=$('#v_code');if(i)i.value='';if(er)er.textContent=VR.err;toast(VR.sent?'Te enviamos un código nuevo':'No se pudo enviar el correo')}
 else{if(r.j.retry)VR.left=r.j.retry;VR.err=humanErr(r);if(er)er.textContent=VR.err}
 cdBtn()}

/* ---------- Recuperar contraseña (desde el login o desde Mi cuenta) ---------- */
const RC0=()=>({step:1,email:'',busy:false,left:0});
let RC=RC0();
function rcOpen(mine){RC=RC0();if(mine&&ACC&&ACC.email)RC.email=ACC.email;else if(/@/.test(LG.id))RC.email=LG.id.trim();nav('recover')}
V.recover=()=>{const r=RC;
 if(r.step==1)return hd('Recuperar contraseña')+`<div class="px-7 pt-6 pb-8"><p class="text-sm text-slate-600 mb-4">Escribe tu correo UPC y te enviaremos un código de 6 dígitos.</p>
 <form onsubmit="event.preventDefault();rcGo()" novalidate><label class="${FLB}" for="r_mail">Correo UPC</label><input id="r_mail" type="email" class="inp" maxlength="254" autocomplete="email" inputmode="email" ${FAU} placeholder="usuario@upc.edu.pe" value="${esc(r.email)}" oninput="RC.email=this.value">
 <p id="r_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center"></p><button id="r_btn" type="submit" class="btn">Enviar código</button></form></div>`;
 cdStart();
 return hd('Recuperar contraseña')+`<div class="px-7 pt-6 pb-8"><p class="text-sm text-slate-600 mb-4">Si <b>${esc(r.email)}</b> está registrado, enviamos un código de 6 dígitos (vence en 10 minutos). Escríbelo y elige tu contraseña nueva.</p>
 <form onsubmit="event.preventDefault();rcReset()" novalidate><label class="${FLB}" for="r_code">Código</label><input id="r_code" class="inp text-center text-xl font-bold tracking-[.4em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6)">
 <label class="${FLB}" for="r_pw">Contraseña nueva</label>${pwField('r_pw','new-password','Mínimo 8 caracteres')}
 <p id="r_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center"></p><button id="r_btn" type="submit" class="btn">Cambiar contraseña</button></form>
 <button id="rc_rs" class="w-full py-3 font-semibold text-brand disabled:opacity-50" onclick="rcResend()" ${r.left>0?'disabled':''}>${rsLabel(r)}</button></div>`};
async function rcGo(){if(RC.busy)return;const er=$('#r_er'),b=$('#r_btn'),m=upcMail(RC.email);er.textContent='';
 if(!m)return er.textContent='Usa tu correo UPC: usuario@upc.edu.pe.';
 RC.busy=true;b.disabled=true;b.textContent='Enviando…';const r=await api('recover',{email:m});RC.busy=false;
 if(r.ok){RC.email=m;RC.step=2;RC.left=r.j.resendIn||60;return R(1)}
 b.disabled=false;b.textContent='Enviar código';er.textContent=humanErr(r)}
async function rcReset(){if(RC.busy)return;const er=$('#r_er'),b=$('#r_btn'),code=(($('#r_code')||{}).value||'').replace(/\D/g,''),pw=($('#r_pw')||{}).value||'';er.textContent='';
 if(code.length!=6)return er.textContent='Escribe los 6 dígitos del código.';
 if(pw.length<8)return er.textContent='La contraseña nueva debe tener al menos 8 caracteres.';
 RC.busy=true;b.disabled=true;b.textContent='Guardando…';const em=RC.email,r=await api('recover/reset',{email:em,code,password:pw});RC.busy=false;
 if(r.ok&&r.j.ok){const mine=!!LV.me;RC=RC0();LG.id=em;if(mine)return sessionOut('Contraseña cambiada. Inicia sesión con la nueva.');S.st=[];S.s='login';R();return toast('Contraseña cambiada. Ya puedes iniciar sesión.')}
 b.disabled=false;b.textContent='Cambiar contraseña';er.textContent=humanErr(r)}
async function rcResend(){if(RC.busy||RC.left>0)return;RC.busy=true;cdBtn();const er=$('#r_er');if(er)er.textContent='';
 const r=await api('recover',{email:RC.email});RC.busy=false;
 if(r.ok){RC.left=r.j.resendIn||60;toast('Si el correo está registrado, enviamos un código nuevo')}else if(er)er.textContent=humanErr(r);
 cdBtn()}

/* ---------- Términos y Privacidad (borrador v1.0; el bloque 29 los completa con los datos operativos) ---------- */
const LEGAL=[
['Borrador por revisar','Este texto es un borrador (versión 1.0) pendiente de revisión por un abogado, en el marco de la Ley N.º 29733 de Protección de Datos Personales. Puede cambiar; si cambia de forma importante te pediremos aceptarlo de nuevo.'],
['1. Qué es U2U','U2U es un marketplace independiente para que estudiantes y egresados de UPC compren, vendan y alquilen materiales académicos entre sí. U2U no es un servicio de la Universidad Peruana de Ciencias Aplicadas ni está afiliado o respaldado por ella.'],
['2. Datos que guardamos','Guardamos tu nombre, tu correo UPC, si eres estudiante o egresado, tu carrera, ciclo y sede, tu contraseña (protegida con hash: nadie puede leerla), la fecha en que aceptaste estos términos y lo que haces en la app: publicaciones, fotos, mensajes, pedidos, reseñas y reportes. Los códigos de verificación se guardan solo como huella y vencen a los 10 minutos. Usamos estos datos únicamente para que U2U funcione y para moderar la comunidad.'],
['3. Qué ven los demás','Los demás usuarios ven tu nombre y, porque lo aceptas al registrarte, tu carrera, ciclo y sede. Tu correo y tus datos de acceso nunca se muestran a otros usuarios.'],
['4. Verificación de la cuenta','Debes verificar tu correo UPC con el código que te enviamos. Hasta verificarlo no puedes publicar, reservar ni chatear. Si no verificas en 72 horas, la cuenta se elimina automáticamente.'],
['5. Pagos y entregas','El pago y la entrega se acuerdan directamente entre comprador y vendedor, en persona y en el campus. U2U solo los conecta: no recibe, no retiene ni garantiza ningún pago y no es parte de la compraventa ni del alquiler. Revisa el producto antes de pagar y entrega siempre en los puntos seguros del campus.'],
['6. Publicaciones prohibidas','No se pueden publicar armas, drogas o sustancias ilegales, productos robados, falsificados o sin derecho a venta, contenido sexual, obsceno, violento o discriminatorio, datos personales de otras personas, ni ofertas que pidan pagos fuera de la entrega en persona. U2U puede eliminar publicaciones y bloquear cuentas que incumplan estas normas.'],
['7. Destacados y reembolsos','Puedes destacar una publicación tuya para que salga primero en el catálogo durante 7 días. Durante la fase piloto es gratis; cuando tenga costo (precio previsto: S/ 2 por 7 días) verás el precio antes de pagar. El pago se hace por Yape al número que muestra la app; tú informas el número de operación y el nombre o celular del titular, y el equipo U2U lo verifica a mano antes de activar el destacado. Destacar aumenta la visibilidad pero no garantiza la venta. Guardamos tu solicitud, sus fechas, el número de operación y el nombre o celular del titular: solo los ven el equipo U2U y tú, y un número de operación solo puede usarse una vez. Si tu publicación se elimina, se pausa o se vende antes de terminar el periodo, el destacado se cancela. Política de reembolso: [POR DEFINIR POR U2U ANTES DE ACTIVAR EL COBRO]; mientras tanto, cualquier reembolso se gestiona de forma manual con el equipo U2U.'],
['8. Tus derechos','Puedes pedir acceso, rectificación, cancelación u oposición sobre tus datos escribiendo a la cuenta oficial de U2U desde la app. Mientras tanto puedes corregir tu nombre, carrera, ciclo y sede en Mi cuenta.'],
['9. Responsabilidad','U2U se ofrece tal cual, sin garantías sobre los productos, los usuarios ni su disponibilidad continua. Usa la app con criterio y cuida tu seguridad.']];
V.legal=()=>hd('Términos y Privacidad')+`<div class="p-5 pb-16 space-y-4">${LEGAL.map((s,i)=>`<section${i?'':' class="bg-amber-50 text-amber-900 rounded-2xl p-3"'}><h2 class="font-bold ${i?'text-navy':'text-sm'}">${esc(s[0])}</h2><p class="text-sm ${i?'text-slate-600':'text-amber-900 text-xs'} leading-relaxed mt-1">${esc(s[1])}</p></section>`).join('')}</div>`;

/* ---------- Mi cuenta: editar nombre, carrera, ciclo y sede ---------- */
let AF={};
function openCuenta(){const u=ACC;if(!u||!LV.me)return toast('Inicia sesión para ver tu cuenta');AF={name:u.name,career:u.career||'',cycle:u.cycle||'',campus:u.campus||'',busy:false};nav('cuenta')}
V.cuenta=()=>{const u=ACC;if(!u)return hd('Mi cuenta')+'<p class="p-6 text-center text-slate-500">Inicia sesión para ver tu cuenta.</p>';
 const upc=!!u.condition&&!u.admin,egr=u.condition=='egresado',vis=u.vis||{},vl=[['career','carrera'],['cycle','ciclo'],['campus','sede']].filter(k=>vis[k[0]]).map(k=>k[1]);
 return hd('Mi cuenta')+`<div class="p-5 pb-24">${acctBox()}
 ${u.admin?'<p class="text-sm text-slate-500 mt-4">La cuenta oficial se configura en el servidor.</p>':`<form onsubmit="event.preventDefault();acSave()" novalidate class="mt-4">
 <label class="${FLB}" for="c_name">Nombre</label><input id="c_name" class="inp" maxlength="24" autocomplete="name" value="${esc(AF.name)}" oninput="AF.name=this.value"><p class="text-[11px] text-slate-400 -mt-2 mb-3">Un cambio de nombre se verá en tus publicaciones y chats nuevos.</p>
 ${upc?`<label class="${FLB}" for="c_car">Carrera</label><select id="c_car" class="inp" onchange="AF.career=this.value">${optsH(CAR_O,AF.career)}</select>
 <label class="${FLB}" for="c_cyc">Ciclo</label><select id="c_cyc" class="inp" onchange="AF.cycle=this.value" ${egr?'disabled':''}>${optsH(egr?[['Egresado','Egresado']]:CYC_O.concat([['Egresado','Egresado']]),AF.cycle)}</select>
 <label class="${FLB}" for="c_cam">Sede</label><select id="c_cam" class="inp" onchange="AF.campus=this.value">${optsH(SED_O,AF.campus)}</select>
 <p class="text-[11px] text-slate-400 -mt-2 mb-3">${vl.length?'Visible para otros usuarios: '+vl.join(', ')+'. Tu correo nunca se muestra.':'Tu carrera, ciclo y sede no son visibles para otros usuarios. Tu correo nunca se muestra.'}</p>`:'<p class="text-xs text-slate-500 mb-3">Tu cuenta es anterior al registro con correo UPC: por ahora solo puedes cambiar el nombre.</p>'}
 ${u.email?`<p class="${FLB}">Correo</p><p class="text-sm text-slate-700 mb-3">${esc(u.email)}</p>`:''}
 <p id="c_er" role="alert" class="text-red-500 text-xs min-h-[1.25rem] text-center"></p><button id="c_btn" type="submit" class="btn">Guardar cambios</button></form>`}
 ${u.email&&/@upc\.edu\.pe$/.test(u.email)&&!u.admin?`<button class="w-full mt-4 border border-brand text-brand font-semibold py-3 rounded-2xl" onclick="rcOpen(1)">Recuperar contraseña</button>`:''}
 <button class="w-full mt-3 text-sm font-semibold text-brand py-2" onclick="nav('legal')">Términos y Privacidad</button></div>`};
async function acSave(){if(AF.busy)return;const u=ACC,er=$('#c_er'),b=$('#c_btn'),name=AF.name.trim(),body={name};er.textContent='';
 if(name.length<2)return er.textContent='Escribe tu nombre (mínimo 2 letras).';
 if(u.condition){if(!AF.career||!AF.cycle||!AF.campus)return er.textContent='Completa carrera, ciclo y sede.';Object.assign(body,{career:AF.career,cycle:AF.cycle,campus:AF.campus})}
 AF.busy=true;b.disabled=true;b.textContent='Guardando…';
 const r=await api('me',body,tkGet(),'PUT');AF.busy=false;b.disabled=false;b.textContent='Guardar cambios';
 if(r.ok&&r.j.user){ACC=r.j.user;meSet(ACC);LV.me.name=ACC.name;SEL[ME].n=ACC.name;LV.pref={name:ACC.name};try{localStorage.setItem('u2u7',JSON.stringify(LV.pref))}catch(e){}
  AF={name:ACC.name,career:ACC.career||'',cycle:ACC.cycle||'',campus:ACC.campus||'',busy:false};toast('Cambios guardados');return R(1)}
 er.textContent=humanErr(r)}

/* ---------- Cuenta sin verificar: nada de publicar, reservar ni chatear (el servidor lo vuelve a exigir con NOT_VERIFIED) ---------- */
const lockMsg=()=>LV.me&&LV.me.verified===false?(LV.me.pending?'Tu cuenta espera la aprobación del equipo U2U. Aún no puedes publicar, reservar ni chatear.':'Verifica tu correo UPC para publicar, reservar o chatear.'):'';
['openChat','offerM','offerSend','startCO','chatOff','lsend','pubGo'].forEach(n=>{const f=window[n];if(typeof f!='function')return;window[n]=function(){const m=lockMsg();return m?toast(m):f.apply(this,arguments)}});
{const f=window.startPub;window.startPub=function(){const m=lockMsg();if(m)return toast(m);const k=SEL[ME].prof?campusIdx(SEL[ME].prof.campus):-1;if(k>=0)SEL[ME].cp=k; /* sede por defecto al publicar = la elegida en el registro */return f.apply(this,arguments)}}
const LOCKQ='[onclick^="startPub("],[onclick^="openChat("],[onclick^="offerM("],[onclick^="startCO("],[onclick^="chatOff("],[onclick^="lsend("]';
function lockUI(){const m=lockMsg(),v=$('#v');document.querySelectorAll('.acc-lock').forEach(e=>e.remove());if(!m)return;
 document.querySelectorAll(LOCKQ).forEach(b=>{b.setAttribute('aria-disabled','true');b.classList.add('opacity-50')});
 if(S.s=='home'&&v){v.insertAdjacentHTML('afterbegin',`<div class="acc-lock mx-5 mt-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs flex gap-2 items-start"><i data-lucide="mail" class="w-5 shrink-0"></i><div class="flex-1"><b class="block text-sm">${LV.me.pending?'Cuenta pendiente de aprobación':'Cuenta sin verificar'}</b>${LV.me.pending?'El equipo U2U la revisará.':'Si no verificas en 72 h, se elimina.'} Mientras tanto no puedes publicar, reservar ni chatear.${LV.me.pending?'':'<button class="block mt-2 font-bold text-brand" onclick="nav(\'verify\')">Ingresar código</button>'}</div></div>`);lucide.createIcons()}}
{const _R2=R;R=function(keep){_R2(keep);lockUI()}}
bootInit();
