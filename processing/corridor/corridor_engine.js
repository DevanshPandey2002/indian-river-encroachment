// I-REIM V0.6 — River corridor engine prototype
//
// Purpose:
// Build a reproducible analysis corridor around a river/floodplain reference
// and intersect it with the historical Sentinel-2 water envelope.
//
// This script deliberately does NOT classify anything as illegal.
// Its output is an evidence-analysis zone for later candidate generation.
//
// STEP 1: import the CWC/NWDP River Polygon into Earth Engine.
// STEP 2: replace the placeholder asset ID below.
// STEP 3: filter the FeatureCollection to the target river/reach if required.
// STEP 4: run the script and inspect the corridor + historical-water overlap.
//
// Until the CWC asset is available, the fallback geometry is the Prayagraj
// prototype rectangle used by the Sentinel-2 processing script.

var USE_CWC_ASSET = false;

var PROTOTYPE_AOI = ee.Geometry.Rectangle(
  [81.70, 25.32, 82.05, 25.55],
  null,
  false
);

// Replace with your imported Earth Engine asset ID.
// Example: users/YOUR_ACCOUNT/CWC_RIVER_POLYGON
var CWC_ASSET_ID = "users/YOUR_ACCOUNT/CWC_RIVER_POLYGON";

// Buffer parameters are analysis parameters, not legal boundaries.
// They should eventually be calibrated by river reach and geomorphic setting.
var OUTER_BUFFER_METERS = 1000;
var INNER_BUFFER_METERS = 100;

// Load the CWC reference geometry when enabled.
var cwc = ee.FeatureCollection(CWC_ASSET_ID);

var referenceGeometry = ee.Geometry(
  ee.Algorithms.If(
    USE_CWC_ASSET,
    cwc.geometry(),
    PROTOTYPE_AOI
  )
);

// Analysis corridor:
// - inner corridor: immediate river-adjacent zone
// - outer corridor: broader screening zone
// - screening ring: outer corridor excluding the inner zone
var innerCorridor = referenceGeometry
  .buffer(INNER_BUFFER_METERS)
  .dissolve();

var outerCorridor = referenceGeometry
  .buffer(OUTER_BUFFER_METERS)
  .dissolve();

var screeningRing = outerCorridor
  .difference(innerCorridor, ee.ErrorMargin(1));

Map.centerObject(referenceGeometry, 11);

Map.addLayer(
  referenceGeometry,
  {color: "#283618"},
  "Reference river / floodplain"
);

Map.addLayer(
  innerCorridor,
  {color: "#bc6c25"},
  "Inner analysis corridor — " + INNER_BUFFER_METERS + " m"
);

Map.addLayer(
  screeningRing,
  {color: "#dda15e"},
  "Outer screening corridor — " + OUTER_BUFFER_METERS + " m",
  false
);

// ---------------------------------------------------------------------------
// Historical water layer
// ---------------------------------------------------------------------------

var START_YEAR = 2020;
var END_YEAR = 2026;
var MAX_CLOUD_PROBABILITY = 40;
var MNDWI_THRESHOLD = 0.15;
var PERSISTENCE_THRESHOLD = 0.30;

var s2Sr = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(referenceGeometry)
  .filterDate(
    ee.Date.fromYMD(START_YEAR, 1, 1),
    ee.Date.fromYMD(END_YEAR + 1, 1, 1)
  )
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80));

var s2Clouds = ee.ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY")
  .filterBounds(referenceGeometry)
  .filterDate(
    ee.Date.fromYMD(START_YEAR, 1, 1),
    ee.Date.fromYMD(END_YEAR + 1, 1, 1)
  );

var joined = ee.Join.saveFirst("cloud_mask").apply({
  primary: s2Sr,
  secondary: s2Clouds,
  condition: ee.Filter.equals({
    leftField: "system:index",
    rightField: "system:index"
  })
});

function maskEdges(image) {
  return image.updateMask(
    image.select("B8A").mask().updateMask(image.select("B9").mask())
  );
}

function maskClouds(image) {
  var cloudMask = ee.Image(image.get("cloud_mask"));
  return image.updateMask(
    cloudMask.select("probability").lt(MAX_CLOUD_PROBABILITY)
  );
}

