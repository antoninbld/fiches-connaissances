const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `fonction ${name} introuvable`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`fin de ${name} introuvable`);
}

const initialization = extractFunction('initializeAtlasAppearance');
const expectedOrder = [
  'setupAtlasGlobe(settings)',
  'ensureAtlasSourceAndLayers(settings)',
  'ensureAtlasLinksSourceAndLayer(settings)',
  'ensureAtlasSelectionSourceAndLayer(settings)',
  'applyAtlasSettingsToMap(settings)',
];
let previous = -1;
for (const call of expectedOrder) {
  const position = initialization.indexOf(call);
  assert.ok(position > previous, `${call} doit suivre l’étape précédente`);
  previous = position;
}
assert.match(html, /style:getAtlasStyleURL\(atlasSettings\.basemap\.style\)/, 'le fond sauvegardé doit être le style initial');
assert.match(html, /clusterMaxZoom:clusters\.clusterMaxZoom,clusterRadius:clusters\.clusterRadius/, 'la source doit employer les paramètres de cluster courants');
assert.doesNotMatch(extractFunction('ensureAtlasSourceAndLayers'), /'#c9a84c'|\b11,7\b/, 'les couches ne doivent plus être créées avec les styles par défaut codés en dur');
assert.match(initialization, /atlasAppearanceInitializationPromise=.*\.then/, 'les restaurations concurrentes doivent être sérialisées');
assert.match(extractFunction('syncAtlasRotation'), /if\(atlasRotationFrame\)return/, 'une seconde boucle de rotation ne doit pas être créée');
const globeSetup = extractFunction('setupAtlasGlobe');
assert.match(globeSetup, /getProjection\?\.\(\)\.type!==['"]globe['"]/, 'la projection globe ne doit être réappliquée que si nécessaire');
assert.doesNotMatch(globeSetup, /try\s*{\s*atlasMap\.setProjection/, 'setProjection ne doit pas relancer style.load à chaque restauration');

console.log('Atlas settings: tests réussis');
