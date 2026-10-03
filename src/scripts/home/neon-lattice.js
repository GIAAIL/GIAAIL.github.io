// Ported verbatim from the approved home prototype ("AIL Lattice Room", artifact version 1791003518).
// Only change: `export`. To take a newer prototype, replace everything below this comment.

/**
 * AIL background, v5: the lattice room from v1, in the dark, with a spinning bundle of tubes at its heart.
 *
 * - A massing of lattice nodes and thin edges, pale grey on black. A section plane travels
 *   through it: behind the plane the points sit on their nodes and the edges are drawn;
 *   ahead of it the points drift as a soft cloud. The plane itself is a cobalt hairline —
 *   the only line with colour. The first sweep is the opening: the cloud resolves into the room.
 * - In the stairwell, sixteen metallic tubes chase a figure-of-eight target as follow-the-leader
 *   chains, lit by four coloured lights (a faithful port of Kevin Levron's Tubes Cursor).
 * - `setScroll(pos)` tours the camera between one viewpoint per content section.
 *
 * createNeonLattice(deps, canvas, options) → { setScroll, pause, resume, destroy }
 * deps = { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass }
 */
export function createNeonLattice(deps, canvas, opts = {}) {
  const { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = deps;
  const o = Object.assign({
    nx: 40, ny: 16, nz: 24, block: [8, 4, 8], voidRatio: 0.5,
    core: 7.5,                         // radius kept clear for the tubes, lattice units
    period: 26,                        // seconds per sweep of the section plane
    frontWidth: 2.4, amp: 2.8,
    bg: '#1b1a19', grey: '#bdbab6', line: '#7d7a77', accent: '#f3f1ee',
    // Tubes Cursor defaults (threejs-components tubes1), scaled to this world: his camera sits 5 units from a ~4.7-unit-tall view; ours shows a 40-unit room
    tubeCount: 16, tubeColors: ['#f967fb', '#53bc28', '#6958d5'], lightColors: ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5'],
    minRadius: 0.08, maxRadius: 0.75, minSegments: 64, maxSegments: 220,   // longer chains than his 32–128 → longer tails
    tubeMaterial: { metalness: 1, roughness: 0.34 }, tubeLerp: 0.42, tubeNoise: 0.05 * 9,   // lerp a little under his 0.5 → each link lags more
    lightIntensity: 1500, lightDistance: 11,
    pathRadius: [6.5, 3.2, 2.4], pathSpeed: 1.1, pathDriftY: 3.5,
      // radians per second
    bloom: { strength: 0.75, radius: 0.45, threshold: 0.72 },
    views: [
      { az: 40,   el: 26, dist: 150, target: [-9, 2, 0],  fov: 20 },   // overview, near-axonometric, room to the right of the title
      { az: -40,  el: 8,  dist: 60,  target: [0, 2, 0],   fov: 34 },   // low, closer, from the left
      { az: 60,   el: 74, dist: 55,  target: [0, 4, 0],   fov: 30 },   // overhead, down into the core
      { az: 130,  el: 6,  dist: 11,  target: [0, 1, 0],   fov: 66 },   // inside, beside the tubes
      { az: -150, el: 14, dist: 28,  target: [12, 0, -6], fov: 36 },   // a corner, where the plane passes
      { az: 210,  el: 32, dist: 150, target: [0, 0, 0],   fov: 20 },   // far, from the back
    ],
    reducedMotion: false,
    dpr: Math.min(window.devicePixelRatio || 1, 1.5),
  }, opts);

  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  // ------------------------------------------------------------ lattice
  const { nx, ny, nz } = o;
  const [bx, by, bz] = o.block;
  const nbx = Math.ceil(nx / bx), nby = Math.ceil(ny / by), nbz = Math.ceil(nz / bz);
  const voids = new Uint8Array(nbx * nby * nbz);
  for (let j = 1; j < nby; j++) {
    const p = o.voidRatio * (0.4 + 1.0 * (j / nby));
    for (let i = 0; i < nbx; i++) for (let k = 0; k < nbz; k++) voids[(j * nbx + i) * nbz + k] = rnd() < p ? 1 : 0;
  }
  const cx = (nx - 1) / 2, cy = (ny - 1) / 2, cz = (nz - 1) / 2;
  const idx = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [], seeds = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (voids[((j / by) | 0) * nbx * nbz + ((i / bx) | 0) * nbz + ((k / bz) | 0)]) continue;
    const x = i - cx, z = k - cz;
    if (Math.hypot(x, z) < o.core) continue;                     // stairwell
    idx[(j * nx + i) * nz + k] = pos.length / 3;
    pos.push(x, j - cy, z); seeds.push(rnd());
  }
  const nodeAt = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : idx[(j * nx + i) * nz + k];
  const linePos = [], lineSeed = [];
  const pushEdge = (a, b) => { linePos.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); lineSeed.push(seeds[a], seeds[b]); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const a = nodeAt(i, j, k); if (a < 0) continue;
    const column = i % 4 === 0 && k % 4 === 0, floor = j % 4 === 0;
    const up = nodeAt(i, j + 1, k), rx = nodeAt(i + 1, j, k), rz = nodeAt(i, j, k + 1);
    if (up >= 0 && (column || rnd() < 0.12)) pushEdge(a, up);
    if (rx >= 0 && (floor ? rnd() < 0.85 : rnd() < 0.08)) pushEdge(a, rx);
    if (rz >= 0 && (floor ? rnd() < 0.85 : rnd() < 0.08)) pushEdge(a, rz);
  }

  // ------------------------------------------------------------ three
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // compresses overlapping highlights instead of letting them clip to white
  renderer.toneMappingExposure = 1.0;
  // the composer clears in output encoding and OutputPass encodes again; pre-compensate so the ground lands on o.bg
  renderer.setClearColor(new THREE.Color(o.bg).convertSRGBToLinear(), 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 600);

  const frontN = new THREE.Vector3(1, 0.45, 0.7).normalize();
  let dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { const v = pos[i] * frontN.x + pos[i + 1] * frontN.y + pos[i + 2] * frontN.z; if (v < dMin) dMin = v; if (v > dMax) dMax = v; }
  const fLo = dMin - o.frontWidth * 2.5, fHi = dMax + o.frontWidth * 2.5;

  const uniforms = {
    uTime: { value: 0 }, uFront: { value: fLo }, uFrontN: { value: frontN }, uFrontW: { value: o.frontWidth }, uAmp: { value: o.amp },
    uInk: { value: new THREE.Color(o.grey) }, uLine: { value: new THREE.Color(o.line) }, uDpr: { value: o.dpr }, uDist: { value: 100 },
    uSize: { value: new THREE.Vector2(3.0, 1.8) }, uLineAlpha: { value: 0.55 },
    uPointer: { value: new THREE.Vector2() }, uPointerOn: { value: 0 }, uAspect: { value: 1 },
  };
  const common = /* glsl */ `
    uniform float uTime, uFront, uFrontW, uAmp, uDist;
    uniform vec3 uFrontN; uniform vec2 uPointer; uniform float uPointerOn, uAspect;
    attribute float aSeed;
    vec3 drift(vec3 p, float seed, float t) {
      float a = seed * 6.2831853;
      return vec3(sin(t * 0.21 + a + p.y * 0.35) + 0.5 * sin(t * 0.37 + p.z * 0.5 + a * 2.0),
                  cos(t * 0.17 + a * 1.3 + p.x * 0.3) + 0.5 * sin(t * 0.29 + p.x * 0.4 + p.z * 0.2),
                  sin(t * 0.19 + a * 0.7 + p.x * 0.25 + p.y * 0.2) + 0.5 * cos(t * 0.31 + p.y * 0.45));
    }
    float order(vec3 p, float seed) { return 1.0 - smoothstep(-uFrontW, uFrontW, dot(p, uFrontN) - uFront + (seed - 0.5) * 1.6); }
    vec4 place(vec3 p, float seed, out float s, out float depth) {
      s = order(p, seed);
      vec3 q = mix(p + drift(p, seed, uTime) * uAmp, p, s);
      vec4 mv = modelViewMatrix * vec4(q, 1.0);
      depth = -mv.z;
      vec4 clip = projectionMatrix * mv;
      vec2 ndc = clip.xy / clip.w;
      vec2 dd = (ndc - uPointer) * vec2(uAspect, 1.0);
      float L = length(dd); float f = uPointerOn * smoothstep(0.36, 0.0, L);
      ndc += (dd / max(L, 1e-4)) * f * 0.05 / vec2(uAspect, 1.0);
      clip.xy = ndc * clip.w;
      return clip;
    }`;
  const pointsMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: common + /* glsl */ `
      uniform float uDpr; uniform vec2 uSize; varying float vS;
      void main() { float d; gl_Position = place(position, aSeed, vS, d); gl_PointSize = mix(uSize.x, uSize.y, vS) * uDpr * clamp(uDist / d, 0.35, 3.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk; varying float vS;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float r = mix(0.5, 0.10, vS);
        vec2 q = abs(c) - (0.5 - r); float dist = length(max(q, 0.0)) - r;
        float a = 1.0 - smoothstep(-0.10, 0.04, dist);
        gl_FragColor = vec4(uInk, a * mix(0.35, 0.8, vS));
      }`,
  });
  const linesMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: common + /* glsl */ `varying float vS; void main() { float d; gl_Position = place(position, aSeed, vS, d); }`,
    fragmentShader: /* glsl */ `uniform vec3 uLine; uniform float uLineAlpha; varying float vS; void main() { gl_FragColor = vec4(uLine, uLineAlpha * smoothstep(0.15, 1.0, vS)); }`,
  });
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  lGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(lineSeed, 1));
  const points = new THREE.Points(pGeo, pointsMat), lines = new THREE.LineSegments(lGeo, linesMat);
  points.frustumCulled = lines.frustumCulled = false;
  scene.add(lines, points);

  // ------------------------------------------------------------ the tubes, after Kevin Levron's Tubes Cursor
  // 16 tubes; each is a chain of points where the head lerps to the target and every point
  // lerps to the one before it (lerp 0.5 per step), so tails whip. Spindle radius profile
  // (sin), fully metallic material lit only by four coloured point lights, heavy bloom,
  // a three-colour gradient across the tubes, and a figure-of-eight target path.
  const TUBE_COUNT = o.tubeCount, RADIAL = 8;
  const grad = o.tubeColors.map((c) => new THREE.Color(c));
  const colorAt = (u) => { const i = Math.min(1, Math.max(0, u)) * (grad.length - 1), k = Math.floor(i); return k >= grad.length - 1 ? grad[k].clone() : grad[k].clone().lerp(grad[k + 1], i - k); };
  const tubes = [];
  const bundle = new THREE.Group();
  const tubeMats = [];
  const lerpF = o.tubeLerp, noiseAmt = o.tubeNoise;
  for (let i = 0; i < TUBE_COUNT; i++) {
    const segs = Math.round(THREE.MathUtils.lerp(o.minSegments, o.maxSegments, rnd()));
    const radius = THREE.MathUtils.lerp(o.minRadius, o.maxRadius, rnd());
    const n = segs + 1, verts = n * RADIAL;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const index = [];
    for (let j = 0; j < n - 1; j++) for (let r = 0; r < RADIAL; r++) {
      const a = j * RADIAL + r, b = j * RADIAL + (r + 1) % RADIAL, c = (j + 1) * RADIAL + r, d = (j + 1) * RADIAL + (r + 1) % RADIAL;
      index.push(a, c, b, b, c, d);
    }
    geo.setIndex(index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    const mat = new THREE.MeshStandardMaterial({ color: colorAt(i / (TUBE_COUNT - 1)), metalness: o.tubeMaterial.metalness, roughness: o.tubeMaterial.roughness });
    tubeMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; bundle.add(mesh);
    tubes.push({ geo, radius, pts: Array.from({ length: n }, () => new THREE.Vector3()), to: new THREE.Vector3(), timeDelta: rnd() * 100,
      N: new THREE.Vector3(), B: new THREE.Vector3(), T: new THREE.Vector3() });
  }
  scene.add(bundle);
  // four coloured point lights at the corners of the bundle's space (his are at (±5, ±5, 5) for a 5-unit camera)
  const L = o.lightDistance;
  const lights = o.lightColors.map((c, i) => { const l = new THREE.PointLight(new THREE.Color(c), o.lightIntensity, 0, 2); l.position.set(i < 2 ? -L : L, i % 2 === 0 ? -L : L, L); scene.add(l); return l; });
  // cheap 3D noise (his uses simplex); enough to keep the tubes from collapsing onto one line
  const noise3 = (x, y, z, out) => out.set(
    Math.sin(x * 1.7 + y * 2.3) * Math.cos(z * 1.9 + x * 0.7),
    Math.sin(y * 1.9 + z * 2.1 + 1.3) * Math.cos(x * 1.3 + 0.4),
    Math.sin(z * 1.5 + x * 2.7 + 2.1) * Math.cos(y * 1.1 + 0.9));
  const targetPt = new THREE.Vector3(), nzv = new THREE.Vector3();
  // figure-of-eight, like his sleep path, plus a slow vertical drift through the stairwell
  const wander = (t, out) => out.set(
    o.pathRadius[0] * Math.cos(t * o.pathSpeed),
    o.pathRadius[1] * Math.sin(2 * t * o.pathSpeed) + o.pathDriftY * Math.sin(t * 0.21),
    o.pathRadius[2] * Math.sin(t * o.pathSpeed + 1.2));
  let simTime = 0, acc = 0, primed = false;
  const STEP = 1 / 60;
  function advance(dt) {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP; simTime += STEP;
      wander(simTime, targetPt);
      for (const tb of tubes) {
        noise3(0.01 * targetPt.x + 0.04 * simTime + tb.timeDelta, 0.01 * targetPt.y + 0.048 * simTime + tb.timeDelta, 0.01 * targetPt.z + 0.06 * simTime + tb.timeDelta, nzv);
        tb.to.copy(targetPt).addScaledVector(nzv, noiseAmt * 2 * tb.radius / o.maxRadius);
        if (!primed) tb.pts.forEach((q) => q.copy(tb.to));
        tb.pts[0].lerp(tb.to, lerpF);
        for (let j = 1; j < tb.pts.length; j++) tb.pts[j].lerp(tb.pts[j - 1], lerpF);
      }
      primed = true;
    }
  }
  function stepStrands(time, dt) {
    advance(dt);
    for (const tb of tubes) {
      const pos = tb.geo.attributes.position.array, nor = tb.geo.attributes.normal.array;
      const n = tb.pts.length;
      for (let j = 0; j < n; j++) {
        const p = tb.pts[j], pPrev = tb.pts[Math.max(0, j - 1)], pNext = tb.pts[Math.min(n - 1, j + 1)];
        tb.T.subVectors(pNext, pPrev); if (tb.T.lengthSq() < 1e-10) tb.T.set(0, 1, 0); tb.T.normalize();
        if (j === 0) { tb.N.set(tb.T.y, -tb.T.x, 0); if (tb.N.lengthSq() < 1e-4) tb.N.set(0, 0, 1); tb.N.normalize(); }
        else { tb.N.addScaledVector(tb.T, -tb.N.dot(tb.T)); if (tb.N.lengthSq() < 1e-6) tb.N.set(0, 0, 1).addScaledVector(tb.T, -tb.T.z); tb.N.normalize(); }
        tb.B.crossVectors(tb.T, tb.N);
        const r = Math.sin((j / (n - 1)) * Math.PI) * tb.radius;          // spindle: thin ends, fat middle
        for (let q = 0; q < RADIAL; q++) {
          const ang = (q / RADIAL) * Math.PI * 2, cs = -Math.cos(ang), sn = Math.sin(ang);
          const k = (j * RADIAL + q) * 3;
          nor[k] = tb.N.x * cs + tb.B.x * sn; nor[k + 1] = tb.N.y * cs + tb.B.y * sn; nor[k + 2] = tb.N.z * cs + tb.B.z * sn;
          pos[k] = p.x + nor[k] * r; pos[k + 1] = p.y + nor[k + 1] * r; pos[k + 2] = p.z + nor[k + 2] * r;
        }
      }
      tb.geo.attributes.position.needsUpdate = true; tb.geo.attributes.normal.needsUpdate = true;
    }
  }
  const strandsPrimed = () => primed;

  // bloom: only the tubes are bright enough to cross the threshold
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), o.bloom.strength, o.bloom.radius, o.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ------------------------------------------------------------ camera tour
  const views = o.views, N = views.length;
  const ptr = new THREE.Vector2(), ptrE = new THREE.Vector2();
  let scroll = 0;
  const target = new THREE.Vector3();
  const lerpAngle = (a, b, t) => a + (((b - a + 540) % 360) - 180) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  function placeCamera(time) {
    const i0 = Math.floor(((scroll % N) + N) % N), i1 = (i0 + 1) % N, f = smooth(((scroll % 1) + 1) % 1);
    const a = views[i0], b = views[i1];
    const az = lerpAngle(a.az, b.az, f) + ptrE.x * 4 + Math.sin(time * 0.045) * 2;
    const el = THREE.MathUtils.lerp(a.el, b.el, f) - ptrE.y * 3 + Math.sin(time * 0.033) * 1;
    const dist = THREE.MathUtils.lerp(a.dist, b.dist, f);
    target.set(THREE.MathUtils.lerp(a.target[0], b.target[0], f), THREE.MathUtils.lerp(a.target[1], b.target[1], f), THREE.MathUtils.lerp(a.target[2], b.target[2], f));
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, f);
    const AZ = az * Math.PI / 180, EL = el * Math.PI / 180;
    camera.position.set(target.x + dist * Math.cos(EL) * Math.sin(AZ), target.y + dist * Math.sin(EL), target.z + dist * Math.cos(EL) * Math.cos(AZ));
    camera.lookAt(target);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    uniforms.uDist.value = dist;
  }
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); uniforms.uAspect.value = w / h;
  }

  // ------------------------------------------------------------ loop
  let running = false, raf = 0, t0 = performance.now(), last = t0;
  function frontAt(t) {
    // first sweep is the opening (from fLo), then ping-pong
    const u = 0.5 - 0.5 * Math.cos(Math.PI * (t / o.period));
    return fLo + (fHi - fLo) * u;
  }
  function update(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    ptrE.lerp(ptr, 1 - Math.pow(0.002, dt));
    uniforms.uPointer.value.copy(ptrE); uniforms.uPointerOn.value += (1 - uniforms.uPointerOn.value) * (1 - Math.pow(0.01, dt));
    uniforms.uTime.value = time;
    const f = o.reducedMotion ? (fLo + fHi) / 2 : frontAt(time);
    uniforms.uFront.value = f;
    if (!o.reducedMotion || !strandsPrimed()) stepStrands(time, dt);
    placeCamera(time);
    composer.render();
  }
  function tick(now) { if (!running) return; update(now); raf = requestAnimationFrame(tick); }
  function resume() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  function pause() { running = false; cancelAnimationFrame(raf); }
  const onMove = (e) => ptr.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  window.addEventListener('pointermove', onMove);
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  stepStrands(0, 10);  // start with formed tails
  if (o.reducedMotion) update(performance.now());
  else { resume(); document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume())); }

  return {
    setScroll(p) { scroll = p; if (!running) update(performance.now()); },
    setAccent() {},   // the strands keep their own colours; the page still uses the section accent for its chrome
    views, pause, resume,
    stats: { nodes: pos.length / 3, edges: linePos.length / 6, tubes: TUBE_COUNT },
    destroy() {
      pause(); ro.disconnect(); window.removeEventListener('pointermove', onMove);
      pGeo.dispose(); lGeo.dispose(); pointsMat.dispose(); linesMat.dispose();
      tubes.forEach((tb) => tb.geo.dispose()); tubeMats.forEach((m) => m.dispose()); renderer.dispose();
    },
  };
}
