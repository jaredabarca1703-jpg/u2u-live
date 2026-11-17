const IM={"cam": "img/cam.jpg", "cam2": "img/cam2.jpg", "sew": "img/sew.jpg", "esc": "img/esc.jpg", "regla": "img/regla.jpg", "mic": "img/mic.jpg", "calc": "img/calc.jpg", "mac": "img/mac.jpg", "tri": "img/tri.jpg", "logo": "img/logo.jpg", "dron": "img/dron.svg", "libro": "img/libro.svg", "pack": "img/pack.svg", "apuntes": "img/apuntes.svg", "casco": "img/casco.svg", "ipad": "img/ipad.svg", "scrub": "img/scrub.svg", "botas": "img/botas.svg", "arduino": "img/arduino.svg", "monitor": "img/monitor.svg", "hpprime": "img/hpprime.svg", "mandil": "img/mandil.svg", "teclado": "img/teclado.svg", "wacom": "img/wacom.svg", "kit": "img/kit.svg", "nivel": "img/nivel.svg"};
/* =================== DATOS =================== */
const $=s=>document.querySelector(s),sol=n=>'S/ '+Number(n).toLocaleString('es-PE'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hm=()=>new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),fd=n=>{const d=new Date();d.setDate(d.getDate()+n);const p=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
const CAMP=['UPC Monterrico','UPC San Isidro','UPC Villa','UPC San Miguel'];
const CATS=[['Todo','layout-grid'],['Cámaras','camera'],['Laptops','laptop'],['Calculadoras','calculator'],['Herramientas','ruler'],['Libros','book-open'],['Audio','mic'],['Ropa','shirt']];
const G=[['Cámaras y fotografía','camera',['Cámaras','Audio']],['Laptops y tecnología','laptop',['Laptops']],['Calculadoras y equipo de estudio','calculator',['Calculadoras','Libros']],['Herramientas y otros','wrench',['Herramientas','Ropa']]];
const LL=[[-12.1042,-76.9630],[-12.0968,-77.0378],[-12.2045,-76.9615],[-12.0763,-77.0938]],pll=p=>{const c=LL[pcp(p)],j=((p.id%5)-2)*.00015;return[c[0]+j*.6,c[1]+j*.6]};
const SEL=[{n:'',r:0,c:0,car:'Estudiante UPC',cp:0,v:new Date().getFullYear(),ci:'—'}]; // solo el usuario actual; los vendedores reales se agregan desde el servidor
const ME=0;
const pcp=p=>p.cp!=null?p.cp:SEL[p.s].cp; // campus de la PUBLICACIÓN (no del vendedor)
const sedeCmp=(a,b)=>(pcp(a)!=SEL[ME].cp)-(pcp(b)!=SEL[ME].cp); // «En tu sede primero»
let PR=[]; // el catálogo oficial y el de la comunidad llegan del servidor (seed.json + publicaciones)
const ST={fav:[],orders:[],chats:{},off:{},mine:[]};
try{Object.assign(ST,JSON.parse(localStorage.getItem('u2u6')||'{}'));PR=[...ST.mine,...PR]}catch(e){}
const save=()=>{try{ST.mine=PR.filter(p=>p.id>100&&!p.remote);localStorage.setItem('u2u6',JSON.stringify(ST))}catch(e){toast('Memoria llena: no se guardó')}};
const src=k=>IM[k]||k,P=id=>PR.find(p=>p.id==id);
const pic=(p,i=0,c='')=>p.ph[i]?`<img src="${src(p.ph[i])}" loading="lazy" decoding="async" alt="${esc(p.t||'Producto')}" onerror="imgErr(this,'${p.e||'📦'}')" class="w-full h-full object-cover ${c}">`:`<div class="w-full h-full grid place-items-center text-5xl bg-blue-50">${p.e||'📦'}</div>`;
const price=(p,m)=>{m=m||p.mode;return m=='alquiler'?`${sol(p.rent)}<small class="font-semibold text-slate-500">/día</small>`:m=='venta'?sol(p.price):`${sol(p.price)}<small class="font-semibold text-slate-500"> · ${sol(p.rent)}/día</small>`};
const tag=m=>m=='venta'?['Venta','bg-emerald-100 text-emerald-700']:m=='alquiler'?['Alquiler','bg-sky-100 text-sky-700']:['Venta · Alquiler','bg-violet-100 text-violet-700'];
const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
