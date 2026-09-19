"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const candidates = [
  { id: "DEMO-GNG-001", lat: 25.445, lng: 81.855, area: "2,430 m²", type: "Built-up", confidence: "Demo" },
  { id: "DEMO-GNG-002", lat: 25.432, lng: 81.902, area: "1,180 m²", type: "Road / structure", confidence: "Demo" },
  { id: "DEMO-GNG-003", lat: 25.468, lng: 81.815, area: "860 m²", type: "Built-up", confidence: "Demo" },
];

const NWDP_RIVER = "https://nwdp.nwic.gov.in/dataset/river-polygon";
const NWDP_RIVER_NETWORK = "https://nwdp.nwic.gov.in/dataset/river-line";
const NWDP_CANAL = "https://nwdp.nwic.gov.in/dataset/canal";
const NWDP_DAM = "https://nwdp.nwic.gov.in/en/dataset/dam";
const NWDP_RESERVOIR = "https://nwdp.nwic.gov.in/dataset/reservoir";
const NWDP_PROJECTS = "https://nwdp.nwic.gov.in/en/dataset/water-resource-project";
const NWDP_WATERBODIES = "https://nwdp.nwic.gov.in/dataset/surface-waterbodies";
const NWDP_BASIN = "https://nwdp.nwic.gov.in/dataset/basin-cwc";

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
  const [riverNetwork, setRiverNetwork] = useState(false);
  const [canals, setCanals] = useState(false);
  const [dams, setDams] = useState(false);
  const [reservoirs, setReservoirs] = useState(false);
  const [projects, setProjects] = useState(false);
  const [waterbodies, setWaterbodies] = useState(false);
  const [infraSelected, setInfraSelected] = useState(null);
  const [infraStatus, setInfraStatus] = useState({});
  const infraLoadersRef = useRef({});
  const infraLoadingRef = useRef({});
  const waterShapesRef = useRef({});

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
      const basinLayer = L.layerGroup();

      const corridorLayer = L.layerGroup();
      const waterLayer = L.layerGroup();
      const markerLayer = L.layerGroup();
      const infrastructureLayer = L.layerGroup();
      const riverNetworkLayer = L.layerGroup();
      const canalLayer = L.layerGroup();
      const damLayer = L.layerGroup();
      const reservoirLayer = L.layerGroup();
      const projectLayer = L.layerGroup();
      const waterbodyLayer = L.layerGroup();

      (satellite ? imagery : street).addTo(map);
      if (river) ganga.addTo(map);

      // Official NWDP infrastructure is fetched through the app API so the
      // browser does not need to talk directly to the data portal.
      async function addGeoJsonLayer(path, layerGroup, style, onEachFeature, pointToLayer, sourceUrl, statusKey) {
        try {
          setInfraStatus((s) => ({ ...s, [statusKey]: "loading" }));
          let response = await fetch(path);
          if (!response.ok && sourceUrl) response = await fetch(sourceUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          L.geoJSON(data, { style, onEachFeature, pointToLayer }).addTo(layerGroup);
          layerGroup.addTo(map);
          infraLoadingRef.current[statusKey] = false;
          setInfraStatus((s) => ({ ...s, [statusKey]: `visible (${data.features?.length ?? 0})` }));
        } catch (error) {
          infraLoadingRef.current[statusKey] = false;
          console.warn("NWDP GeoJSON unavailable; trying India-WRIS WMS:", path, error);
          try {
            addWrisFallback(statusKey);
          } catch (fallbackError) {
            setInfraStatus((s) => ({ ...s, [statusKey]: "unavailable" }));
            console.warn("India-WRIS WMS fallback unavailable:", fallbackError);
          }
        }
      }

      async function loadBasin() {
        if (basinLayer.getLayers().length) {
          basinLayer.addTo(map);
          return;
        }
        try {
          const response = await fetch("/api/nwdp/basin");
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          L.geoJSON(data, {
            style: { color: "#dda15e", weight: 2.5, fillColor: "#dda15e", fillOpacity: 0.08 },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};
              const name = p.name || p.NAME || p.basin_name || p.Basin_Name || "CWC basin";
              layer.bindTooltip(name);
              layer.on("click", () => setInfraSelected({ kind: "River basin", name, source: "CWC / NWDP" }));
            }
          }).addTo(basinLayer);
          basinLayer.addTo(map);
        } catch (error) {
          console.warn("CWC basin GeoJSON unavailable; trying India-WRIS WMS:", error);
          try {
            addWrisWms("Basin", "9", basinLayer, "basin", { opacity: 0.55 });
          } catch (fallbackError) {
            console.warn("India-WRIS basin WMS unavailable:", fallbackError);
          }
        }
      }

      // Basin loader is declared before any initial/toggle call.
      if (basin) loadBasin();

      const WRIS_WMS = "https://india-wris.nrsc.gov.in/arcgis/services/SubInfoSysLCC";

      function addWrisWms(service, layers, targetLayer, statusKey, options = {}) {
        const wmsLayer = L.tileLayer.wms(`${WRIS_WMS}/${service}/MapServer/WMSServer`, {
          layers, format: "image/png", transparent: true,
          opacity: options.opacity ?? 0.85,
          version: "1.3.0",
          attribution: "India-WRIS / CWC / ISRO"
        });
        wmsLayer.addTo(targetLayer);
        targetLayer.addTo(map);
        setInfraStatus((s) => ({ ...s, [statusKey]: "visible (India-WRIS WMS)" }));
        return wmsLayer;
      }

      function addWrisFallback(statusKey) {
        const fallback = {
          riverNetwork: () => addWrisWms("River", "0", riverNetworkLayer, "riverNetwork", { opacity: 0.9 }),
          canals: () => addWrisWms("Canal", "3,4,5,6,7", canalLayer, "canals", { opacity: 0.8 }),
          dams: () => addWrisWms("WRP", "9,10", damLayer, "dams", { opacity: 0.9 }),
          reservoirs: () => addWrisWms("SWB", "10,11,12,13", reservoirLayer, "reservoirs", { opacity: 0.65 }),
          projects: () => addWrisWms("WRP", "6,7,8,10,11", projectLayer, "projects", { opacity: 0.7 }),
          waterbodies: () => addWrisWms("SWB", "4,5,6,7,8,9,14", waterbodyLayer, "waterbodies", { opacity: 0.55 })
        };
        return fallback[statusKey]?.();
      }

      const riverNetworkStyle = { color: "#bc6c25", weight: 3, opacity: 0.95 };
      const canalStyle = { color: "#f2b35e", weight: 3, opacity: 0.95, dashArray: "7 5" };

      const loaders = {
        riverNetwork: () => addGeoJsonLayer(
          "/api/nwdp/river-network", riverNetworkLayer, riverNetworkStyle,
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.river_name || "Unnamed river reach";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "River network", name, source: "CWC / NWDP" }));
          }, undefined,
          "https://nwdp.nwic.gov.in/dataset/3209962f-d0ff-45b8-910a-209bf69a0ccf/resource/6e552705-842d-40a4-92b2-8506bb66df2a/download/river_network.geojson",
          "riverNetwork"
        ),
        canals: () => addGeoJsonLayer(
          "/api/nwdp/canal", canalLayer, canalStyle,
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.canal_name || "Unnamed canal";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "Canal", name, source: "CWC / NWDP" }));
          }, undefined,
          "https://nwdp.nwic.gov.in/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/89bab129-cb30-41ec-8531-e7f445c170f3/download/canal_network.geojson",
          "canals"
        ),
        reservoirs: () => addGeoJsonLayer(
          "/api/nwdp/reservoir", reservoirLayer,
          { color: "#6f7f9a", weight: 1.2, fillColor: "#6f7f9a", fillOpacity: 0.28 },
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.reservoir_name || p.Reservoir_Name || "NWDP reservoir";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "Reservoir", name, source: "CWC / NWDP" }));
          }, undefined,
          "https://nwdp.nwic.gov.in/dataset/f098645e-950f-40fe-b100-fd2cc95e789d/resource/1790dd33-0e07-49d0-bc52-ca222d30543e/download/reservoir.geojson",
          "reservoirs"
        ),
        projects: () => addGeoJsonLayer(
          "/api/nwdp/water-resource-project", projectLayer,
          { color: "#7f8f55", weight: 1.2, fillColor: "#7f8f55", fillOpacity: 0.12, dashArray: "5 4" },
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.project_name || p.Project_Name || "Irrigation command area";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "Water resource project", name, source: "CWC / NWDP" }));
          }, undefined,
          "https://nwdp.nwic.gov.in/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/7b1e0abf-ca24-46d2-b0dc-7234021e414d/download/command_area.geojson",
          "projects"
        ),
        waterbodies: () => addGeoJsonLayer(
          "/api/nwdp/waterbodies", waterbodyLayer,
          { color: "#3d6f78", weight: 1, fillColor: "#3d6f78", fillOpacity: 0.32 },
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.waterbody_name || p.Waterbody_Name || "Surface waterbody";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "Surface waterbody", name, source: "ISRO SAC / NWDP" }));
          }, undefined,
          "https://nwdp.nwic.gov.in/dataset/811f6a62-61c2-4d79-b90b-deeee4151f6d/resource/7451d595-37bf-4238-90c0-2edc5afce7b3/download/wb_up_geojson.zip",
          "waterbodies"
        ),
        dams: () => addGeoJsonLayer(
          "/api/nwdp/dam", damLayer, null,
          (feature, layer) => {
            const p = feature.properties || {};
            const name = p.name || p.NAME || p.dam_name || p.Dam_Name || "NWDP dam";
            layer.bindTooltip(name);
            layer.on("click", () => setInfraSelected({ kind: "Dam", name, source: "National Dam Safety Authority / NWDP" }));
          },
          (_feature, latlng) => L.circleMarker(latlng, { radius: 8, color: "#fefae0", fillColor: "#bc6c25", fillOpacity: 1, weight: 3 }),
          "https://nwdp.nwic.gov.in/dataset/814111c2-16a3-4f1b-bcc0-42274fc3fcbe/resource/0d3a7101-81b4-450e-a3dd-c2bfa0b589e3/download/dam.geojson",
          "dams"
        )
      };

      infraLoadersRef.current = loaders;

      // Visual prototype layers. These are deliberately labelled illustrative
      // until exported Earth Engine products are connected to the application.
      const corridorPolygon = L.polygon(
        [[25.475,81.79],[25.487,81.83],[25.468,81.88],[25.455,81.93],[25.425,81.95],[25.405,81.90],[25.42,81.85],[25.45,81.81]],
        { color: "#dda15e", weight: 2, fillColor: "#dda15e", fillOpacity: 0.10, dashArray: "7 6" }
      ).bindTooltip("V0.7 illustrative 1 km screening corridor");
      corridorPolygon.addTo(corridorLayer);

      // The live Earth Engine water exports are not connected yet, so the timeline
      // uses clearly-labelled illustrative envelopes that change with the selected year.
      // Once the real annual rasters are connected, this block is replaced by those assets.
      const waterStart = [
        [25.455,81.795],[25.480,81.825],[25.468,81.860],[25.448,81.895],
        [25.425,81.930],[25.405,81.915],[25.420,81.880],[25.440,81.840]
      ];
      const waterEnd = [
        [25.460,81.800],[25.472,81.825],[25.460,81.855],[25.445,81.885],
        [25.432,81.915],[25.417,81.905],[25.430,81.875],[25.447,81.845]
      ];
      for (let y = 2020; y <= 2026; y += 1) {
        const t = (y - 2020) / 6;
        const coords = waterStart.map((p, i) => [
          p[0] + (waterEnd[i][0] - p[0]) * t,
          p[1] + (waterEnd[i][1] - p[1]) * t
        ]);
        const polygon = L.polygon(coords, {
          color: "#283618", weight: 1, fillColor: "#283618", fillOpacity: 0.28
        }).bindTooltip(`Illustrative historical-water envelope • ${y}`);
        waterShapesRef.current[y] = polygon;
        if (y === year) polygon.addTo(waterLayer);
      }

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

      layersRef.current = {
        map, street, imagery, ganga, basin: basinLayer,
        corridorLayer, waterLayer, markerLayer,
        infrastructureLayer, riverNetworkLayer, canalLayer, damLayer, reservoirLayer, projectLayer, waterbodyLayer,
        basinLoader: loadBasin
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
    const map = layers.map;

    if (name === "satellite") {
      if (enabled) { layers.imagery.addTo(map); layers.street.remove(); }
      else { layers.street.addTo(map); layers.imagery.remove(); }
    }
    if (name === "river") enabled ? layers.ganga.addTo(map) : layers.ganga.remove();
    if (name === "basin") {
      if (enabled) {
        const basinLoader = layers.basinLoader;
        if (basinLoader) basinLoader();
        else layers.basin.addTo(map);
      } else {
        layers.basin.remove();
      }
    }
    if (name === "corridor") enabled ? layers.corridorLayer.addTo(map) : layers.corridorLayer.remove();
    if (name === "water") {
      if (enabled) {
        layers.waterLayer.addTo(map);
        const selectedWater = waterShapesRef.current[year];
        if (selectedWater) selectedWater.addTo(layers.waterLayer);
      } else {
        layers.waterLayer.remove();
      }
    }
    if (name === "candidates") enabled ? layers.markerLayer.addTo(map) : layers.markerLayer.remove();

    const infraLayerMap = {
      riverNetwork: layers.riverNetworkLayer,
      canals: layers.canalLayer,
      dams: layers.damLayer,
      reservoirs: layers.reservoirLayer,
      projects: layers.projectLayer,
      waterbodies: layers.waterbodyLayer
    };

    if (infraLayerMap[name]) {
      const group = infraLayerMap[name];
      if (enabled) {
        group.addTo(map);
        const loader = infraLoadersRef.current[name];
        if (loader && !group.getLayers().length && !infraLoadingRef.current[name]) {
          infraLoadingRef.current[name] = true;
          loader();
        } else if (group.getLayers().length) {
          setInfraStatus((s) => ({ ...s, [name]: `visible (${group.getLayers().length})` }));
        }
      } else {
        group.remove();
        setInfraStatus((s) => ({ ...s, [name]: "off" }));
      }
    }
  }

  useEffect(() => {
    const group = layersRef.current.waterLayer;
    if (!group || !mapRef.current) return;
    Object.values(waterShapesRef.current).forEach((shape) => group.removeLayer(shape));
    if (water) {
      const selectedWater = waterShapesRef.current[year];
      if (selectedWater) selectedWater.addTo(group);
      if (mapRef.current.hasLayer(group)) group.bringToFront();
    }
  }, [year, water]);

  return (
    <main>
      <header>
        <div>
          <small>I-REIM • V0.8</small>
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
          <h3>WATER INFRASTRUCTURE & WATERBODIES</h3>
          <label><input type="checkbox" checked={riverNetwork} onChange={(e) => { setRiverNetwork(e.target.checked); toggle("riverNetwork", e.target.checked); }} /> River network — CWC/NWDP</label>
          <label><input type="checkbox" checked={canals} onChange={(e) => { setCanals(e.target.checked); toggle("canals", e.target.checked); }} /> Canal network — CWC/NWDP</label>
          <label><input type="checkbox" checked={dams} onChange={(e) => { setDams(e.target.checked); toggle("dams", e.target.checked); }} /> Dams — NDSA/NWDP</label>
          <label><input type="checkbox" checked={reservoirs} onChange={(e) => { setReservoirs(e.target.checked); toggle("reservoirs", e.target.checked); }} /> Reservoirs — CWC/NWDP</label>
          <label><input type="checkbox" checked={projects} onChange={(e) => { setProjects(e.target.checked); toggle("projects", e.target.checked); }} /> Irrigation projects — CWC/NWDP</label>
          <label><input type="checkbox" checked={waterbodies} onChange={(e) => { setWaterbodies(e.target.checked); toggle("waterbodies", e.target.checked); }} /> Surface waterbodies — ISRO/NWDP</label>
          <div className="infraHint">Trace water infrastructure alongside the river reference to understand connectivity and downstream relationships.</div>
          <div className="infraStatus">
            <span>River: {infraStatus.riverNetwork || "off"}</span>
            <span>Canals: {infraStatus.canals || "off"}</span>
            <span>Dams: {infraStatus.dams || "off"}</span>
            <span>Reservoirs: {infraStatus.reservoirs || "off"}</span>
            <span>Projects: {infraStatus.projects || "off"}</span>
            <span>Waterbodies: {infraStatus.waterbodies || "off"}</span>
          </div>

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
            <a href={NWDP_RIVER} target="_blank" rel="noreferrer">River polygon ↗</a>
            <a href={NWDP_RIVER_NETWORK} target="_blank" rel="noreferrer">River network ↗</a>
            <a href={NWDP_CANAL} target="_blank" rel="noreferrer">Canal network ↗</a>
            <a href={NWDP_DAM} target="_blank" rel="noreferrer">Dam dataset ↗</a>
            <a href={NWDP_RESERVOIR} target="_blank" rel="noreferrer">Reservoir dataset ↗</a>
            <a href={NWDP_PROJECTS} target="_blank" rel="noreferrer">Water resource projects ↗</a>
            <a href={NWDP_WATERBODIES} target="_blank" rel="noreferrer">Surface waterbodies ↗</a>
            <a href={NWDP_BASIN} target="_blank" rel="noreferrer">CWC basin dataset ↗</a>
          </div>

          <div className="note"><b>OFFICIAL DATA SOURCES</b><br />Infrastructure and waterbody layers are sourced from the Government of India's National Water Data Portal. Waterbodies use ISRO SAC data; river, canal, reservoir and irrigation project layers use CWC/NWDP; dams use NDSA/NWDP. The historical-water timeline remains illustrative until Earth Engine exports are connected.</div>
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

          <h3 className="inspectorTitle">WATER INFRASTRUCTURE INSPECTOR</h3>
          {infraSelected ? (
            <div className="infraInspector">
              <div className="tag">{infraSelected.kind}</div>
              <h2>{infraSelected.name}</h2>
              <div className="candidateGrid"><span>Source</span><b>{infraSelected.source}</b><span>Role</span><b>Hydrological context</b></div>
            </div>
          ) : (
            <div className="empty infraEmpty"><strong>MAP</strong><p>Turn on a water-infrastructure layer and click a feature to inspect its source record.</p></div>
          )}

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
            <div className="empty"><strong>MAP</strong><p>Select a candidate marker to inspect its evidence record.</p></div>
          )}
        </aside>
      </section>

      <footer>
        <span>V0.8 • River reference → water infrastructure → historical water → corridor</span>
        <span><b>NWDP infrastructure</b> • live source proxy enabled</span>
      </footer>
    </main>
  );
}
