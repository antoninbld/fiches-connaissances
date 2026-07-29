const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `fonction ${name} introuvable`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`fin de ${name} introuvable`);
}

assert.match(
  extractFunction('showCortexSelection'),
  /getCardCoordinates\(fiche\)\?`<button[^`]+openFicheInAtlas/,
  'le bouton Atlas doit uniquement être rendu pour une fiche localisée',
);

const openSource = extractFunction('openFicheInAtlas');
let navigations = 0;
const db = {fiches: [
  {id: 'localisee', location: {latitude: 48.8566, longitude: 2.3522}},
  {id: 'sans-coordonnees'},
]};
const normalizeCardId = id => String(id ?? '').trim();
const getCardCoordinates = card => card?.location ? {lat: card.location.latitude, lon: card.location.longitude} : null;
const openHelpers = new Function('db', 'normalizeCardId', 'getCardCoordinates', 'goAtlas', `let pendingAtlasSelectionId=null;${openSource};return {openFicheInAtlas,getPending:()=>pendingAtlasSelectionId};`)(
  db,
  normalizeCardId,
  getCardCoordinates,
  () => { navigations += 1; },
);

assert.equal(openHelpers.openFicheInAtlas('sans-coordonnees'), false);
assert.equal(navigations, 0, 'une fiche absente de l’Atlas ne doit pas déclencher de navigation');
assert.equal(openHelpers.openFicheInAtlas(' localisee '), true);
assert.equal(openHelpers.getPending(), 'localisee');
assert.equal(navigations, 1);

const focusSource = extractFunction('focusPendingAtlasFiche');
const selections = [];
const focusPending = new Function('db', 'normalizeCardId', 'getCardCoordinates', 'atlasMap', 'ATLAS_SOURCE', 'selectAtlasFiche', `let pendingAtlasSelectionId='localisee';${focusSource};return focusPendingAtlasFiche;`)(
  db,
  normalizeCardId,
  getCardCoordinates,
  {isStyleLoaded: () => true, getSource: () => ({})},
  'knowledge-cards',
  (...args) => selections.push(args),
);

assert.equal(focusPending(), true);
assert.deepEqual(selections, [['localisee', [2.3522, 48.8566]]]);
assert.equal(focusPending(), false, 'la sélection en attente doit être consommée une seule fois');

console.log('Navigation Cortex vers Atlas : tests réussis');
