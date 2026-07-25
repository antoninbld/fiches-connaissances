const {test, expect} = require('@playwright/test');

async function waitForAtlasIdle(page) {
  await page.waitForFunction(() => typeof atlasMap !== 'undefined' && atlasMap && atlasMap.isStyleLoaded());
  await page.evaluate(() => new Promise(resolve => atlasMap.once('idle', resolve)));
}

async function expectRenderedAtlas(page) {
  const runtime = await page.evaluate(() => ({
    projection: atlasMap.getProjection().type,
    hasSource: Boolean(atlasMap.getSource(ATLAS_CARDS_SOURCE_ID)),
    layers: [ATLAS_POINTS_LAYER_ID, ATLAS_CLUSTERS_LAYER_ID, ATLAS_CLUSTER_COUNT_LAYER_ID]
      .map(id => Boolean(atlasMap.getLayer(id))),
    featureCount: buildAtlasGeoJSON(db.fiches).features.length,
    renderedCount: atlasMap.queryRenderedFeatures({
      layers: [ATLAS_POINTS_LAYER_ID, ATLAS_CLUSTERS_LAYER_ID]
    }).length,
    camera: {center: atlasMap.getCenter().toArray(), zoom: atlasMap.getZoom(), pitch: atlasMap.getPitch()}
  }));
  expect(runtime.projection).toBe('globe');
  expect(runtime.hasSource).toBe(true);
  expect(runtime.layers).toEqual([true, true, true]);
  expect(runtime.featureCount).toBe(6);
  expect(runtime.renderedCount).toBeGreaterThan(0);
  return runtime;
}

test('rend le globe et les fiches après chargement, changement de fond et rafraîchissement', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('atlas-view-v2', JSON.stringify({center: [120, -55], zoom: 8, pitch: 55, bearing: 90}));
    localStorage.setItem('atlas-settings-v2', JSON.stringify({points: {color: '#c9a84c'}, basemap: {style: 'streets'}}));
    localStorage.setItem('atlas-view-v3', JSON.stringify({version: 3, center: [90, 0], zoom: 1.35, pitch: 0}));
  });
  await page.goto('/');
  await page.waitForFunction(() => typeof db !== 'undefined' && Array.isArray(db.fiches));
  await page.evaluate(() => {
    // Explicit browser fixture: at least two cards are localized before Atlas opens.
    db.fiches[0].location = {name: 'Paris', latitude: 48.8566, longitude: 2.3522};
    db.fiches[1].location = {name: 'New York', latitude: 40.7128, longitude: -74.006};
    goAtlas();
  });
  await waitForAtlasIdle(page);
  const initial = await expectRenderedAtlas(page);
  expect(initial.camera.center[0]).toBeCloseTo(0, 1);
  expect(initial.camera.center[1]).toBeCloseTo(20, 1);
  expect(initial.camera.zoom).toBeGreaterThanOrEqual(0.48);
  expect(initial.camera.zoom).toBeLessThanOrEqual(0.82);
  expect(initial.camera.pitch).toBe(25);
  expect(await page.evaluate(() => getAtlasSettings().points.color)).toBe('#ff2d2d');
  expect(await page.evaluate(() => getAtlasStyleURL('streets'))).not.toContain('liberty');

  // Atmosphere and relation failures are isolated from the card source/layers.
  await page.evaluate(async () => {
    const originalFog = applyAtlasFog;
    applyAtlasFog = () => { throw new Error('atmosphere-test'); };
    await queueAtlasRestore({reason: 'atmosphere-failure-test'});
    applyAtlasFog = originalFog;
    const originalRelations = ensureAtlasLinksSourceAndLayer;
    ensureAtlasLinksSourceAndLayer = () => { throw new Error('relations-test'); };
    await queueAtlasRestore({reason: 'relations-failure-test'});
    ensureAtlasLinksSourceAndLayer = originalRelations;
  });
  await waitForAtlasIdle(page);
  await expectRenderedAtlas(page);

  await page.evaluate(() => setBasemap('light'));
  await waitForAtlasIdle(page);
  await expectRenderedAtlas(page);

  await page.reload();
  await page.waitForFunction(() => typeof db !== 'undefined' && Array.isArray(db.fiches));
  await page.evaluate(() => goAtlas());
  await waitForAtlasIdle(page);
  const refreshed = await expectRenderedAtlas(page);
  expect(refreshed.camera.pitch).toBe(25);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-view-v3')).projection)).toBe('globe');

  await page.locator('#atlas-map').screenshot({path: 'test-results/atlas-globe.png'});
});
