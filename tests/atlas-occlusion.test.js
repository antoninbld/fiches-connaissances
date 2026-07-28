const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `fonction ${name} introuvable`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
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

let center = {lng: 120, lat: 20};
const atlasMap = {getCenter: () => center};
const source = `const ATLAS_HORIZON_MARGIN=.01;let atlasFullGeoJSON={type:'FeatureCollection',features:[]};${extractFunction('emptyFeatureCollection')}\n${extractFunction('isCoordinateOnVisibleHemisphere')}\n${extractFunction('buildVisibleAtlasGeoJSON')};return {isCoordinateOnVisibleHemisphere,buildVisibleAtlasGeoJSON};`;
const helpers = new Function('atlasMap', source)(atlasMap);
const point = (id, longitude, latitude, properties = {}) => ({type:'Feature', geometry:{type:'Point', coordinates:[longitude, latitude]}, properties:{id, ...properties}});
const fixtures = {type:'FeatureCollection', features:[
  point('front-1', 120, 20), point('front-2', 130, 10),
  point('back-1', -60, 20), point('back-2', -50, -10),
]};

assert.deepEqual(helpers.buildVisibleAtlasGeoJSON(fixtures).features.map(feature => feature.properties.id), ['front-1', 'front-2']);
center = {lng: -60, lat: -20};
assert.deepEqual(helpers.buildVisibleAtlasGeoJSON(fixtures).features.map(feature => feature.properties.id), ['back-1', 'back-2']);
assert.equal(helpers.isCoordinateOnVisibleHemisphere(90, 0, 0, 0), false, 'un point sur l’horizon doit respecter la marge');

center = {lng: 120, lat: 20};
const clustered = {type:'FeatureCollection', features:[point('visible-cluster', 122, 20, {cluster:true}), point('hidden-cluster', -58, 20, {cluster:true})]};
assert.deepEqual(helpers.buildVisibleAtlasGeoJSON(clustered).features.map(feature => feature.properties.id), ['visible-cluster']);
const selection = {type:'FeatureCollection', features:[point('selected-hidden', -60, 20, {role:'selected'}), point('linked-visible', 130, 10, {role:'linked'})]};
assert.deepEqual(helpers.buildVisibleAtlasGeoJSON(selection).features.map(feature => feature.properties.id), ['linked-visible']);

const line = {type:'FeatureCollection', features:[{type:'Feature', properties:{id:'relation'}, geometry:{type:'LineString', coordinates:[[120,20],[130,20],[-60,20],[-50,20]]}}]};
const visibleLines = helpers.buildVisibleAtlasGeoJSON(line).features;
assert.equal(visibleLines.length, 1);
assert.ok(visibleLines[0].geometry.coordinates.every(([lon, lat]) => helpers.isCoordinateOnVisibleHemisphere(lon, lat, center.lng, center.lat)));

assert.match(html, /#atlas-map \.maplibregl-canvas,#atlas-map \.maplibregl-canvas-container\{opacity:1;mix-blend-mode:normal;filter:none\}/);
assert.match(extractFunction('syncAtlasMarkerFallback'), /buildVisibleAtlasGeoJSON\(atlasFullGeoJSON\)/);
assert.match(html, /\.atlas-marker-fallback\{/);
assert.match(extractFunction('refreshVisibleAtlasFeatures'), /ATLAS_SOURCE_ID.*ATLAS_LINKS_SOURCE_ID.*ATLAS_SELECTION_SOURCE_ID/s);
assert.match(extractFunction('scheduleAtlasVisibilityRefresh'), /requestAnimationFrame/);
assert.match(html, /projection:'globe'/);

console.log('Atlas occlusion: tests réussis');
