# I-REIM V0.4 — Export guide

## What this script produces

`water_extraction.js` now builds:

- Sentinel-2 SR observations from `COPERNICUS/S2_SR_HARMONIZED`
- Sentinel-2 cloud-probability masks from `COPERNICUS/S2_CLOUD_PROBABILITY`
- MNDWI water classifications
- seasonal water-frequency rasters
- annual maximum seasonal water-frequency rasters
- annual persistent-water masks
- GeoTIFF exports for 2020–2026

## Run it

1. Open the Google Earth Engine Code Editor.
2. Create/open a project with Earth Engine access.
3. Paste `water_extraction.js`.
4. Run the script.
5. Inspect the diagnostic 2026 monsoon layer.
6. Open the Tasks tab.
7. Start the exports you want.
8. Download the resulting GeoTIFF files from Google Drive.
9. Keep the exported rasters together with their year, threshold and processing metadata.

## Before using the output for encroachment analysis

The current AOI is a rectangular Prayagraj prototype. Replace it with the imported CWC/NWDP river polygon or a defined river-reach geometry before producing project evidence.

The MNDWI threshold (0.15) and persistence threshold (0.30) are starting parameters, not universal scientific constants. Calibrate them against representative clear Sentinel-2 scenes covering open water, sandbars, vegetation and built-up areas.

The resulting water-frequency/envelope products describe satellite-observed water occupancy. They do not establish a legal river boundary or prove unauthorized occupation.

## Recommended first run

Start with:

- 2020 annual frequency
- 2023 annual frequency
- 2026 annual frequency
- 2026 monsoon diagnostic

Use those outputs to inspect threshold behavior before generating the complete 2020–2026 evidence set.
