# I-REIM V0.6 — Corridor engine

V0.6 creates a reproducible spatial screening corridor around the river/floodplain reference geometry and overlays persistent historical Sentinel-2 water observations.

## Products

- Reference river/floodplain geometry
- Inner analysis corridor
- Outer screening corridor
- Historical water-frequency raster
- Persistent historical-water mask inside the inner corridor
- GeoTIFF exports for the evidence rasters
- GeoJSON export of the corridor geometries

## Important interpretation rule

V0.6 creates an **analysis/evidence zone**, not a legal boundary and not a confirmed encroachment layer.

A future candidate engine will intersect this evidence with independently derived building, road, industrial and land-use layers. Each intersection will remain a potential candidate until independently verified.

## Parameters

- Inner corridor: 100 m
- Outer corridor: 1,000 m
- Sentinel-2 cloud probability: 40%
- MNDWI threshold: 0.15
- Persistent-water threshold: 30%

These are prototype parameters and must be calibrated before nationwide production.

## Data source rationale

The CWC/NWDP River Polygon dataset provides river and floodplain boundaries. Sentinel-2 provides time-series observations. The two layers therefore have different provenance and should remain separately identifiable in the evidence chain.

## Next version

V0.7 should add building/road screening and produce structured candidate records with geometry, estimated area, evidence dates and confidence components.
