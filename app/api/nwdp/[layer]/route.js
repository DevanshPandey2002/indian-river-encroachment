import { NextResponse } from "next/server";
import JSZip from "jszip";

export const revalidate = 86400;

const STUDY_BBOX = [81.65, 25.30, 82.05, 25.58];

const SOURCES = {
  "river-network": "https://nwdp.nwic.gov.in/dataset/3209962f-d0ff-45b8-910a-209bf69a0ccf/resource/6e552705-842d-40a4-92b2-8506bb66df2a/download/river_network.geojson",
  canal: "https://nwdp.nwic.gov.in/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/89bab129-cb30-41ec-8531-e7f445c170f3/download/canal_network.geojson",
  dam: "https://nwdp.nwic.gov.in/dataset/814111c2-16a3-4f1b-bcc0-42274fc3fcbe/resource/0d3a7101-81b4-450e-a3dd-c2bfa0b589e3/download/dam.geojson",
  reservoir: "https://nwdp.nwic.gov.in/dataset/f098645e-950f-40fe-b100-fd2cc95e789d/resource/1790dd33-0e07-49d0-bc52-ca222d30543e/download/reservoir.geojson",
  "water-resource-project": "https://nwdp.nwic.gov.in/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/7b1e0abf-ca24-46d2-b0dc-7234021e414d/download/command_area.geojson",
  waterbodies: "https://nwdp.nwic.gov.in/dataset/811f6a62-61c2-4d79-b90b-deeee4151f6d/resource/7451d595-37bf-4238-90c0-2edc5afce7b3/download/wb_up_geojson.zip",
  basin: "https://nwdp.nwic.gov.in/dataset/ec216ae7-1beb-4365-8473-d60a7fc4a98c/resource/a6838033-06cd-4e32-bc46-e47ce5135a06/download/basin_cwc_geojson.zip",
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

function findGeoJsonEntry(zip) {
  const names = Object.keys(zip.files);
  return names.find((name) => name.toLowerCase().endsWith(".geojson"))
    || names.find((name) => name.toLowerCase().endsWith(".json"));
}

async function readGeoJson(response, source) {
  const contentType = response.headers.get("content-type") || "";
  if (source.endsWith(".zip") || contentType.includes("zip")) {
    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const entry = findGeoJsonEntry(zip);
    if (!entry) throw new Error("No GeoJSON file found inside NWDP ZIP.");
    return JSON.parse(await zip.files[entry].async("text"));
  }
  return response.json();
}

export async function GET(_request, { params }) {
  const { layer } = await params;
  const source = SOURCES[layer];

  if (!source) {
    return NextResponse.json({ error: "Layer is not configured." }, { status: 400 });
  }

  try {
    const response = await fetch(source, {
      headers: { Accept: "application/geo+json,application/json,application/zip" },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `NWDP returned HTTP ${response.status}` }, { status: 502 });
    }

    const data = await readGeoJson(response, source);
    const features = Array.isArray(data.features)
      ? data.features.filter(intersectsStudyArea)
      : [];

    return NextResponse.json(
      { type: "FeatureCollection", features },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to retrieve the official NWDP GeoJSON source.", detail: String(error) },
      { status: 502 }
    );
  }
}
