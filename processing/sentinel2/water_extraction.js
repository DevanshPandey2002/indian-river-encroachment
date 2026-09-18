// I-REIM V0.4 — Sentinel-2 historical water envelope prototype
// Run in the Google Earth Engine Code Editor.
//
// Purpose:
// 1. Build cloud-masked Sentinel-2 observations.
// 2. Extract water with MNDWI.
// 3. Build seasonal water-frequency products for 2020–2026.
// 4. Export yearly frequency and occurrence masks for GIS analysis.
//
// IMPORTANT:
// - The rectangle below is only the Prayagraj prototype AOI.
// - Replace studyArea with the imported CWC/NWDP river polygon or a buffered
//   river-reach geometry when that asset is available in your Earth Engine
//   account.
// - A water observation is NOT a legal river boundary or a legal finding of
//   encroachment.

var studyArea = ee.Geometry.Rectangle(
  [81.70, 25.32, 82.05, 25.55],
  null,
  false
);

// When the CWC/NWDP river polygon is imported into Earth Engine, replace
// studyArea with that asset and optionally filter it to the target river.
// Example:
// var cwcRiver = ee.FeatureCollection('users/YOUR_ACCOUNT/CWC_RIVER_POLYGON');
// studyArea = cwcRiver.geometry().intersection(studyArea, ee.ErrorMargin(1));

var START_YEAR = 2020;
var END_YEAR = 2026;

// Cloud probability threshold recommended as a starting point.
// Lower values are stricter; calibrate against the Prayagraj AOI.
var MAX_CLOUD_PROBABILITY = 40;

// MNDWI threshold is intentionally exposed as a parameter.
// Do not treat 0.15 as a universal threshold.
var MNDWI_THRESHOLD = 0.15;

// A pixel is considered persistent water when it is classified as water
// in at least this fraction of valid observations.
var PERSISTENCE_THRESHOLD = 0.30;

var s2Sr = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(studyArea)
  .filterDate(
    ee.Date.fromYMD(START_YEAR, 1, 1),
    ee.Date.fromYMD(END_YEAR + 1, 1, 1)
  )
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80));

var s2Clouds = ee.ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY")
  .filterBounds(studyArea)
  .filterDate(
    ee.Date.fromYMD(START_YEAR, 1, 1),
    ee.Date.fromYMD(END_YEAR + 1, 1, 1)
  );

// Match each Sentinel-2 SR image with its same-index cloud-probability image.
var joined = ee.Join.saveFirst("cloud_mask").apply({
  primary: s2Sr,
  secondary: s2Clouds,
  condition: ee.Filter.equals({
    leftField: "system:index",
    rightField: "system:index"
  })
});

function maskClouds(image) {
  var cloudMask = ee.Image(image.get("cloud_mask"));

  // If no matching cloud-probability image exists, keep the image masked
  // rather than silently treating it as clear.
  var hasCloudMask = image.get("cloud_mask");
  var safeMask = ee.Algorithms.If(
    hasCloudMask,
    cloudMask.select("probability").lt(MAX_CLOUD_PROBABILITY),
    ee.Image(0)
  );

  return image.updateMask(ee.Image(safeMask));
}

function maskEdges(image) {
  // Sentinel-2 documentation recommends using 20 m / 60 m masks to avoid
  // bad data at scene edges.
  return image.updateMask(
    image.select("B8A").mask().updateMask(image.select("B9").mask())
  );
}

function addMNDWI(image) {
  var mndwi = image
    .normalizedDifference(["B3", "B11"])
    .rename("MNDWI");

  return image.addBands(mndwi);
}

function addWater(image) {
  var water = image
    .select("MNDWI")
    .gt(MNDWI_THRESHOLD)
    .rename("water")
    .uint8();

  return image.addBands(water);
}

var processed = ee.ImageCollection(joined)
  .map(maskEdges)
  .map(maskClouds)
  .map(addMNDWI)
  .map(addWater);

print("Raw Sentinel-2 SR images:", s2Sr.size());
print("Joined/processed observations:", processed.size());
print("Study area:", studyArea);

function seasonalComposite(year, seasonName, startMonth, endMonth) {
  var start = ee.Date.fromYMD(year, startMonth, 1);
  var end = ee.Date.fromYMD(year, endMonth, 1).advance(1, "month");

  var season = processed.filterDate(start, end);

  // Water frequency = water observations / valid observations.
  var waterSum = season.select("water").sum();
  var validCount = season.select("MNDWI").count();

  var frequency = waterSum
    .divide(validCount)
    .updateMask(validCount.gt(0))
    .rename("water_frequency");

  var persistentWater = frequency
    .gte(PERSISTENCE_THRESHOLD)
    .selfMask()
    .rename("persistent_water");

  return {
    frequency: frequency,
    persistentWater: persistentWater,
    count: season.size()
  };
}

