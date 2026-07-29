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

const fitSource = extractFunction('getAtlasGlobeFitZoom');
const getAtlasGlobeFitZoom = new Function(
  'ATLAS_GLOBE_PADDING',
  'ATLAS_GLOBE_TILE_SIZE',
  'atlasSettings',
  `${fitSource}; return getAtlasGlobeFitZoom;`,
)(40, 512, {globe: {initialZoom: 2.65}});

assert.equal(getAtlasGlobeFitZoom(1600, 1200, 0, 2.65), 2.65, 'le zoom choisi reste le plafond sur un grand écran');
assert.ok(getAtlasGlobeFitZoom(800, 500, 0, 2.65) < 1.6, 'le globe est réduit sur un écran bas');
assert.ok(getAtlasGlobeFitZoom(800, 500, 25, 2.65) < getAtlasGlobeFitZoom(800, 500, 0, 2.65), 'le pitch réserve la place nécessaire au décalage vertical');
assert.equal(getAtlasGlobeFitZoom(0, 0, 25, 2.65), 2.65, 'un conteneur pas encore mesuré conserve le zoom demandé');

assert.match(html, /function recenterAtlasGlobe[\s\S]*?zoom:getAtlasGlobeFitZoom/);
assert.match(extractFunction('constrainAtlasGlobeToViewport'), /getZoom\(\)>fitZoom/);
assert.match(html, /atlasMap\?\.resize\(\);constrainAtlasGlobeToViewport\(\)/);

console.log('Atlas responsive: tests réussis');
