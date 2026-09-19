import { NextResponse } from "next/server";

export const revalidate = 86400;

// V0.8 prototype viewport: Prayagraj / Ganga study area.
// NWDP publishes nationwide GeoJSON; returning only intersecting features keeps
// Leaflet responsive while preserving the official source/provenance.
const STUDY_BBOX = [81.65, 25.30, 82.05, 25.58];

const SOURCES = {
  "river-network": "https://nwdp.nwic.gov.in/dataset/3209962f-d0ff-45b8-910a-209bf69a0ccf/resource/6e552705-842d-40a4-92b2-8506bb66df2a/download/river_network.geojson",
  canal: "https://nwdp.nwic.gov.in/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/89bab129-cb30-41ec-8531-e7f445c170f3/download/canal_network.geojson",
  dam: "https://nwdp.nwic.gov.in/dataset/814111c2-16a3-4f1b-bcc0-42274fc3fcbe/resource/0d3a7101-81b4-450e-a3dd-c2bfa0b589e3/download/dam.geojson",
};

function coordinateBounds(coords, bounds = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (!Array.isArray(coords)) return bounds;
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds[0] = Math.min(bounds[0], coords[0]);
    bounds[1] = Math.min(bounds[1], coords[1]);
    bounds[2] = Math.max(bounds[2], coords[0]);
    bounds[3] = Math.max(bounds[3], coords[1]);
    return bounds;
  }
  for (const child of coords) coordinateBounds(child, bounds);
  return bounds;
}

function intersectsStudyArea(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  const b = coordinateBounds(geometry.coordinates);
  return Number.isFinite(b[0]) &&
    b[2] >= STUDY_BBOX[0] &&
    b[0] <= STUDY_BBOX[2] &&
    b[3] >= STUDY_BBOX[1] &&
    b[1] <= STUDY_BBOX[3];
}

export async function GET(_request, { params }) {
  const { layer } = await params;
  const source = SOURCES[layer];

  if (!source) {
    return NextResponse.json({ error: "Layer is not configured." }, { status: 400 });
  }

  try {
    const response = await fetch(source, {
      headers: { Accept: "application/geo+json,application/json" },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `NWDP returned HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const features = Array.isArray(data.features)
      ? data.features.filter(intersectsStudyArea)
      : [];

    return NextResponse.json(
      { type: "FeatureCollection", features },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to retrieve the official NWDP GeoJSON source.", detail: String(error) },
      { status: 502 }
    );
  }
}
