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

const db = {
  categories: [{id: 'cat-a', name: 'Services publics'}, {id: 'cat-b', name: 'Histoire'}],
  fiches: [
    {id: '1', catId: 'cat-a', title: 'Le service public', html: '<h2>Administration publique</h2>'},
    {id: '2', catId: 'cat-a', title: 'Énergie', html: '<h3>Réseau électrique</h3><p>Venezuela</p>'},
    {id: '3', catId: 'cat-b', title: 'Révolution', html: '<p>Histoire de France</p>'},
  ],
};
const normalizeCortexText = new Function(`${extractFunction('normalizeCortexText')}; return normalizeCortexText;`)();
const getCortexSearchText = new Function('normalizeCortexText', `${extractFunction('getCortexSearchText')}; return getCortexSearchText;`)(normalizeCortexText);
const getFilteredFactory = new Function('db', 'getCortexSearchText', 'normalizeCortexText', 'cortexCategoryFilters', 'cortexSearchQuery', `${extractFunction('getFilteredCortexFiches')}; return getFilteredCortexFiches;`);

let categories = new Set();
let query = 'administration';
let filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter().map(fiche => fiche.id), ['1']);

categories = new Set(['cat-a']);
query = 'histoire';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'la recherche doit rester limitée aux catégories cochées');

query = 'reseau electrique';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter().map(fiche => fiche.id), ['2'], 'la recherche doit ignorer les accents et accepter plusieurs termes');

query = 'venezuela';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'un terme présent uniquement dans le corps de la fiche ne doit pas la trouver');

query = 'services publics';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'le nom de la catégorie ne doit pas être inclus dans la recherche');

assert.match(html, /id="cortex-search"[^>]+oninput="updateCortexSearch/);
assert.match(html, /placeholder="Rechercher dans les titres…"/);
assert.match(html, /onchange="toggleCortexCategory/);
console.log('Cortex filters: tests réussis');
