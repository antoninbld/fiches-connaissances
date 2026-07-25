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

const saved = new Map();
const notifications = [];
const localStorage = {
  setItem(key, value) { saved.set(key, value); },
};
const atlasSettings = {points: {radius: 12}, basemap: {style: 'dark'}};
const saveSource = extractFunction('saveAtlasSettings');
const saveAtlasSettings = new Function(
  'localStorage',
  'atlasSettings',
  'toast',
  'ATLAS_SETTINGS_STORAGE_KEY',
  `${saveSource}; return saveAtlasSettings;`,
)(localStorage, atlasSettings, (message, type) => notifications.push({message, type}), 'atlas-settings-v1');

assert.equal(saveAtlasSettings(), true);
assert.deepEqual(JSON.parse(saved.get('atlas-settings-v1')), atlasSettings);
assert.deepEqual(notifications.at(-1), {message: 'Paramètres de l’Atlas enregistrés.', type: 'success'});

const updateSource = extractFunction('updateAtlasSettings');
assert.equal(updateSource.includes('localStorage.setItem'), false, 'une modification ne doit être enregistrée qu’après application');
assert.match(html, /data-atlas-apply>Appliquer les paramètres<\/button>/);
assert.match(html, /querySelector\('\[data-atlas-apply\]'\)\.onclick=saveAtlasSettings/);

console.log('Atlas settings: tests réussis');
