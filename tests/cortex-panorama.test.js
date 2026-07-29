const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

assert.match(html, /function toggleCortexPanorama\(\)/, 'le mode panorama doit pouvoir être activé');
assert.match(html, /aria-pressed="\$\{cortexPanorama\}"/, 'le bouton doit exposer son état aux technologies d’assistance');
assert.match(html, /body\.cortex-panorama #sidebar\{width:250px;min-width:250px\}/, 'le panneau de navigation doit rester visible en mode panorama');
assert.match(html, /body\.cortex-panorama \.cortex-category-filters\{display:none\}/, 'les filtres secondaires doivent être compactés');
assert.match(html, /window\.innerHeight-layout\.getBoundingClientRect\(\)\.top-16/, 'le graphe doit utiliser la hauteur restante de la fenêtre');
assert.doesNotMatch(html, /body\.cortex-panorama #sidebar\{display:none/, 'le mode panorama ne doit pas supprimer le panneau latéral');

console.log('Cortex panorama: tests réussis');
