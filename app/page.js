"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const candidates = [
  { id: "DEMO-GNG-001", lat: 25.445, lng: 81.855, area: "2,430 m²", type: "Built-up", confidence: "Demo" },
  { id: "DEMO-GNG-002", lat: 25.432, lng: 81.902, area: "1,180 m²", type: "Road / structure", confidence: "Demo" },
  { id: "DEMO-GNG-003", lat: 25.468, lng: 81.815, area: "860 m²", type: "Built-up", confidence: "Demo" },
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
  const [corridor, setCorridor] = useState(true);
  const [water, setWater] = useState(true);
  const [candidatesLayer, setCandidatesLayer] = useState(true);
  const [year, setYear] = useState(2026);

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

      const corridorLayer = L.layerGroup();
      const waterLayer = L.layerGroup();
      const markerLayer = L.layerGroup();

      (satellite ? imagery : street).addTo(map);
      if (river) ganga.addTo(map);
      if (basin) basinLayer.addTo(map);

      // Visual V0.7 prototype layers. They are deliberately labelled illustrative
      // until exported Earth Engine products are connected to the application.
      const corridorPolygon = L.polygon(
        [[25.475,81.79],[25.487,81.83],[25.468,81.88],[25.455,81.93],[25.425,81.95],[25.405,81.90],[25.42,81.85],[25.45,81.81]],
        { color: "#dda15e", weight: 2, fillColor: "#dda15e", fillOpacity: 0.10, dashArray: "7 6" }
      ).bindTooltip("V0.7 illustrative 1 km screening corridor");
      corridorPolygon.addTo(corridorLayer);

      const waterPolygon = L.polygon(
        [[25.46,81.80],[25.472,81.825],[25.46,81.855],[25.445,81.885],[25.432,81.915],[25.417,81.905],[25.43,81.875],[25.447,81.845]],
        { color: "#283618", weight: 1, fillColor: "#283618", fillOpacity: 0.28 }
      ).bindTooltip("V0.7 illustrative historical-water envelope");
      waterPolygon.addTo(waterLayer);

      candidates.forEach((candidate) => {
        const marker = L.circleMarker([candidate.lat, candidate.lng], {
          radius: 8, color: "#bc6c25", fillColor: "#dda15e", fillOpacity: 0.95, weight: 2
        });
        marker.bindTooltip(candidate.id);
        marker.on("click", () => setSelected(candidate));
        marker.addTo(markerLayer);
      });

      if (corridor) corridorLayer.addTo(map);
      if (water) waterLayer.addTo(map);
      if (candidatesLayer) markerLayer.addTo(map);

      layersRef.current = { map, street, imagery, ganga, basin: basinLayer, corridorLayer, waterLayer, markerLayer };
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
    const map = layers.map;
    if (name === "satellite") enabled ? layers.imagery.addTo(map) && layers.street.remove() : layers.street.addTo(map) && layers.imagery.remove();
    if (name === "river") enabled ? layers.ganga.addTo(map) : layers.ganga.remove();
    if (name === "basin") enabled ? layers.basin.addTo(map) : layers.basin.remove();
    if (name === "corridor") enabled ? layers.corridorLayer.addTo(map) : layers.corridorLayer.remove();
    if (name === "water") enabled ? layers.waterLayer.addTo(map) : layers.waterLayer.remove();
    if (name === "candidates") enabled ? layers.markerLayer.addTo(map) : layers.markerLayer.remove();
  }

  return (
    <main>
      <header>
        <div>
          <small>I-REIM • V0.7</small>
          <h1>India River Encroachment Intelligence</h1>
          <p>Evidence workspace • Ganga / Prayagraj prototype</p>
        </div>
        <div className="status"><i /> ANALYSIS WORKSPACE</div>
      </header>

      <section className="workspace">
        <aside>
          <h3>ANALYSIS LAYERS</h3>
          <label><input type="checkbox" checked={satellite} onChange={(e) => { setSatellite(e.target.checked); toggle("satellite", e.target.checked); }} /> Satellite basemap</label>
          <label><input type="checkbox" checked={river} onChange={(e) => { setRiver(e.target.checked); toggle("river", e.target.checked); }} /> <b>Ganga river</b> — ISRO/Bhuvan</label>
          <label><input type="checkbox" checked={basin} onChange={(e) => { setBasin(e.target.checked); toggle("basin", e.target.checked); }} /> Ganga basin</label>
          <label><input type="checkbox" checked={corridor} onChange={(e) => { setCorridor(e.target.checked); toggle("corridor", e.target.checked); }} /> <b>Analysis corridor</b> — 1 km</label>
          <label><input type="checkbox" checked={water} onChange={(e) => { setWater(e.target.checked); toggle("water", e.target.checked); }} /> <b>Historical water</b> — {year}</label>
          <label><input type="checkbox" checked={candidatesLayer} onChange={(e) => { setCandidatesLayer(e.target.checked); toggle("candidates", e.target.checked); }} /> <b>Potential candidates</b></label>

          <hr />
          <h3>TIME SERIES</h3>
          <div className="yearRow"><span>Analysis year</span><strong>{year}</strong></div>
          <input className="yearSlider" type="range" min="2020" max="2026" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <div className="rangeLabels"><span>2020</span><span>2026</span></div>

          <hr />
          <h3>DATA FOUNDATION</h3>
          <div className="source">
            <b>CWC / National Water Data Portal</b>
            <span>River polygon = river + floodplain boundaries</span>
            <span>Sentinel-2 = historical observation layer</span>
            <span>Processing = cloud probability + MNDWI</span>
            <a href={NWDP_RIVER} target="_blank" rel="noreferrer">Open official CWC/NWDP dataset ↗</a>
          </div>

          <div className="note"><b>PROTOTYPE DATA</b><br />The corridor and historical-water shapes currently shown on the map are illustrative UI layers. The Earth Engine exports are not yet connected to the web map.</div>
        </aside>

        <div className="mapWrap">
          <div className="map" ref={mapEl} />
          <div className="mapLegend">
            <span><i className="legendCorridor" /> corridor</span>
            <span><i className="legendWater" /> historical water</span>
            <span><i className="legendCandidate" /> candidate</span>
          </div>
          <div className="mapBadge">PRAYAGRAJ • {year} • PROTOTYPE</div>
        </div>

        <aside>
          <h3>INTELLIGENCE STATUS</h3>
          <div className="metrics">
            <div><span>Reference</span><b>CWC / NWDP</b></div>
            <div><span>Water model</span><b>MNDWI</b></div>
            <div><span>Cloud mask</span><b>S2 Probability</b></div>
            <div><span>Corridor</span><b>1,000 m</b></div>
          </div>

          <div className="pipeline">
            <div className="done"><i /> River reference</div>
            <div className="done"><i /> Historical water model</div>
            <div className="done"><i /> Corridor engine</div>
            <div className="active"><i /> Candidate screening</div>
            <div><i /> Verification evidence</div>
          </div>

          <h3 className="inspectorTitle">DETECTION INSPECTOR</h3>
          {selected ? (
            <div>
              <div className="tag">{selected.id}</div>
              <h2>Potential candidate</h2>
              <div className="candidateGrid">
                <span>Type</span><b>{selected.type}</b>
                <span>Estimated area</span><b>{selected.area}</b>
                <span>Confidence</span><b>{selected.confidence}</b>
                <span>Year</span><b>{year}</b>
              </div>
              <div className="note">Illustrative candidate only. No legal or unauthorized-occupation conclusion is made from this prototype layer.</div>
            </div>
          ) : (
            <div className="empty"><strong>V0.7</strong><p>Select a candidate marker to inspect its evidence record.</p></div>
          )}
        </aside>
      </section>

      <footer>
        <span>V0.7 • River reference → historical water → corridor → candidate screening</span>
        <span><b>3 demo candidates</b> • evidence connection pending</span>
      </footer>
    </main>
  );
}
