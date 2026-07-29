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
const atlasFeatureStates = [];
const openHelpers = new Function('db', 'normalizeCardId', 'getCardCoordinates', 'goAtlas', 'atlasMap', 'ATLAS_SOURCE', `let pendingAtlasSelectionId=null,atlasSelectedId='ancienne';${openSource};return {openFicheInAtlas,getPending:()=>pendingAtlasSelectionId,getSelected:()=>atlasSelectedId};`)(
  db,
  normalizeCardId,
  getCardCoordinates,
  () => { navigations += 1; },
  {getSource: () => ({}), setFeatureState: (...args) => atlasFeatureStates.push(args)},
  'knowledge-cards',
);

assert.equal(openHelpers.openFicheInAtlas('sans-coordonnees'), false);
assert.equal(navigations, 0, 'une fiche absente de l’Atlas ne doit pas déclencher de navigation');
assert.equal(openHelpers.openFicheInAtlas(' localisee '), true);
assert.equal(openHelpers.getPending(), 'localisee');
assert.equal(openHelpers.getSelected(), 'localisee', 'la fiche doit être activée dans l’Atlas avant même le changement de vue');
assert.deepEqual(atlasFeatureStates, [[{source: 'knowledge-cards', id: 'ancienne'}, {selected: false}]], 'l’ancienne fiche Atlas doit être désactivée immédiatement');
assert.equal(navigations, 1);

const focusSource = extractFunction('focusPendingAtlasFiche');
const selections = [];
let atlasStyleLoaded = false;
const focusHelpers = new Function('db', 'normalizeCardId', 'getCardCoordinates', 'atlasMap', 'ATLAS_SOURCE', 'selectAtlasFiche', `let pendingAtlasSelectionId='localisee';${focusSource};return {focusPendingAtlasFiche,getPending:()=>pendingAtlasSelectionId};`)(
  db,
  normalizeCardId,
  getCardCoordinates,
  {isStyleLoaded: () => atlasStyleLoaded, getSource: () => ({})},
  'knowledge-cards',
  (...args) => selections.push(args),
);

assert.equal(focusHelpers.focusPendingAtlasFiche(), false, 'la vue ne doit pas être ciblée avant que le style et la source soient prêts');
assert.equal(focusHelpers.getPending(), 'localisee', 'la sélection doit rester en attente pendant le chargement du style');
atlasStyleLoaded = true;
assert.equal(focusHelpers.focusPendingAtlasFiche(), true);
assert.deepEqual(selections, [['localisee', [2.3522, 48.8566], {animate: false}]], 'la navigation inter-vues doit imposer immédiatement le cadrage, avant le filtrage du globe');
assert.equal(focusHelpers.focusPendingAtlasFiche(), false, 'la sélection en attente doit être consommée une seule fois');

assert.match(
  html,
  /requestAnimationFrame\(\(\)=>\{\s*atlasMap\?\.resize\(\);\s*if\(!animate&&atlasSelectedId===id\)\{atlasMap\?\.stop\?\.\(\);atlasMap\?\.jumpTo\(camera\);refreshVisibleAtlasFeatures\(\);\}/,
  'le cadrage non animé doit être rejoué après le redimensionnement causé par le panneau Atlas',
);

const initSource = extractFunction('initAtlasMap');
const loadHandler = initSource.slice(initSource.indexOf("atlasMap.on('load'"), initSource.indexOf("atlasMap.on('style.load'"));
assert.ok(
  loadHandler.indexOf('focusPendingAtlasFiche()') > loadHandler.indexOf('atlasHasBeenDisplayed=true'),
  'la fiche en attente doit être ciblée après le recentrage initial du globe',
);
assert.match(
  loadHandler,
  /if\(!atlasSelectedId&&!pendingAtlasSelectionId\)/,
  'le chargement complet ne doit pas restaurer la vue par défaut par-dessus une sélection déjà appliquée à style.load',
);
assert.doesNotMatch(focusSource, /atlasMapLoaded/, 'le ciblage ne doit pas attendre les ressources distantes après style.load');

console.log('Navigation Cortex vers Atlas : tests réussis');
