/**
 * The home page's content loop: six panels on a gently curved drum that loops.
 * Ported from the approved prototype ("AIL Lattice Room"); motion constants are unchanged.
 *
 * Changes from the prototype, all behavioural:
 * - The header links are real links to the section pages, so the prototype's `data-go`
 *   handlers are gone. The logo still turns the drum back to the hero instead of reloading.
 * - Tabbing into a panel turns the drum to it, so keyboard focus never sits on a faded panel.
 * - The flat layout (reduced motion) is rendered by the server, spacers included.
 * - The scene loads separately; `getHouse()` returns it once it exists.
 *
 * startDrum({ reduced, getHouse }) → { goTo(i) }
 */
export function startDrum({ reduced, getHouse }) {
  const panels = [...document.querySelectorAll('.panel')];
  const N = panels.length, STEP = 26;           // gentle: 26° between panels on a large drum
  const dim = document.getElementById('dim');
  let goTo = () => {};

  if (reduced) return { goTo };

  let pos = 0, target = 0, R = 1400, snapTimer = 0, last = performance.now();
  const wrap = (x) => ((x % N) + N) % N;
  goTo = (i) => { const cur = Math.round(target); const d = wrap(i - cur); target = cur + (d > N / 2 ? d - N : d); };
  function layout() {
    R = Math.max(900, window.innerHeight * 1.65);
    const active = wrap(Math.round(pos));
    for (let i = 0; i < N; i++) {
      let rel = wrap(i - pos); if (rel > N / 2) rel -= N;
      const vis = Math.abs(rel) < 1.4;
      const p = panels[i];
      p.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) continue;
      const a = rel * STEP;
      p.style.transform = `translate(-50%, -50%) translateZ(${-R}px) rotateX(${-a}deg) translateZ(${R}px)`;
      const k = Math.min(1, Math.abs(rel));
      p.style.opacity = String(Math.pow(1 - k, 1.6));
      p.classList.toggle('is-active', i === active);
    }
    const house = getHouse();
    house && house.setScroll(pos);
    const rel0 = Math.min(Math.abs(wrap(pos)), Math.abs(wrap(pos) - N));
    dim.style.opacity = String(0.45 * Math.min(1, rel0));
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    pos += (target - pos) * (1 - Math.pow(0.0008, dt));
    if (Math.abs(target - pos) < 0.0005) pos = target;
    layout();
    requestAnimationFrame(frame);
  }
  // one wheel gesture = at least one panel; a long swipe can cover several
  let base = 0, accum = 0;
  const endGesture = () => {
    const steps = Math.abs(accum) < 40 ? 0 : Math.sign(accum) * Math.max(1, Math.round(Math.abs(accum) / 900));
    target = Math.round(base) + steps; base = target; accum = 0;
  };
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (accum === 0) base = Math.round(target);
    accum += e.deltaY;
    target = base + Math.max(-1.6, Math.min(1.6, accum / 900));
    clearTimeout(snapTimer); snapTimer = setTimeout(endGesture, 160);
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); target = Math.round(target) + 1; }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); target = Math.round(target) - 1; }
    if (e.key === 'Home') goTo(0);
  });
  let y0 = null, t0 = 0;
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { y0 = e.clientY; t0 = target; } });
  window.addEventListener('pointermove', (e) => { if (y0 !== null) target = t0 + (y0 - e.clientY) / (window.innerHeight * 0.55); });
  window.addEventListener('pointerup', () => { if (y0 !== null) { y0 = null; target = Math.round(target); } });
  window.addEventListener('resize', layout);
  document.querySelector('[data-home]')?.addEventListener('click', (e) => { e.preventDefault(); goTo(0); });
  panels.forEach((p, i) => p.addEventListener('focusin', () => { if (wrap(Math.round(target)) !== i) goTo(i); }));
  layout();
  requestAnimationFrame(frame);
  return { goTo };
}
