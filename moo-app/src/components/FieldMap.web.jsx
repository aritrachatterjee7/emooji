import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix broken default icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DRAW_STYLE = { color: '#0bdb6e', fillColor: '#0bdb6e', fillOpacity: 0.12, weight: 2 };

function approxArea(latlngs) {
  if (!latlngs || latlngs.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    area += latlngs[i].lng * latlngs[j].lat - latlngs[j].lng * latlngs[i].lat;
  }
  const latRad = (latlngs[0].lat * Math.PI) / 180;
  return Math.abs(area / 2) * 111320 * 111320 * Math.cos(latRad);
}

function extractStats(layer) {
  const geo = layer.toGeoJSON();
  const ll  = layer.getLatLngs ? layer.getLatLngs()[0] : [];
  const areaHa  = (approxArea(ll) / 10000).toFixed(2);
  const center  = layer.getBounds().getCenter();
  const centroid = `${center.lat.toFixed(4)}°N ${center.lng.toFixed(4)}°E`;
  let perimM = 0;
  for (let i = 0; i < ll.length; i++) perimM += ll[i].distanceTo(ll[(i+1) % ll.length]);
  const perimKm = (perimM / 1000).toFixed(2);
  const pts = geo.geometry.type === 'Polygon' ? geo.geometry.coordinates[0].length - 1 : 4;
  return { areaHa, centroid, perimKm, pts };
}

export default function FieldMap({ onFieldDrawn, onFieldCleared, mapLayer, drawMode, onDrawModeChange, onDemoTrigger }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const drawnRef      = useRef(null);
  const drawCtrlRef   = useRef(null);
  const streetRef     = useRef(null);
  const satRef        = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: [49.8731, 8.6673], zoom: 14, zoomControl: true });
    streetRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 });
    satRef.current    = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 });
    streetRef.current.addTo(map);
    map.zoomControl.setPosition('bottomright');

    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);
    drawnRef.current = drawn;

    const drawCtrl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon:     { allowIntersection: false, showArea: true, shapeOptions: DRAW_STYLE },
        rectangle:   { shapeOptions: DRAW_STYLE },
        polyline: false, circle: false, marker: false, circlemarker: false,
      },
      edit: { featureGroup: drawn, remove: true },
    });
    map.addControl(drawCtrl);
    drawCtrlRef.current = drawCtrl;

    map.on(L.Draw.Event.CREATED, e => {
      drawn.clearLayers();
      drawn.addLayer(e.layer);
      onFieldDrawn(JSON.stringify(e.layer.toGeoJSON().geometry), extractStats(e.layer));
      onDrawModeChange(null);
    });
    map.on(L.Draw.Event.EDITED, e => {
      e.layers.eachLayer(l => onFieldDrawn(JSON.stringify(l.toGeoJSON().geometry), extractStats(l)));
    });
    map.on(L.Draw.Event.DELETED, () => onFieldCleared());

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to drawMode prop changes
  useEffect(() => {
    if (!mapRef.current || !drawCtrlRef.current) return;
    if (drawMode === 'polygon')   new L.Draw.Polygon(mapRef.current, drawCtrlRef.current.options.draw.polygon).enable();
    if (drawMode === 'rectangle') new L.Draw.Rectangle(mapRef.current, drawCtrlRef.current.options.draw.rectangle).enable();
  }, [drawMode]);

  // React to layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapLayer === 'satellite') { mapRef.current.removeLayer(streetRef.current); mapRef.current.addLayer(satRef.current); }
    else                          { mapRef.current.removeLayer(satRef.current);    mapRef.current.addLayer(streetRef.current); }
  }, [mapLayer]);

  // Demo trigger
  useEffect(() => {
    if (!onDemoTrigger || !mapRef.current) return;
    onDemoTrigger(drawnRef.current, mapRef.current);
  }, [onDemoTrigger]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#080c10' }}
      data-layer={mapLayer}
    />
  );
}
