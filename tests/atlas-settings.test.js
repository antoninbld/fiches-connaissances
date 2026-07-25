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

const initialization = extractFunction('restoreAtlasRuntime');
const expectedOrder = [
  'setupAtlasGlobe(settings)',
  'ensureNoTerrain()',
  'ensureAtlasSourceAndLayers(settings,geojson)',
  'ensureAtlasLinksSourceAndLayer(settings)',
  'ensureAtlasSelectionSourceAndLayer(settings)',
  'applyAtlasSettingsToMap(settings)',
  'verifyAtlasRuntime(geojson,reason)',
];
let previous = -1;
for (const call of expectedOrder) {
  const position = initialization.indexOf(call);
  assert.ok(position > previous, `${call} doit suivre l’étape précédente`);
  previous = position;
}
assert.match(html, /style:getAtlasStyleURL\(atlasSettings\.basemap\.style\)/, 'le fond sauvegardé doit être le style initial');
assert.match(html, /projection:\{type:['"]globe['"]\}/, 'le constructeur doit recevoir une ProjectionSpecification globe MapLibre');
assert.doesNotMatch(html, /projection:['"]globe['"]/, 'la syntaxe chaîne propre à Mapbox ne doit pas être utilisée avec MapLibre');
assert.match(html, /clusterMaxZoom:clusters\.clusterMaxZoom,clusterRadius:clusters\.clusterRadius/, 'la source doit employer les paramètres de cluster courants');
assert.doesNotMatch(extractFunction('ensureAtlasSourceAndLayers'), /'#c9a84c'|\b11,7\b/, 'les couches ne doivent plus être créées avec les styles par défaut codés en dur');
assert.match(extractFunction('queueAtlasRestore'), /restoreAtlasPromise=restoreAtlasPromise\.catch\(\(\)=>{}\)\.then/, 'les restaurations concurrentes doivent être sérialisées');
assert.match(extractFunction('syncAtlasRotation'), /if\(atlasRotationFrame\)return/, 'une seconde boucle de rotation ne doit pas être créée');
const globeSetup = extractFunction('setupAtlasGlobe');
assert.match(globeSetup, /getProjection\?\.\(\)\.type!==['"]globe['"]/, 'la projection globe ne doit être réappliquée que si nécessaire');
assert.doesNotMatch(globeSetup, /try\s*{\s*atlasMap\.setProjection/, 'setProjection ne doit pas relancer style.load à chaque restauration');
assert.match(globeSetup, /setProjection\(\{type:['"]globe['"]\}\);\s*}\s*atlasMap\.setRenderWorldCopies/, 'les couches doivent être restaurées pendant le même style.load, car setProjection ne garantit pas un nouvel événement');
assert.match(initialization, /if\(!setupAtlasGlobe\(settings\)\)return;[\s\S]*ensureAtlasSourceAndLayers/, 'les couches Atlas doivent être ajoutées après l’activation synchrone du globe');
assert.match(html, /GLOBE_ZOOM=1\.35,GLOBE_PITCH=0/, 'la caméra initiale doit montrer clairement le contour du globe');
assert.equal((html.match(/new maplibregl\.Map/g) || []).length, 1, 'une seule instance MapLibre doit être créée');
assert.match(html, /on\('style\.load',[\s\S]{0,180}queueAtlasRestore/, 'style.load doit passer par le pipeline central');
assert.equal((html.match(/\.setStyle\(/g) || []).length, 1, 'le changement de fond doit être le seul appel setStyle');
assert.match(extractFunction('setBasemap'), /pendingStyleRestoreReason=[\s\S]*setStyle/, 'le fond doit attendre style.load pour être restauré');
assert.match(extractFunction('verifyAtlasRuntime'), /projection\?\.type!==['"]globe['"]/, 'la projection finale réelle doit être vérifiée');

const data = JSON.parse(fs.readFileSync(new URL('../data.json', `file://${__filename}`), 'utf8'));
const geojsonHelpers = new Function('getCat', 'console', `${extractFunction('normalizeCardId')};${extractFunction('getCardCoordinates')};${extractFunction('buildAtlasGeoJSON')};return {buildAtlasGeoJSON};`)(id => data.categories.find(category => category.id === id), {log() {}, error() {}});
const geojson = geojsonHelpers.buildAtlasGeoJSON(data.fiches);
assert.equal(geojson.features.length, 6, 'les six fiches localisées doivent produire six features');
assert.ok(geojson.features.every(feature => feature.id === feature.properties.id), 'les identifiants GeoJSON doivent être stables');
assert.ok(geojson.features.every(feature => feature.geometry.coordinates[0] >= -180 && feature.geometry.coordinates[0] <= 180 && feature.geometry.coordinates[1] >= -90 && feature.geometry.coordinates[1] <= 90), 'les coordonnées doivent être transmises dans l’ordre longitude/latitude');

console.log('Atlas settings: tests réussis');
