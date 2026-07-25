const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const data = JSON.parse(fs.readFileSync(new URL('../data.json', `file://${__filename}`), 'utf8'));

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

const ensureSource = extractFunction('ensureAtlasSourceAndLayers');
assert.match(ensureSource, /cluster:true/);
assert.match(ensureSource, /filter:\['has','point_count'\]/);
assert.match(ensureSource, /filter:\['!',\['has','point_count'\]\]/);
assert.match(ensureSource, /'text-allow-overlap':true/);
assert.match(ensureSource, /'text-ignore-placement':true/);
assert.match(ensureSource, /'circle-opacity':atlasSettings\.clusters\.opacity/);

const recreateSource = extractFunction('recreateAtlasCardSource');
assert.ok(recreateSource.indexOf('removeLayer') < recreateSource.indexOf('removeSource'));
assert.ok(recreateSource.indexOf('removeSource') < recreateSource.indexOf('ensureAtlasSourceAndLayers'));

const raiseLayers = extractFunction('raiseAtlasLayers');
const expectedOrder = ['ATLAS_LINKS_LAYER_ID', 'ATLAS_CLUSTERS_LAYER_ID', 'ATLAS_CLUSTER_COUNT_LAYER_ID', 'ATLAS_POINTS_LAYER_ID', 'ATLAS_SELECTION_LAYER_ID'];
expectedOrder.reduce((previous, layer) => {
  const position = raiseLayers.indexOf(layer);
  assert.ok(position > previous, `${layer} doit être placé dans l’ordre Atlas`);
  return position;
}, -1);

const interactions = extractFunction('bindAtlasInteractionsOnce');
assert.match(interactions, /atlasInteractionsBound\|\|!atlasMap/);
assert.match(interactions, /getClusterExpansionZoom\(clusterId\)/);
assert.match(interactions, /duration:700,essential:true/);

const coordinateHelpers = new Function(`${extractFunction('getCardCoordinates')}\n${extractFunction('getCardsAtCoordinates')}; return {getCardsAtCoordinates};`)();
const cards = [
  {id: 'a', location: {latitude: 48.8, longitude: 2.3}},
  {id: 'b', location: {latitude: '48.8', longitude: '2.3'}},
  {id: 'c', location: {latitude: 40, longitude: -74}},
];
assert.deepEqual(coordinateHelpers.getCardsAtCoordinates([2.3, 48.8], cards).map(card => card.id), ['a', 'b']);
assert.match(extractFunction('selectAtlasPoint'), /cards\.length>1/);
assert.match(extractFunction('showAtlasColocatedCards'), /Consulter/);

assert.match(html, /clusterRadius:50,clusterMaxZoom:14/);
assert.match(html, /ATLAS_SETTINGS_STORAGE_KEY='atlas-settings-v2',ATLAS_VIEW_STORAGE_KEY='atlas-view-v2'/);
assert.match(html, /initialLongitude:105,initialLatitude:12,initialZoom:2\.65/);

const timorCards = data.fiches.filter(card => card.location?.name === 'Timor Oriental');
assert.equal(timorCards.length, 2, 'les données doivent contenir le cluster visible au premier affichage');
assert.ok(timorCards.every(card => Math.abs(card.location.longitude - 105) < 30), 'le cluster du Timor doit se trouver sur la face initialement visible');
assert.match(html, /atlasMap\.on\('style\.load'.*ensureAtlasSourceAndLayers\(\).*raiseAtlasLayers\(\)/s);

console.log('Atlas clusters: tests réussis');
