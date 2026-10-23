import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import L from "leaflet";
import type { Body } from "../../data/sites";
import { LAYERS, type MapLayer } from "../../data/layers";
import {
  equirectMetresPerPixel,
  mercatorMetresPerPixel,
  niceScale,
  POLAR_EDGE_LAT,
  POLAR_IMAGE_SIZE,
  POLAR_METRES_PER_PIXEL,
  polarPixel,
  zoomForEquirect,
  zoomForMercator,
} from "../../lib/geo";

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  color: string;
  label: string;
  dim?: boolean;
  dashed?: boolean;
}

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
  metresPerPixel: number;
}

export interface BodyMapHandle {
  flyTo: (lat: number, lon: number, zoom?: number, animate?: boolean) => void;
  setMetresPerPixel: (mpp: number) => void;
}

interface Props {
  body: Body;
  layerId: string;
  overlayIds?: string[];
  markers: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onViewChange?: (v: MapView) => void;
  initial?: { lat: number; lon: number; zoom: number };
  className?: string;
}

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<string, MapLayer>;

function toLatLng(projection: MapLayer["projection"], lat: number, lon: number): L.LatLng | null {
  if (projection === "polar-south") {
    if (lat > POLAR_EDGE_LAT) return null;
    const [x, y] = polarPixel(lat, lon);
    return L.latLng(-y, x);
  }
  return L.latLng(lat, lon);
}

function metresPerPixel(map: L.Map, projection: MapLayer["projection"], body: Body): number {
  const z = map.getZoom();
  if (projection === "mercator") return mercatorMetresPerPixel(map.getCenter().lat, z);
  if (projection === "equirect") return equirectMetresPerPixel(body, z);
  return POLAR_METRES_PER_PIXEL / 2 ** z;
}

