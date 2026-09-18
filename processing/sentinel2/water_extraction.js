// I-REIM V0.3 — Sentinel-2 water extraction prototype
// Run in the Google Earth Engine Code Editor.
// Study area is intentionally a small prototype around Prayagraj.

var studyArea = ee.Geometry.Rectangle([81.70, 25.32, 82.05, 25.55]);

var collection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(studyArea)
  .filterDate("2020-01-01", "2026-12-31")
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35));

function maskClouds(image) {
  var qa = image.select("QA60");
  var cloud = qa.bitwiseAnd(1 << 10).eq(0);
  var cirrus = qa.bitwiseAnd(1 << 11).eq(0);
  return image.updateMask(cloud.and(cirrus));
}

function addMNDWI(image) {
  // MNDWI = (Green - SWIR1) / (Green + SWIR1)
  var mndwi = image.normalizedDifference(["B3", "B11"]).rename("MNDWI");
  return image.addBands(mndwi);
}

var processed = collection
  .map(maskClouds)
  .map(addMNDWI);

var water2026 = processed
  .filterDate("2026-01-01", "2026-12-31")
  .median()
  .select("MNDWI")
  .gt(0.15)
  .selfMask()
  .rename("water");

Map.centerObject(studyArea, 11);
Map.addLayer(water2026, {palette: ["#dda15e"]}, "Water — 2026 prototype");

print("Sentinel-2 images after filters:", collection.size());
print("Study area:", studyArea);

// Next step:
// 1. Replace the fixed threshold with a calibrated threshold.
// 2. Add cloud probability / Cloud Score+ masking.
// 3. Generate seasonal composites.
// 4. Export GeoTIFF masks and derive yearly water-frequency envelopes.
