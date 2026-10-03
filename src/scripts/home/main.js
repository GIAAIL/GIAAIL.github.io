/**
 * Home page entry. The drum starts at once; three.js and the scene load as a separate
 * chunk and join it when ready (the background shows the page colour until then).
 */
import { startDrum } from './drum.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let house = null;
startDrum({ reduced, getHouse: () => house });

(async () => {
  try {
    const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { createNeonLattice }] = await Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
      import('./neon-lattice.js'),
    ]);
    house = createNeonLattice({ THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass }, document.getElementById('house'), { reducedMotion: reduced });
  } catch (e) {
    console.warn('WebGL unavailable', e);
  }
})();