function classifyWater(image) {
  var mndwi = image
    .normalizedDifference(["B3", "B11"])
    .rename("MNDWI");

  var water = mndwi
    .gt(MNDWI_THRESHOLD)
    .rename("water")
    .uint8();

  return image.addBands([mndwi, water]);
}

var processed = ee.ImageCollection(joined)
  .map(maskEdges)
  .map(maskClouds)
  .map(classifyWater);

var waterFrequency = processed
  .select("water")
  .sum()
  .divide(processed.select("MNDWI").count())
  .updateMask(processed.select("MNDWI").count().gt(0))
  .rename("water_frequency");

var persistentWater = waterFrequency
  .gte(PERSISTENCE_THRESHOLD)
  .selfMask()
  .rename("persistent_water");

// Clip the evidence product to the outer corridor.
var corridorWater = persistentWater.clip(outerCorridor);

Map.addLayer(
  waterFrequency.clip(outerCorridor),
  {
    min: 0,
    max: 1,
    palette: ["#fefae0", "#dda15e", "#bc6c25", "#283618"]
  },
  "Historical water frequency — corridor",
  true
);

Map.addLayer(
  corridorWater,
  {palette: ["#283618"]},
  "Persistent historical water — corridor",
  true
);

// ---------------------------------------------------------------------------
// Candidate screening mask
// ---------------------------------------------------------------------------
//
// This is NOT an encroachment classification.
//
// It identifies pixels where persistent historical water overlaps the
// analysis corridor. Future versions will intersect this with building,
// road, industrial and agricultural layers.

var historicalWaterInsideCorridor = corridorWater
  .clip(innerCorridor)
  .selfMask();

Map.addLayer(
  historicalWaterInsideCorridor,
  {palette: ["#bc6c25"]},
  "Historical water inside inner corridor",
  true
);

print("I-REIM V0.6 reference geometry:", referenceGeometry);
print("Sentinel-2 processed observations:", processed.size());
print("Inner corridor (m):", INNER_BUFFER_METERS);
print("Outer corridor (m):", OUTER_BUFFER_METERS);
print("MNDWI threshold:", MNDWI_THRESHOLD);
print("Persistence threshold:", PERSISTENCE_THRESHOLD);

// ---------------------------------------------------------------------------
// Export the corridor geometry and evidence raster.
// ---------------------------------------------------------------------------

Export.image.toDrive({
  image: waterFrequency.clip(outerCorridor).toFloat(),
  description: "IREIM_V06_corridor_water_frequency",
  folder: "IREIM_Ganga_Prayagraj",
  fileNamePrefix: "IREIM_V06_corridor_water_frequency",
  region: outerCorridor,
  scale: 10,
  maxPixels: 1e10,
  fileFormat: "GeoTIFF"
});

Export.image.toDrive({
  image: historicalWaterInsideCorridor.clip(outerCorridor).toByte(),
  description: "IREIM_V06_historical_water_inner_corridor",
  folder: "IREIM_Ganga_Prayagraj",
  fileNamePrefix: "IREIM_V06_historical_water_inner_corridor",
  region: outerCorridor,
  scale: 10,
  maxPixels: 1e10,
  fileFormat: "GeoTIFF"
});

Export.table.toDrive({
  collection: ee.FeatureCollection([
    ee.Feature(innerCorridor, {
      product: "I-REIM V0.6 inner analysis corridor",
      buffer_m: INNER_BUFFER_METERS,
      source: USE_CWC_ASSET ? CWC_ASSET_ID : "Prayagraj prototype AOI"
    }),
    ee.Feature(outerCorridor, {
      product: "I-REIM V0.6 outer screening corridor",
      buffer_m: OUTER_BUFFER_METERS,
      source: USE_CWC_ASSET ? CWC_ASSET_ID : "Prayagraj prototype AOI"
    })
  ]),
  description: "IREIM_V06_corridor_geometry",
  folder: "IREIM_Ganga_Prayagraj",
  fileNamePrefix: "IREIM_V06_corridor_geometry",
  fileFormat: "GeoJSON"
});