// Monsoon and post-monsoon are separated because river width can change
// dramatically through the year. This avoids treating one season as the
// complete historical river envelope.
var seasons = [
  {name: "pre_monsoon", start: 3, end: 5},
  {name: "monsoon", start: 6, end: 9},
  {name: "post_monsoon", start: 10, end: 12},
  {name: "winter", start: 1, end: 2}
];

var yearlyFrequency = [];
var yearlyPersistent = [];

for (var year = START_YEAR; year <= END_YEAR; year++) {
  seasons.forEach(function(season) {
    var result = seasonalComposite(
      year,
      season.name,
      season.start,
      season.end
    );

    var label = year + "_" + season.name;

    Map.addLayer(
      result.frequency,
      {
        min: 0,
        max: 1,
        palette: ["#fefae0", "#dda15e", "#bc6c25", "#283618"]
      },
      "Water frequency — " + label,
      false
    );

    Map.addLayer(
      result.persistentWater,
      {palette: ["#283618"]},
      "Persistent water — " + label,
      false
    );

    print(label + " observation count:", result.count);

    yearlyFrequency.push({
      label: label,
      image: result.frequency
    });

    yearlyPersistent.push({
      label: label,
      image: result.persistentWater
    });
  }
}

// Annual historical envelope:
// maximum seasonal water frequency across the four seasons.
// This is an evidence-derived occupancy product, not a legal boundary.
for (var annualYear = START_YEAR; annualYear <= END_YEAR; annualYear++) {
  var annualSeasons = seasons.map(function(season) {
    return seasonalComposite(
      annualYear,
      season.name,
      season.start,
      season.end
    ).frequency;
  });

  var annualEnvelope = ee.ImageCollection(annualSeasons)
    .max()
    .rename("annual_water_frequency");

  var annualPersistent = annualEnvelope
    .gte(PERSISTENCE_THRESHOLD)
    .selfMask()
    .rename("annual_persistent_water");

  Map.addLayer(
    annualEnvelope,
    {
      min: 0,
      max: 1,
      palette: ["#fefae0", "#dda15e", "#bc6c25", "#283618"]
    },
    "Annual water frequency — " + annualYear,
    false
  );

  Map.addLayer(
    annualPersistent,
    {palette: ["#283618"]},
    "Annual persistent water — " + annualYear,
    false
  );

  // Export one annual raster per year. Start with 2020–2026; run only the
  // years/products you need to control Earth Engine task volume.
  Export.image.toDrive({
    image: annualEnvelope.clip(studyArea).toFloat(),
    description: "IREIM_" + annualYear + "_annual_water_frequency",
    folder: "IREIM_Ganga_Prayagraj",
    fileNamePrefix: "IREIM_" + annualYear + "_annual_water_frequency",
    region: studyArea,
    scale: 10,
    maxPixels: 1e10,
    fileFormat: "GeoTIFF"
  });

  Export.image.toDrive({
    image: annualPersistent.clip(studyArea).toByte(),
    description: "IREIM_" + annualYear + "_persistent_water",
    folder: "IREIM_Ganga_Prayagraj",
    fileNamePrefix: "IREIM_" + annualYear + "_persistent_water",
    region: studyArea,
    scale: 10,
    maxPixels: 1e10,
    fileFormat: "GeoTIFF"
  });
}

Map.centerObject(studyArea, 11);

// Simple current-year diagnostic.
var currentYear = END_YEAR;
var current = seasonalComposite(currentYear, "monsoon", 6, 9);

Map.addLayer(
  current.frequency,
  {
    min: 0,
    max: 1,
    palette: ["#fefae0", "#dda15e", "#bc6c25", "#283618"]
  },
  "DIAGNOSTIC — " + currentYear + " monsoon water frequency",
  true
);

print("I-REIM V0.4 parameters", {
  startYear: START_YEAR,
  endYear: END_YEAR,
  maxCloudProbability: MAX_CLOUD_PROBABILITY,
  mndwiThreshold: MNDWI_THRESHOLD,
  persistenceThreshold: PERSISTENCE_THRESHOLD
});
