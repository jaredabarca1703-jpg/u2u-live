/* U2U · laptop con mouse (v8.6.4)
 * Solo si hay mouse real: (hover:hover) and (pointer:fine). En táctiles no hace nada: el scroll es el normal del navegador.
 *  - La rueda del mouse mueve de lado las filas horizontales (.no-sb con overflow-x-auto).
 *  - Se pueden arrastrar con el mouse (click sostenido). Un arrastre no dispara el click de los botones de la fila.
 * Script clásico, sin módulos: usa delegación en document, así sigue funcionando cuando R() vuelve a pintar la pantalla. */
(function () {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const ROW = '.no-sb.overflow-x-auto';
  const rowOf = (el) => (el && el.closest ? el.closest(ROW) : null);

  /* Rueda: la fila se mueve de lado. En el borde de la fila la rueda pasa a la pantalla (scroll vertical normal). */
  document.addEventListener('wheel', (e) => {
    const r = rowOf(e.target);
    if (!r || e.ctrlKey || r.scrollWidth <= r.clientWidth) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // gesto horizontal del trackpad: el navegador ya lo mueve
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 32; // Firefox manda líneas, no píxeles
    if ((d < 0 && r.scrollLeft <= 0) || (d > 0 && r.scrollLeft >= r.scrollWidth - r.clientWidth - 1)) return;
    r.scrollLeft += d;
    e.preventDefault();
  }, { passive: false });

  /* Arrastre con el botón izquierdo del mouse */
  let row = null, x0 = 0, s0 = 0, moved = false;
  document.addEventListener('pointerdown', (e) => {
    moved = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const r = rowOf(e.target);
    if (!r || r.scrollWidth <= r.clientWidth) return;
    if (e.target.closest('input,textarea,select')) return; // no robar el click a los campos de texto
    row = r; x0 = e.clientX; s0 = r.scrollLeft; moved = false;
  });
  document.addEventListener('pointermove', (e) => {
    if (!row) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) < 5) return; // por debajo de 5 px sigue siendo un click normal
    if (!moved) { moved = true; row.classList.add('drag-on'); } // desactiva el snap mientras se arrastra
    row.scrollLeft = s0 - dx;
    e.preventDefault();
  });
  const end = () => { if (row) { row.classList.remove('drag-on'); row = null; if (moved) setTimeout(() => { moved = false; }, 50); } }; // el click del soltado llega antes de 50 ms
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);
  /* si hubo arrastre, el click que sigue al soltar no debe activar el botón que quedó debajo */
  document.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  document.addEventListener('dragstart', (e) => { if (rowOf(e.target)) e.preventDefault(); }); // imágenes dentro de la fila no se "arrastran" como archivo
})();
