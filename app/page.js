"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const candidates = [
  { id: "DEMO-GNG-001", lat: 25.445, lng: 81.855, area: "2,430 m²" },
  { id: "DEMO-GNG-002", lat: 25.432, lng: 81.902, area: "1,180 m²" },
  { id: "DEMO-GNG-003", lat: 25.468, lng: 81.815, area: "860 m²" },
];

const NWDP_RIVER = "https://nwdp.nwic.gov.in/dataset/river-polygon";

export default function Home() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const [selected, setSelected] = useState(null);
  const [satellite, setSatellite] = useState(true);
  const [river, setRiver] = useState(true);
  const [basin, setBasin] = useState(false);
  const [cwc, setCwc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current || !mapEl.current) return;
      const map = L.map(mapEl.current, { zoomControl: false }).setView([25.435, 81.87], 11);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" });
      const imagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri" });
      const wms = "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms";
      const ganga = L.tileLayer.wms(wms, { layers: "organization:GangaRiver", format: "image/png", transparent: true, opacity: 0.9, attribution: "ISRO/NRSC Bhuvan" });
      const basinLayer = L.tileLayer.wms(wms, { layers: "organization:GANGA_BASIN", format: "image/png", transparent: true, opacity: 0.18, attribution: "ISRO/NRSC Bhuvan" });

      (satellite ? imagery : street).addTo(map);
      if (river) ganga.addTo(map);
      if (basin) basinLayer.addTo(map);

      const markers = L.layerGroup();
      candidates.forEach((candidate) => {
        const marker = L.circleMarker([candidate.lat, candidate.lng], { radius: 8, color: "#bc6c25", fillColor: "#dda15e", fillOpacity: 0.95, weight: 2 });
        marker.bindTooltip(candidate.id);
        marker.on("click", () => setSelected(candidate));
        marker.addTo(markers);
      });
      markers.addTo(map);

      layersRef.current = { map, street, imagery, ganga, basin: basinLayer };
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
      if (enabled) { layers.imagery.addTo(layers.map); layers.street.remove(); }
      else { layers.street.addTo(layers.map); layers.imagery.remove(); }
    }
    if (name === "river") { if (enabled) layers.ganga.addTo(layers.map); else layers.ganga.remove(); }
    if (name === "basin") { if (enabled) layers.basin.addTo(layers.map); else layers.basin.remove(); }
  }

  return (
    <main>
      <header>
        <div>
          <small>I-REIM • V0.3</small>
          <h1>India River Encroachment Intelligence</h1>
          <p>River corridor foundation • Ganga / Uttar Pradesh</p>
        </div>
        <div className="status"><i /> GIS FOUNDATION ACTIVE</div>
      </header>

      <section className="workspace">
        <aside>
          <h3>MAP LAYERS</h3>
          <label><input type="checkbox" checked={satellite} onChange={(e) => { setSatellite(e.target.checked); toggle("satellite", e.target.checked); }} /> Satellite basemap</label>
          <label><input type="checkbox" checked={river} onChange={(e) => { setRiver(e.target.checked); toggle("river", e.target.checked); }} /> <b>Ganga river</b> — ISRO/Bhuvan</label>
          <label><input type="checkbox" checked={basin} onChange={(e) => { setBasin(e.target.checked); toggle("basin", e.target.checked); }} /> Ganga basin — ISRO/Bhuvan</label>
          <label><input type="checkbox" checked={cwc} onChange={(e) => setCwc(e.target.checked)} /> <b>CWC/NWDP river polygon</b> — source registered</label>

          <label className="future"><input type="checkbox" disabled /> Historical water extent</label>
          <label className="future"><input type="checkbox" disabled /> River corridor</label>
          <label className="future"><input type="checkbox" disabled /> Catchments</label>
          <label className="future"><input type="checkbox" disabled /> Built-up detection</label>
          <label className="future"><input type="checkbox" disabled /> Potential encroachment</label>

          <hr />
          <h3>DATA FOUNDATION</h3>
          <div className="source">
            <b>CWC / National Water Data Portal</b>
            <span>River polygon = river + floodplain boundaries</span>
            <span>Formats: GeoJSON / SHP / KML</span>
            <span>Last portal update: 05 May 2025</span>
            <a href={NWDP_RIVER} target="_blank" rel="noreferrer">Open official CWC/NWDP dataset ↗</a>
          </div>

          <div className="note">
            <b>V0.3</b><br />
            The CWC/NWDP river-polygon source is now registered as the authoritative spatial foundation. The downloaded GeoJSON still needs to be imported into the application before it is rendered as a local analysis layer.
          </div>
        </aside>

        <div className="map" ref={mapEl} />

        <aside>
          <h3>DETECTION INSPECTOR</h3>
          {selected ? (
            <div>
              <div className="tag">{selected.id}</div>
              <h2>Illustrative candidate</h2>
              <p>Estimated area <b>{selected.area}</b></p>
              <p>Observed period <b>2019–2026</b></p>
              <p>Evidence <b>demo only</b></p>
              <div className="note">This is not a verified encroachment. Candidate generation will begin only after the historical water and corridor layers are computed.</div>
            </div>
          ) : (
            <div className="empty"><strong>V0.3</strong><p>The map is ready for the CWC/NWDP spatial foundation and satellite-derived water layers.</p></div>
          )}
        </aside>
      </section>

      <footer>
        <span>V0.3 foundation → CWC/NWDP river polygon → Sentinel-2 water extraction</span>
        <span>Palette: <b>#606c38</b> <b>#283618</b> <b>#fefae0</b> <b>#dda15e</b> <b>#bc6c25</b></span>
      </footer>
    </main>
  );
}