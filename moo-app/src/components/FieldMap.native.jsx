// src/components/FieldMap.native.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Radius, Fonts } from '../constants/tokens';

function coordsToGeoJSON(coords) {
  return {
    type: 'Polygon',
    coordinates: [[...coords.map(c => [c.longitude, c.latitude]), [coords[0].longitude, coords[0].latitude]]],
  };
}

function calcArea(coords) {
  if (coords.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    area += coords[i].longitude * coords[j].latitude - coords[j].longitude * coords[i].latitude;
  }
  const latRad = (coords[0].latitude * Math.PI) / 180;
  return Math.abs(area / 2) * 111320 * 111320 * Math.cos(latRad);
}

function calcStats(coords) {
  const areaHa = (calcArea(coords) / 10000).toFixed(2);
  const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
  const centroid = `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`;
  let perimM = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const dlat = (coords[j].latitude  - coords[i].latitude)  * 111320;
    const dlng = (coords[j].longitude - coords[i].longitude) * 111320 * Math.cos(coords[i].latitude * Math.PI / 180);
    perimM += Math.sqrt(dlat * dlat + dlng * dlng);
  }
  return { areaHa, centroid, perimKm: (perimM / 1000).toFixed(2), pts: coords.length };
}

export default function FieldMap({ onFieldDrawn, onFieldCleared, mapLayer, drawMode, onDrawModeChange }) {
  const mapRef    = useRef(null);
  const [vertices, setVertices]       = useState([]);
  const [rectStart, setRectStart]     = useState(null);
  const [drawnCoords, setDrawnCoords] = useState(null);
  const [mapType, setMapType]         = useState('standard');

  useEffect(() => {
    setMapType(mapLayer === 'satellite' ? 'satellite' : 'standard');
  }, [mapLayer]);

  const handleMapPress = useCallback((e) => {
    if (!drawMode) return;
    const coord = e.nativeEvent.coordinate;
    if (drawMode === 'polygon') {
      setVertices(prev => [...prev, coord]);
    }
    if (drawMode === 'rectangle') {
      if (!rectStart) {
        setRectStart(coord);
      } else {
        const coords = [
          { latitude: rectStart.latitude,  longitude: rectStart.longitude },
          { latitude: rectStart.latitude,  longitude: coord.longitude },
          { latitude: coord.latitude,      longitude: coord.longitude },
          { latitude: coord.latitude,      longitude: rectStart.longitude },
        ];
        finalisePolygon(coords);
        setRectStart(null);
      }
    }
  }, [drawMode, rectStart]);

  const handleMapLongPress = useCallback(() => {
    if (drawMode === 'polygon' && vertices.length >= 3) {
      finalisePolygon(vertices);
    }
  }, [drawMode, vertices]);

  const finalisePolygon = useCallback((coords) => {
    setDrawnCoords(coords);
    setVertices([]);
    setRectStart(null);
    onDrawModeChange(null);
    const geojson = JSON.stringify(coordsToGeoJSON(coords));
    onFieldDrawn(geojson, calcStats(coords));
  }, [onFieldDrawn, onDrawModeChange]);

  const handleClear = useCallback(() => {
    setDrawnCoords(null);
    setVertices([]);
    setRectStart(null);
    onFieldCleared();
  }, [onFieldCleared]);

  const isDrawing = drawMode === 'polygon' || drawMode === 'rectangle';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={{ latitude: 49.8731, longitude: 8.6673, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        scrollEnabled={!isDrawing}
        zoomEnabled
        rotateEnabled={false}
      >
        {drawMode === 'polygon' && vertices.length > 0 && (
          <Polygon coordinates={vertices} strokeColor={Colors.green} fillColor={Colors.greenTrace} strokeWidth={2} />
        )}
        {drawMode === 'polygon' && vertices.map((v, i) => (
          <Marker key={i} coordinate={v} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.vertex} />
          </Marker>
        ))}
        {drawMode === 'rectangle' && rectStart && (
          <Marker coordinate={rectStart} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.vertex, styles.vertexRect]} />
          </Marker>
        )}
        {drawnCoords && (
          <Polygon coordinates={drawnCoords} strokeColor={Colors.green} fillColor={Colors.greenTrace} strokeWidth={2} />
        )}
      </MapView>

      {isDrawing && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {drawMode === 'polygon'
              ? vertices.length < 3
                ? `Tap to add vertices (${vertices.length} placed)`
                : 'Long-press to close polygon'
              : rectStart
                ? 'Tap second corner to complete rectangle'
                : 'Tap first corner of rectangle'}
          </Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { setVertices([]); setRectStart(null); onDrawModeChange(null); }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {drawMode === 'polygon' && vertices.length > 0 && (
        <TouchableOpacity style={styles.undoBtn} onPress={() => setVertices(v => v.slice(0, -1))}>
          <Text style={styles.undoText}>↩ Undo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  vertex: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: '#fff',
  },
  vertexRect: { backgroundColor: Colors.warning },
  hint: {
    position: 'absolute',
    bottom: 80,
    left: 16, right: 16,
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hintText: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.bgOverlay,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  cancelText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.danger },
  undoBtn: {
    position: 'absolute',
    bottom: 140,
    right: 16,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  undoText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary },
});