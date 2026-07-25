const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const data = JSON.parse(fs.readFileSync(new URL('../data.json', `file://${__filename}`), 'utf8'));

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `fonction ${name} introuvable`);
  const parametersStart = html.indexOf('(', start);
  let parentheses = 0;
  let bodyStart = -1;
  for (let index = parametersStart; index < html.length; index += 1) {
    if (html[index] === '(') parentheses += 1;
    if (html[index] === ')' && --parentheses === 0) { bodyStart = html.indexOf('{', index); break; }
  }
  assert.notEqual(bodyStart, -1, `corps de ${name} introuvable`);
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
assert.match(ensureSource, /clusterMaxZoom:Number\(atlasSettings\.clusters\.clusterMaxZoom\)/);
assert.match(ensureSource, /clusterRadius:Number\(atlasSettings\.clusters\.clusterRadius\)/);
assert.match(ensureSource, /else source\.setData\(geojson\)/);
assert.match(ensureSource, /ensureAtlasClusterLayers\(\);bindAtlasInteractionsOnce\(\)/);

const layers = extractFunction('ensureAtlasClusterLayers');
assert.match(layers, /filter:\['has','point_count'\]/);
assert.match(layers, /filter:\['!',\['has','point_count'\]\]/);
assert.match(layers, /'text-field':'\{point_count_abbreviated\}'/);
assert.match(layers, /'text-allow-overlap':true/);
assert.match(layers, /'text-ignore-placement':true/);
assert.match(layers, /'text-anchor':'center'/);
assert.match(layers, /\['feature-state','selected'\]/);

const recreateSource = extractFunction('recreateAtlasCardSource');
assert.match(recreateSource, /ensureAtlasSourceAndLayers\(\{forceRecreate:true\}\)/);
const removeSource = extractFunction('removeAtlasClusterLayersAndSource');
assert.ok(removeSource.indexOf('removeLayer') < removeSource.indexOf('removeSource'));

const raiseLayers = extractFunction('raiseAtlasLayers');
const expectedOrder = ['ATLAS_LINKS_LAYER_ID', 'ATLAS_CLUSTERS_LAYER_ID', 'ATLAS_CLUSTER_COUNT_LAYER_ID', 'ATLAS_POINTS_LAYER_ID', 'ATLAS_SELECTION_LAYER_ID'];
expectedOrder.reduce((previous, layer) => {
  const position = raiseLayers.indexOf(layer);
  assert.ok(position > previous, `${layer} doit être placé dans l’ordre Atlas`);
  return position;
}, -1);

const interactions = extractFunction('bindAtlasInteractionsOnce');
assert.match(interactions, /atlasInteractionsBound\|\|!atlasMap/);
assert.match(interactions, /atlasMap\.on\('click',handleAtlasMapClick\)/);
assert.match(interactions, /atlasMap\.on\('mousemove',handleAtlasMapHover\)/);
assert.equal((interactions.match(/atlasMap\.on/g) || []).length, 2);
const click = extractFunction('handleAtlasMapClick');
assert.match(click, /point_count!=null/);
assert.match(click, /zoomAtlasCluster\(cluster\)/);
const expansion = extractFunction('getAtlasClusterExpansionZoom');
assert.equal((expansion.match(/source\.getClusterExpansionZoom/g) || []).length, 1);
assert.match(extractFunction('zoomAtlasCluster'), /Math\.min\(zoom\+1,18\)/);

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
assert.match(html, /atlasMap\.on\('style\.load'.*atlasMap\.once\('idle',restoreAtlasLayersAfterStyleLoad\)/s);
const restoreAfterStyle = extractFunction('restoreAtlasLayersAfterStyleLoad');
assert.match(restoreAfterStyle, /atlasMap\?\.isStyleLoaded\(\)/);
assert.match(restoreAfterStyle, /ensureAtlasSourceAndLayers\(\{forceRecreate:true\}\)/);
assert.match(restoreAfterStyle, /raiseAtlasLayers\(\)/);
assert.doesNotMatch(html, /atlasSourceClusterConfig|sourceConfigChanged|diagnoseAtlasClusters/);

console.log('Atlas clusters: tests réussis');