function pinIcon(m: MapMarker, active: boolean) {
  const cls = ["sa-pin", m.dim ? "dim" : "", active ? "active" : "", m.dashed ? "dashed" : ""].join(" ");
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="${cls}" style="--pin:${m.color}"><span class="ring"></span><span class="core"></span></div>`,
  });
}

export const BodyMap = forwardRef<BodyMapHandle, Props>(function BodyMap(
  { body, layerId, overlayIds = [], markers, activeId, onSelect, onViewChange, initial, className },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.Layer | null>(null);
  const overlayRef = useRef<L.Layer[]>([]);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const silent = useRef(false);
  const cb = useRef({ onSelect, onViewChange });
  cb.current = { onSelect, onViewChange };

  const layer = LAYER_BY_ID[layerId];
  const projection = layer.projection;
  const [scale, setScale] = useState({ px: 100, label: "" });

  // (Re)create the map whenever the projection changes, each needs its own CRS.
  useEffect(() => {
    if (!host.current) return;
    const crs = projection === "mercator" ? L.CRS.EPSG3857 : projection === "equirect" ? L.CRS.EPSG4326 : L.CRS.Simple;
    const map = L.map(host.current, {
      crs,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: projection === "mercator",
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      minZoom: projection === "polar-south" ? -1.5 : projection === "mercator" ? 1.5 : 0.5,
      maxZoom: projection === "polar-south" ? 3 : 12,
      maxBounds:
        projection === "equirect"
          ? L.latLngBounds([-90, -180], [90, 180])
          : projection === "polar-south"
            ? L.latLngBounds([-POLAR_IMAGE_SIZE * 1.1, -POLAR_IMAGE_SIZE * 0.1], [POLAR_IMAGE_SIZE * 0.1, POLAR_IMAGE_SIZE * 1.1])
            : undefined,
      maxBoundsViscosity: 0.8,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false);
    markerLayer.current = L.layerGroup().addTo(map);

    if (projection === "polar-south") {
      map.setView([-POLAR_IMAGE_SIZE / 2, POLAR_IMAGE_SIZE / 2], -0.6);
    } else if (initial) {
      map.setView([initial.lat, initial.lon], initial.zoom);
    } else {
      map.setView([15, 0], projection === "mercator" ? 2 : 1.4);
    }

    let alive = true;
    const emit = () => {
      if (!alive) return;
      const mpp = metresPerPixel(map, projection, body);
      const nice = niceScale(mpp * 110);
      setScale({ px: nice.value / mpp, label: nice.label });
      if (silent.current) return;
      const c = map.getCenter();
      cb.current.onViewChange?.({ lat: c.lat, lon: c.lng, zoom: map.getZoom(), metresPerPixel: mpp });
    };
    map.on("zoomend moveend", emit);
    mapRef.current = map;
    const raf = requestAnimationFrame(() => {
      if (!alive) return;
      map.invalidateSize();
      emit();
    });
    const ro = new ResizeObserver(() => alive && map.invalidateSize());
    ro.observe(host.current);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.off();
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
      overlayRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, body]);

  // Base layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseRef.current) map.removeLayer(baseRef.current);
    const attribution = `${layer.provider} · ${layer.instrument}`;
    if (layer.projection === "polar-south") {
      baseRef.current = L.imageOverlay(layer.url, [[-POLAR_IMAGE_SIZE, 0], [0, POLAR_IMAGE_SIZE]], {
        attribution,
        className: "polar-image",
      }).addTo(map);
    } else {
      baseRef.current = L.tileLayer(layer.url, {
        attribution,
        tileSize: 256,
        maxNativeZoom: layer.maxNativeZoom,
        maxZoom: 12,
        noWrap: layer.projection === "equirect",
        bounds: layer.projection === "equirect" ? L.latLngBounds([-90, -180], [90, 180]) : undefined,
        crossOrigin: true,
      }).addTo(map);
    }
    baseRef.current && (baseRef.current as L.GridLayer).bringToBack?.();
  }, [layer, projection]);

  // Overlays (Earth only for now)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overlayRef.current.forEach((l) => map.removeLayer(l));
    overlayRef.current = overlayIds
      .map((id) => LAYER_BY_ID[id])
      .filter((l) => l && l.projection === projection)
      .map((l) =>
        L.tileLayer(l.url, {
          tileSize: 256,
          maxNativeZoom: l.maxNativeZoom,
          maxZoom: 12,
          opacity: 0.72,
          attribution: `${l.provider} · ${l.instrument}`,
        }).addTo(map),
      );
  }, [overlayIds.join("|"), projection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Markers
  useEffect(() => {
    const group = markerLayer.current;
    if (!group) return;
    group.clearLayers();
    for (const m of markers) {
      const ll = toLatLng(projection, m.lat, m.lon);
      if (!ll) continue;
      const active = m.id === activeId;
      L.marker(ll, { icon: pinIcon(m, active), zIndexOffset: active ? 1000 : m.dim ? -100 : 0, keyboard: true, title: m.label })
        .bindTooltip(m.label, { className: "sa-tip", direction: "top", offset: [0, -10] })
        .on("click", () => cb.current.onSelect?.(m.id))
        .addTo(group);
    }
  }, [markers, activeId, projection]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lat, lon, zoom, animate = true) {
        const map = mapRef.current;
        if (!map) return;
        const ll = toLatLng(projection, lat, lon);
        if (!ll) return;
        const z = zoom ?? (projection === "polar-south" ? 1 : projection === "mercator" ? 6 : 5);
        map.stop();
        if (animate) map.flyTo(ll, z, { duration: 1.1 });
        else map.setView(ll, z, { animate: false });
      },
      setMetresPerPixel(mpp) {
        const map = mapRef.current;
        if (!map) return;
        let z: number;
        if (projection === "mercator") z = zoomForMercator(map.getCenter().lat, mpp);
        else if (projection === "equirect") z = zoomForEquirect(body, mpp);
        else z = Math.log2(POLAR_METRES_PER_PIXEL / mpp);
        z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
        if (Math.abs(z - map.getZoom()) < 0.01) return;
        // Stay silent for the whole change: map.stop() itself can fire move events, and an
        // echo back to the paired map would bounce the scale between the two forever.
        silent.current = true;
        try {
          // Cancel any running fly-in first: zooming mid-animation leaves Leaflet's tile pane stuck.
          map.stop();
          map.setView(map.getCenter(), z, { animate: false });
        } finally {
          silent.current = false;
        }
      },
    }),
    [projection, body],
  );

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1">
        <div className="font-mono text-[10px] tracking-wider text-chrome uppercase">{scale.label}</div>
        <div className="h-1.5 border-x border-b border-platinum/80" style={{ width: Math.round(scale.px) }} />
      </div>
    </div>
  );
});
