# Sentinel-2 water extraction — V0.3

## Study area
Initial prototype: Ganga around Prayagraj, Uttar Pradesh.

## Earth Engine source
Use the harmonized Sentinel-2 Level-2A surface-reflectance collection:

COPERNICUS/S2_SR_HARMONIZED

It provides 10 m visible/NIR bands, 20 m red-edge/SWIR bands, and a 5-day revisit interval. The harmonized collection is preferred for consistent time-series analysis.

## Planned method
1. Define the study-area geometry.
2. Filter Sentinel-2 SR imagery by date and geometry.
3. Apply cloud/cloud-shadow quality masking.
4. Calculate a water index such as MNDWI.
5. Threshold/classify water.
6. Remove small isolated artifacts.
7. Export water masks as GeoTIFF/vector products.
8. Aggregate observations into seasonal/yearly water envelopes.

## Evidence rule
A water mask is an observation, not a legal boundary. Historical river occupancy will be represented as an evidence-derived spatial envelope with acquisition dates and processing metadata.

## Next implementation
Build the Earth Engine script and export a first 2020–2026 seasonal water-envelope dataset for the Prayagraj prototype.
