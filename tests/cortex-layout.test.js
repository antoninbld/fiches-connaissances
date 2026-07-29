const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const layoutPosition = html.indexOf('<div class="cortex-layout" id="cortex-layout">');
const sizeToolbarPosition = html.indexOf('<div class="cortex-size-toolbar">');

assert.ok(layoutPosition >= 0, 'la visualisation du Cortex doit être présente');
assert.ok(sizeToolbarPosition > layoutPosition, 'le réglage de taille doit apparaître sous la visualisation');
assert.doesNotMatch(html, /Glisser: orbite 3D/, 'les instructions de navigation ne doivent plus encombrer le graphe');
assert.match(html, /class="cortex-zoom-controls"/, 'les contrôles de zoom doivent rester disponibles');
assert.match(html, /const cloudRadiusX=width\*0\.46/, 'le nuage doit exploiter la largeur disponible');
assert.match(html, /const cloudRadiusY=height\*0\.43/, 'le nuage doit exploiter la hauteur disponible');
assert.match(html, /organicWave=1\+Math\.sin/, 'la distribution doit conserver une irrégularité organique');
assert.doesNotMatch(html, /sphereRadius=Math\.min\(width,height\)/, 'le Cortex ne doit plus être contraint par une petite sphère centrale');
assert.match(html, /const CORTEX_VIEW_DEFAULTS=\{panX:0,panY:0,zoom:0\.75\}/, 'la vue initiale doit être suffisamment dézoomée pour montrer le Cortex dans sa globalité');

console.log('Cortex layout: tests réussis');
