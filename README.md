# I-REIM — India River Encroachment Intelligence

Interactive GIS intelligence platform for identifying **potential river-corridor encroachment** from satellite and GIS evidence.

## Project status

V0.2 — Ganga / Uttar Pradesh prototype.

## Principle

Satellite imagery can identify observed structures and spatial overlap with a river corridor; it does not by itself establish legal encroachment. Findings are therefore treated as **potential encroachment candidates** pending verification.

## Planned stack

- Next.js / React
- Leaflet / web GIS
- Python / remote-sensing processing
- Sentinel-1 / Sentinel-2 / Landsat
- ISRO / NRSC / CWC / NWDP datasets
- PostGIS for scalable spatial storage

## Development roadmap

1. Official river and floodplain geometry
2. Sentinel-2 water extraction
3. Historical river envelope
4. Built-up / land-use detection
5. Candidate generation
6. Evidence timeline and inspection workflow
7. India-wide basin scaling
