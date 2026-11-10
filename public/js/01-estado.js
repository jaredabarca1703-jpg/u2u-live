const IM={"cam": "img/cam.jpg", "cam2": "img/cam2.jpg", "sew": "img/sew.jpg", "esc": "img/esc.jpg", "regla": "img/regla.jpg", "mic": "img/mic.jpg", "calc": "img/calc.jpg", "mac": "img/mac.jpg", "tri": "img/tri.jpg", "logo": "img/logo.jpg", "dron": "img/dron.svg", "libro": "img/libro.svg", "pack": "img/pack.svg", "apuntes": "img/apuntes.svg", "casco": "img/casco.svg", "ipad": "img/ipad.svg", "scrub": "img/scrub.svg", "botas": "img/botas.svg", "arduino": "img/arduino.svg", "monitor": "img/monitor.svg", "hpprime": "img/hpprime.svg", "mandil": "img/mandil.svg", "teclado": "img/teclado.svg", "wacom": "img/wacom.svg", "kit": "img/kit.svg", "nivel": "img/nivel.svg"};
/* =================== DATOS =================== */
const $=s=>document.querySelector(s),sol=n=>'S/ '+Number(n).toLocaleString('es-PE'),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm=()=>new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),fd=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const CAMP=['UPC Monterrico','UPC San Isidro','UPC Villa','UPC San Miguel'];
const CATS=[['Todo','layout-grid'],['Cámaras','camera'],['Laptops','laptop'],['Calculadoras','calculator'],['Herramientas','ruler'],['Libros','book-open'],['Audio','mic'],['Ropa','shirt']];
const G=[['Cámaras y fotografía','camera',['Cámaras','Audio']],['Laptops y tecnología','laptop',['Laptops']],['Calculadoras y equipo de estudio','calculator',['Calculadoras','Libros']],['Herramientas y otros','wrench',['Herramientas','Ropa']]];
const LL=[[-12.1036,-76.9631],[-12.0971,-77.0376],[-12.2042,-76.9617],[-12.0773,-77.0925]],pll=p=>{const c=LL[SEL[p.s].cp],j=(p.id%7-3)*.004;return[c[0]+j*.8,c[1]-j]};
const SEL=[{n:'',r:0,c:0,car:'Estudiante UPC',cp:0,v:new Date().getFullYear(),ci:'—'}]; // solo el usuario actual; los vendedores reales se agregan desde el servidor
const ME=0;
const U=k=>'https://images.unsplash.com/photo-'+k+'?auto=format&fit=crop&w=600&q=80';
let PR=[]; // el catálogo oficial y el de la comunidad llegan del servidor (seed.json + publicaciones)
const ST={fav:[10,13],orders:[],chats:{10:[{m:0,t:'¡Hola! Sí, el dron tiene sus 3 baterías al 100% 🔋',h:'10:24'}],1:[{m:0,t:'¡Hola Jared! Sí, la cámara sigue disponible 😊',h:'10:24'}],3:[{m:1,t:'¿Sigue disponible el trípode?',h:'Ayer'},{m:0,t:'Sí, te espero en la puerta del campus',h:'Ayer'}]},off:{},mine:[]};
try{Object.assign(ST,JSON.parse(localStorage.getItem('u2u6')||'{}'));PR=[...ST.mine,...PR]}catch(e){}
const save=()=>{try{ST.mine=PR.filter(p=>p.id>100&&!p.remote);localStorage.setItem('u2u6',JSON.stringify(ST))}catch(e){toast('Memoria llena: no se guardó')}};
const DK=[6.2,4.5,8.3,.6];PR.forEach(p=>{if(p.s!=ME)p.d=+(DK[SEL[p.s].cp]+((p.id*13)%9)/10).toFixed(1)});
const src=k=>IM[k]||k,P=id=>PR.find(p=>p.id==id);
const pic=(p,i=0,c='')=>p.ph[i]?`<img src="${src(p.ph[i])}" alt="${esc(p.t||'Producto')}" onerror="imgErr(this,'${p.e||'📦'}')" class="w-full h-full object-cover ${c}">`:`<div class="w-full h-full grid place-items-center text-5xl bg-blue-50">${p.e||'📦'}</div>`;
const price=(p,m)=>{m=m||p.mode;return m=='alquiler'?`${sol(p.rent)}<small class="font-semibold text-slate-500">/día</small>`:m=='venta'?sol(p.price):`${sol(p.price)}<small class="font-semibold text-slate-500"> · ${sol(p.rent)}/día</small>`};
const tag=m=>m=='venta'?['Venta','bg-emerald-100 text-emerald-700']:m=='alquiler'?['Alquiler','bg-sky-100 text-sky-700']:['Venta · Alquiler','bg-violet-100 text-violet-700'];
const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
