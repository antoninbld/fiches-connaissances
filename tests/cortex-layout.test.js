const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const layoutPosition = html.indexOf('<div class="cortex-layout" id="cortex-layout">');
const sizeToolbarPosition = html.indexOf('<div class="cortex-size-toolbar">');

assert.ok(layoutPosition >= 0, 'la visualisation du Cortex doit être présente');
assert.ok(sizeToolbarPosition > layoutPosition, 'le réglage de taille doit apparaître sous la visualisation');
assert.doesNotMatch(html, /Glisser: orbite 3D/, 'les instructions de navigation ne doivent plus encombrer le graphe');
assert.match(html, /class="cortex-zoom-controls"/, 'les contrôles de zoom doivent rester disponibles');

console.log('Cortex layout: tests réussis');
