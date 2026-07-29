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
const escH = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const highlightCortexTitle = new Function('normalizeCortexText', 'escH', `${extractFunction('highlightCortexTitle')}; return highlightCortexTitle;`)(normalizeCortexText, escH);
const getFilteredFactory = new Function('db', 'getCortexSearchText', 'normalizeCortexText', 'cortexCategoryFilters', 'cortexSearchQuery', `${extractFunction('getFilteredCortexFiches')}; return getFilteredCortexFiches;`);

let categories = new Set();
let query = 'service public';
let filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter().map(fiche => fiche.id), ['1']);

query = 'administration';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'un terme présent uniquement dans un intertitre ne doit pas trouver la fiche');

categories = new Set(['cat-a']);
query = 'histoire';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'la recherche doit rester limitée aux catégories cochées');

query = 'energie';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter().map(fiche => fiche.id), ['2'], 'la recherche dans le titre doit ignorer les accents');

query = 'venezuela';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'un terme présent uniquement dans le corps de la fiche ne doit pas la trouver');

query = 'services publics';
filter = getFilteredFactory(db, getCortexSearchText, normalizeCortexText, categories, query);
assert.deepEqual(filter(), [], 'le nom de la catégorie ne doit pas être inclus dans la recherche');

assert.match(html, /id="cortex-search"[^>]+oninput="updateCortexSearch/);
assert.match(html, /placeholder="Rechercher dans les titres…"/);
assert.match(html, /onchange="toggleCortexCategory/);
assert.equal(
  highlightCortexTitle('Le Venezuela, vital pour l’énergie', 'vene energie'),
  'Le <tspan class="cortex-node-label-match">Vene</tspan>zuela, vital pour l’<tspan class="cortex-node-label-match">énergie</tspan>',
  'les termes recherchés doivent être surlignés dans le titre sans tenir compte des accents',
);
assert.equal(
  highlightCortexTitle('Une fiche <test>', 'absent'),
  'Une fiche &lt;test&gt;',
  'un titre sans correspondance doit rester échappé et sans surlignage',
);
console.log('Cortex filters: tests réussis');
