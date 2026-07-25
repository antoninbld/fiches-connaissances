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

const names = ['hasValidCoordinatePair', 'getKnowledgeGraphRelations', 'getCardRelations', 'getLocalizedRelations', 'greatCircleCoordinates'];
const source = names.map(extractFunction).join('\n');
const loadHelpers = new Function('db', `${source}; return {${names.join(',')}};`);

const db = {fiches: [
  {id: 'paris', links: ['nyc', 'missing', 'paris', 'nyc'], location: {latitude: 48.8566, longitude: 2.3522}},
  {id: 'nyc', links: ['paris'], location: {latitude: 40.7128, longitude: -74.006}},
  {id: 'tokyo', links: ['paris'], location: {latitude: 35.6762, longitude: 139.6503}},
  {id: 'unknown-place', links: ['paris']},
  {id: 'invalid-place', links: ['paris'], location: {latitude: 95, longitude: 4}},
]};
const helpers = loadHelpers(db);

assert.deepEqual(helpers.getKnowledgeGraphRelations().map(({sourceId, targetId}) => [sourceId, targetId]), [
  ['paris', 'nyc'],
  ['tokyo', 'paris'],
  ['unknown-place', 'paris'],
  ['invalid-place', 'paris'],
]);
assert.deepEqual(helpers.getCardRelations('paris').map(({linkedId}) => linkedId), ['nyc', 'tokyo', 'unknown-place', 'invalid-place']);
assert.deepEqual(helpers.getLocalizedRelations('paris').map(({card}) => card.id), ['nyc', 'tokyo']);

assert.equal(helpers.hasValidCoordinatePair(-90, 180), true);
assert.equal(helpers.hasValidCoordinatePair(91, 0), false);
assert.equal(helpers.hasValidCoordinatePair('', 0), false);

const arc = helpers.greatCircleCoordinates([2.3522, 48.8566], [-74.006, 40.7128]);
assert.ok(arc.length > 2, 'un arc doit contenir des points intermédiaires');
assert.deepEqual(arc[0], [2.3522, 48.8566]);
assert.deepEqual(arc.at(-1), [-74.006, 40.7128]);

const antimeridian = helpers.greatCircleCoordinates([170, 20], [-170, 25]);
assert.ok(antimeridian.every((point, index) => index === 0 || Math.abs(point[0] - antimeridian[index - 1][0]) <= 180), 'le trajet doit rester continu à l’antiméridien');
assert.ok(Math.abs(antimeridian.at(-1)[0] - antimeridian[0][0]) < 40, 'le trajet doit emprunter le chemin court');

const antipodal = helpers.greatCircleCoordinates([0, 0], [180, 0]);
assert.ok(antipodal.flat().every(Number.isFinite), 'le cas antipodal doit rester numérique');

console.log('Atlas relations: tests réussis');
