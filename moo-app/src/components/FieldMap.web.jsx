// src/components/FieldMap.web.jsx
import React, { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius } from '../constants/tokens';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DRAW_STYLE = { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2.5 };

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

// Use forwardRef so parent can call fieldMapRef.current.clearField()
const FieldMap = forwardRef(function FieldMap(
  { onFieldDrawn, onFieldCleared, mapLayer, drawMode, onDrawModeChange },
  ref
) {
  const { colors, strings } = useTheme();
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const drawnRef      = useRef(null);
  const drawCtrlRef   = useRef(null);
  const activeDrawRef = useRef(null);
  const streetRef     = useRef(null);
  const satRef        = useRef(null);

  const [isDrawing,      setIsDrawing]      = useState(false);
  const [vertexCount,    setVertexCount]    = useState(0);
  const [locating,       setLocating]       = useState(false);
  const [locationMarker, setLocationMarker] = useState(null);

  // ── Expose clearField to parent via ref ───────────────────────
  useImperativeHandle(ref, () => ({
    clearField: () => {
      if (drawnRef.current) drawnRef.current.clearLayers();
      if (activeDrawRef.current) {
        try { activeDrawRef.current.disable(); } catch {}
        activeDrawRef.current = null;
      }
      setIsDrawing(false);
      setVertexCount(0);
    },
    loadField: (geojsonPolygon) => {
      if (!drawnRef.current || !mapRef.current) return;
      try {
        const geom = typeof geojsonPolygon === 'string'
          ? JSON.parse(geojsonPolygon) : geojsonPolygon;
        // Clear existing layers
        drawnRef.current.clearLayers();
        // Create Leaflet layer from GeoJSON
        const layer = L.geoJSON(
          { type: 'Feature', geometry: geom },
          { style: DRAW_STYLE }
        );
        layer.eachLayer(l => drawnRef.current.addLayer(l));
        // Fit map to polygon bounds
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (e) {
        console.error('loadField error:', e);
      }
    },
  }));

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
        polygon:      { allowIntersection: false, showArea: true, shapeOptions: DRAW_STYLE },
        rectangle:    { shapeOptions: DRAW_STYLE },
        polyline:     false,
        circle:       false,
        marker:       false,
        circlemarker: false,
      },
      edit: { featureGroup: drawn, remove: true },
    });
    drawCtrlRef.current = drawCtrl;

    map.on('draw:drawvertex', () => setVertexCount(c => c + 1));

    map.on(L.Draw.Event.CREATED, e => {
      drawn.clearLayers();
      drawn.addLayer(e.layer);
      onFieldDrawn(JSON.stringify(e.layer.toGeoJSON().geometry), extractStats(e.layer));
      onDrawModeChange(null);
      setIsDrawing(false);
      setVertexCount(0);
      activeDrawRef.current = null;
    });

    map.on(L.Draw.Event.EDITED, e => {
      e.layers.eachLayer(l => onFieldDrawn(JSON.stringify(l.toGeoJSON().geometry), extractStats(l)));
    });

    map.on(L.Draw.Event.DELETED, () => onFieldCleared());

    map.on('draw:canceled', () => {
      setIsDrawing(false);
      setVertexCount(0);
      activeDrawRef.current = null;
      onDrawModeChange(null);
    });

    // ── Auto-locate user on first load ───────────────────────────
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
        },
        () => {
          // Permission denied or unavailable — keep default center
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !drawCtrlRef.current) return;
    if (activeDrawRef.current) {
      try { activeDrawRef.current.disable(); } catch {}
      activeDrawRef.current = null;
    }
    if (drawMode === 'polygon') {
      const handler = new L.Draw.Polygon(mapRef.current, drawCtrlRef.current.options.draw.polygon);
      handler.enable();
      activeDrawRef.current = handler;
      setIsDrawing(true);
      setVertexCount(0);
    } else if (drawMode === 'rectangle') {
      const handler = new L.Draw.Rectangle(mapRef.current, drawCtrlRef.current.options.draw.rectangle);
      handler.enable();
      activeDrawRef.current = handler;
      setIsDrawing(true);
      setVertexCount(0);
    } else {
      setIsDrawing(false);
      setVertexCount(0);
    }
  }, [drawMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapLayer === 'satellite') {
      mapRef.current.removeLayer(streetRef.current);
      mapRef.current.addLayer(satRef.current);
    } else {
      mapRef.current.removeLayer(satRef.current);
      mapRef.current.addLayer(streetRef.current);
    }
  }, [mapLayer]);

  const handleFinish = useCallback(() => {
    if (activeDrawRef.current?.completeShape) activeDrawRef.current.completeShape();
  }, []);

  const handleUndo = useCallback(() => {
    if (activeDrawRef.current?.deleteLastVertex) {
      activeDrawRef.current.deleteLastVertex();
      setVertexCount(c => Math.max(0, c - 1));
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (activeDrawRef.current) {
      try { activeDrawRef.current.disable(); } catch {}
      activeDrawRef.current = null;
    }
    setIsDrawing(false);
    setVertexCount(0);
    onDrawModeChange(null);
  }, [onDrawModeChange]);

  const handleLocate = useCallback(() => {
    if (!mapRef.current || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const map = mapRef.current;
        if (locationMarker) map.removeLayer(locationMarker);
        const marker = L.circleMarker([latitude, longitude], {
          radius: 8, fillColor: '#00e676', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9,
        }).addTo(map);
        L.circle([latitude, longitude], {
          radius: accuracy, fillColor: '#00e676', fillOpacity: 0.08, color: '#00e676', weight: 1,
        }).addTo(map);
        marker.bindPopup(`📍 You are here<br>Accuracy: ±${Math.round(accuracy)}m`).openPopup();
        setLocationMarker(marker);
        map.setView([latitude, longitude], 15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [locationMarker]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#080c10' }} data-layer={mapLayer} />

      {isDrawing && drawMode === 'polygon' && (
        <View style={[styles.drawToolbar, { backgroundColor: colors.bgGlass, borderColor: colors.greenBorder }]}>
          <Text style={[styles.drawHint, { color: colors.textMuted }]}>
            {vertexCount < 3
              ? `Click to place points (${vertexCount} placed, need ${3 - vertexCount} more)`
              : `${vertexCount} ${strings?.pointsReady || 'points — ready to finish'}`}
          </Text>
          <View style={styles.drawBtns}>
            {vertexCount >= 3 && (
              <TouchableOpacity style={[styles.drawBtn, { backgroundColor: colors.green }]} onPress={handleFinish}>
                <Text style={styles.drawBtnText}>{`✓ ${strings?.finishPolygon || 'Finish Polygon'}`}</Text>
              </TouchableOpacity>
            )}
            {vertexCount > 0 && (
              <TouchableOpacity style={[styles.drawBtn, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid, borderWidth: 1 }]} onPress={handleUndo}>
                <Text style={[styles.drawBtnText, { color: colors.textSecondary }]}>{`↩ ${strings?.undoPoint || 'Undo Point'}`}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.drawBtn, { backgroundColor: colors.bgElevated, borderColor: colors.danger, borderWidth: 1 }]} onPress={handleCancel}>
              <Text style={[styles.drawBtnText, { color: colors.danger }]}>{`✕ ${strings?.cancel || 'Cancel'}`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isDrawing && drawMode === 'rectangle' && (
        <View style={[styles.drawToolbar, { backgroundColor: colors.bgGlass, borderColor: colors.greenBorder }]}>
          <Text style={[styles.drawHint, { color: colors.textMuted }]}>{strings?.clickDragRect || 'Click and drag to draw a rectangle'}</Text>
          <View style={styles.drawBtns}>
            <TouchableOpacity style={[styles.drawBtn, { backgroundColor: colors.bgElevated, borderColor: colors.danger, borderWidth: 1 }]} onPress={handleCancel}>
              <Text style={[styles.drawBtnText, { color: colors.danger }]}>{`✕ ${strings?.cancel || 'Cancel'}`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.locateBtn, { backgroundColor: colors.bgGlass, borderColor: colors.borderMid }]}
        onPress={handleLocate}
        disabled={locating}
        activeOpacity={0.8}
      >
        <Text style={[styles.locateIcon, { color: locating ? colors.textMuted : colors.green }]}>
          {locating ? '⌛' : '📍'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default FieldMap;

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  drawToolbar: {
    position: 'absolute',
    bottom: 70, left: 12, right: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    zIndex: 1000,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  drawHint:    { fontFamily: Fonts.mono, fontSize: 12, textAlign: 'center' },
  drawBtns:    { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  drawBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  drawBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: '#07090e' },
  locateBtn: {
    position: 'absolute',
    bottom: 100, right: 10,
    width: 36, height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  locateIcon: { fontSize: 18 },
});