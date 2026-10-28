// Entry point: reads the hash, renders the matching view, re-renders on change.
import { parseHash, route } from './router.js';
import { renderDemo } from './views/demo.js';
import { renderFeature } from './views/feature.js';

const views = { demo: renderDemo, feature: renderFeature };
const root = document.getElementById('app');

function render() {
  const match = parseHash(window.location.hash);
  if (match.name === 'not-found') {
    // Unknown or empty route: go to the demo page.
    window.location.replace(route('demo'));
    return;
  }
  views[match.name](root, match);
}

window.addEventListener('hashchange', render);
render();
