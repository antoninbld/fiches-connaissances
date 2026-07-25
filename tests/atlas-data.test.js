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
const data = JSON.parse(fs.readFileSync(new URL('../data.json', `file://${__filename}`), 'utf8'));
const geojsonHelpers = new Function('getCat', 'console', `${extractFunction('normalizeCardId')};${extractFunction('getCardCoordinates')};${extractFunction('buildAtlasGeoJSON')};return {buildAtlasGeoJSON};`)(id => data.categories.find(category => category.id === id), {log() {}, error() {}});
const geojson = geojsonHelpers.buildAtlasGeoJSON(data.fiches);
assert.equal(geojson.features.length, 6, 'les six fiches localisées doivent produire six features');
assert.ok(geojson.features.every(feature => feature.id === feature.properties.id), 'les identifiants GeoJSON doivent être stables');
assert.ok(geojson.features.every(feature => feature.geometry.coordinates[0] >= -180 && feature.geometry.coordinates[0] <= 180 && feature.geometry.coordinates[1] >= -90 && feature.geometry.coordinates[1] <= 90), 'les coordonnées doivent être transmises dans l’ordre longitude/latitude');

console.log('Atlas settings: tests réussis');
