import { NextResponse } from "next/server";

export const revalidate = 86400;

const SOURCES = {
  "river-network": "https://nwdp.nwic.gov.in/dataset/3209962f-d0ff-45b8-910a-209bf69a0ccf/resource/6e552705-842d-40a4-92b2-8506bb66df2a/download/river_network.geojson",
  canal: "https://nwdp.nwic.gov.in/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/89bab129-cb30-41ec-8531-e7f445c170f3/download/canal_network.geojson",
  dam: "https://www.nwdp.nwic.gov.in/en/dataset/dam/resource/0d3a7101-81b4-450e-a3dd-c2bfa0b589e3",
};

export async function GET(_request, { params }) {
  const { layer } = await params;
  const source = SOURCES[layer];

  if (!source || !source.endsWith(".geojson")) {
    return NextResponse.json(
      { error: "Layer is not configured for proxy access yet." },
      { status: 400 }
    );
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
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to retrieve the official NWDP GeoJSON source.", detail: String(error) },
      { status: 502 }
    );
  }
}
