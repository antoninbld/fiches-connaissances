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
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`corps de ${name} incomplet`);
}

const titleMatchesSearch = new Function(
  `${extractFunction('titleMatchesSearch')}; return titleMatchesSearch;`,
)();

const fiches = [
  { title: 'Histoire du Timor oriental', path: 'Géographie › Asie' },
  { title: 'Réseaux électriques', path: 'Histoire › Techniques' },
];

assert.deepEqual(
  fiches.filter(fiche => titleMatchesSearch(fiche, 'timor')).map(fiche => fiche.title),
  ['Histoire du Timor oriental'],
  'une suite de caractères présente dans le titre doit trouver la fiche',
);
assert.deepEqual(
  fiches.filter(fiche => titleMatchesSearch(fiche, 'HISTOIRE')).map(fiche => fiche.title),
  ['Histoire du Timor oriental'],
  'la recherche dans le titre doit ignorer la casse',
);
assert.deepEqual(
  fiches.filter(fiche => titleMatchesSearch(fiche, 'techniques')),
  [],
  'un terme uniquement présent dans le chemin ne doit pas trouver la fiche',
);
assert.match(
  extractFunction('renderSearch'),
  /db\.fiches\.filter\(f=>titleMatchesSearch\(f,state\.search\)\)/,
  'le rendu de la recherche doit utiliser uniquement le critère de titre',
);

console.log('Recherche par titre : tests réussis');
