"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const candidates = [
  { id: "DEMO-GNG-001", lat: 25.445, lng: 81.855, area: "2,430 m²" },
  { id: "DEMO-GNG-002", lat: 25.432, lng: 81.902, area: "1,180 m²" },
  { id: "DEMO-GNG-003", lat: 25.468, lng: 81.815, area: "860 m²" },
];

export default function Home() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const [selected, setSelected] = useState(null);
  const [satellite, setSatellite] = useState(true);
  const [river, setRiver] = useState(true);
  const [basin, setBasin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current || !mapEl.current) return;

      const map = L.map(mapEl.current, { zoomControl: false }).setView(
        [25.435, 81.87],
        11
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const street = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors" }
      );

      const imagery = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri" }
      );

      const wms = "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms";

      const ganga = L.tileLayer.wms(wms, {
        layers: "organization:GangaRiver",
        format: "image/png",
        transparent: true,
        opacity: 0.9,
        attribution: "ISRO/NRSC Bhuvan",
      });

      const basinLayer = L.tileLayer.wms(wms, {
        layers: "organization:GANGA_BASIN",
        format: "image/png",
        transparent: true,
        opacity: 0.18,
        attribution: "ISRO/NRSC Bhuvan",
      });

      (satellite ? imagery : street).addTo(map);
      if (river) ganga.addTo(map);
      if (basin) basinLayer.addTo(map);

      const markers = L.layerGroup();

      candidates.forEach((candidate) => {
        const marker = L.circleMarker(
          [candidate.lat, candidate.lng],
          {
            radius: 8,
            color: "#bc6c25",
            fillColor: "#dda15e",
            fillOpacity: 0.95,
            weight: 2,
          }
        );

        marker.bindTooltip(candidate.id);
        marker.on("click", () => setSelected(candidate));
        marker.addTo(markers);
      });

      markers.addTo(map);

      layersRef.current = {
        map,
        street,
        imagery,
        ganga,
        basin: basinLayer,
      };
      mapRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  function toggle(name, enabled) {
    const layers = layersRef.current;
    if (!layers.map) return;

    if (name === "satellite") {
      if (enabled) {
        layers.imagery.addTo(layers.map);
        layers.street.remove();
      } else {
        layers.street.addTo(layers.map);
        layers.imagery.remove();
      }
    }

    if (name === "river") {
      if (enabled) layers.ganga.addTo(layers.map);
      else layers.ganga.remove();
    }

    if (name === "basin") {
      if (enabled) layers.basin.addTo(layers.map);
      else layers.basin.remove();
    }
  }

  return (
    <main>
      <header>
        <div>
          <small>I-REIM • V0.2</small>
          <h1>India River Encroachment Intelligence</h1>
          <p>Real-data river layer pilot • Ganga / Uttar Pradesh</p>
        </div>
        <div className="status">
          <i /> DATA FOUNDATION ONLINE
        </div>
      </header>

      <section className="workspace">
        <aside>
          <h3>MAP LAYERS</h3>

          <label>
            <input
              type="checkbox"
              checked={satellite}
              onChange={(e) => {
                setSatellite(e.target.checked);
                toggle("satellite", e.target.checked);
              }}
            />
            Satellite basemap
          </label>

          <label>
            <input
              type="checkbox"
              checked={river}
              onChange={(e) => {
                setRiver(e.target.checked);
                toggle("river", e.target.checked);
              }}
            />
            <b>Ganga river</b> — ISRO/Bhuvan
          </label>

          <label>
            <input
              type="checkbox"
              checked={basin}
              onChange={(e) => {
                setBasin(e.target.checked);
                toggle("basin", e.target.checked);
              }}
            />
            Ganga basin — ISRO/Bhuvan
          </label>

          <label className="future">
            <input type="checkbox" disabled /> Historical water extent
          </label>
          <label className="future">
            <input type="checkbox" disabled /> River corridor
          </label>
          <label className="future">
            <input type="checkbox" disabled /> Catchments
          </label>
          <label className="future">
            <input type="checkbox" disabled /> Built-up detection
          </label>
          <label className="future">
            <input type="checkbox" disabled /> Potential encroachment
          </label>

          <hr />

          <h3>DATA SOURCE</h3>
          <div className="source">
            <b>ISRO / NRSC Bhuvan</b>
            <span>GangaRiver WMS</span>
            <span>GANGA_BASIN WMS</span>
          </div>

          <div className="note">
            <b>V0.2</b>
            <br />
            Official river-service integration is separated from future
            analytical layers. Demo markers remain illustrative.
          </div>
        </aside>

        <div className="map" ref={mapEl} />

        <aside>
          <h3>DETECTION INSPECTOR</h3>

          {selected ? (
            <div>
              <div className="tag">{selected.id}</div>
              <h2>Illustrative candidate</h2>
              <p>
                Estimated area <b>{selected.area}</b>
              </p>
              <p>
                Observed period <b>2019–2026</b>
              </p>
              <p>
                Evidence <b>not connected</b>
              </p>
              <div className="note">
                This is demo data, not a verified encroachment. V0.3 will
                derive observations from satellite imagery.
              </div>
            </div>
          ) : (
            <div className="empty">
              <strong>V0.2</strong>
              <p>Click a marker or toggle the official river layer.</p>
            </div>
          )}
        </aside>
      </section>

      <footer>
        <span>Next: Sentinel-2 water extraction → historical river envelope</span>
        <span>
          Palette: <b>#606c38</b> <b>#283618</b> <b>#fefae0</b>{" "}
          <b>#dda15e</b> <b>#bc6c25</b>
        </span>
      </footer>
    </main>
  );
}