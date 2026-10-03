import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Rank } from '@/types';

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  facilityName: string;
  prefecture?: string;
  rank: Rank;
  judgmentLabel: string;
  dateLabel: string;
  visitCount: number;
  address?: string;
  photos?: string[];
}

const RANK_COLOR: Record<Rank, string> = {
  S: '#f97316',
  A: '#eab308',
  B: '#3b82f6',
  C: '#94a3b8',
  D: '#ef4444',
};

export interface DraftPin {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface MapFocus {
  latitude: number;
  longitude: number;
  zoom?: number;
  token: number;
}

interface StoreMapProps {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  draftPin?: DraftPin | null;
  onPick?: (latitude: number, longitude: number) => void;
  focus?: MapFocus | null;
  autoFit?: boolean;
  className?: string;
}

export function StoreMap({
  points,
  selectedId,
  onSelect,
  draftPin = null,
  onPick,
  focus = null,
  autoFit = true,
  className,
}: StoreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const userAdjustedRef = useRef(false);
  const programmaticRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([36.5, 137.5], 5);

    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
      maxZoom: 18,
    }).addTo(map);

    window.setTimeout(() => map.invalidateSize(), 200);
    window.setTimeout(() => map.invalidateSize(), 700);

    const markUserAdjusted = () => {
      if (!programmaticRef.current) userAdjustedRef.current = true;
    };
    map.on('dragstart', markUserAdjusted);
    map.on('zoomstart', markUserAdjusted);
    map.on('click', (event) => {
      onPickRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userAdjustedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds: L.LatLngTuple[] = [];
    for (const point of points) {
      const selected = point.id === selectedId;
      const color = RANK_COLOR[point.rank] || RANK_COLOR.C;
      const size = selected ? 18 : 14;
      const icon = L.divIcon({
        className: 'store-pin',
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff"></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([point.latitude, point.longitude], { icon, title: point.facilityName });
      marker.bindPopup(popupElement(point), {
        className: 'store-card-popup',
        maxWidth: 280,
        minWidth: 248,
        autoPanPadding: [28, 28],
      });
      const popup = marker.getPopup();
      const content = popup?.getContent();
      if (popup && content instanceof HTMLElement) {
        content.querySelectorAll('img').forEach((image) => {
          image.addEventListener('load', () => popup.update());
        });
      }
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current?.(point.id);
      });
      marker.addTo(map);
      markersRef.current.set(point.id, marker);
      bounds.push([point.latitude, point.longitude]);
    }

    if (autoFit && !userAdjustedRef.current && !selectedId && bounds.length > 0) {
      programmaticRef.current = true;
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: bounds.length === 1 ? 12 : 6,
        animate: false,
      });
      programmaticRef.current = false;
    }
  }, [points, selectedId, autoFit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = onPick ? 'crosshair' : '';
  }, [onPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!draftPin) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    const icon = draftIcon();
    const marker = draftMarkerRef.current;
    if (!marker) {
      const created = L.marker([draftPin.latitude, draftPin.longitude], {
        icon,
        draggable: true,
        zIndexOffset: 1000,
        title: draftPin.label || '登録する位置',
      });
      created.on('dragend', () => {
        const latLng = created.getLatLng();
        onPickRef.current?.(latLng.lat, latLng.lng);
      });
      created.addTo(map);
      draftMarkerRef.current = created;
      return;
    }
    const current = marker.getLatLng();
    if (Math.abs(current.lat - draftPin.latitude) > 0.0000001 || Math.abs(current.lng - draftPin.longitude) > 0.0000001) {
      marker.setLatLng([draftPin.latitude, draftPin.longitude]);
    }
    marker.setIcon(icon);
  }, [draftPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    programmaticRef.current = true;
    map.once('moveend', () => {
      programmaticRef.current = false;
    });
    map.flyTo([focus.latitude, focus.longitude], focus.zoom ?? 15, { duration: 0.45 });
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    const targetZoom = Math.max(map.getZoom(), 13);
    map.flyTo(marker.getLatLng(), targetZoom, { duration: 0.5 });
    marker.openPopup();
  }, [selectedId, points]);

  return (
    <div className={`relative z-0 overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f5f2] ${className ?? 'h-full min-h-[420px]'}`}>
      <div ref={containerRef} className="h-full w-full" role="application" aria-label="視察店舗の地図" />
    </div>
  );
}

function popupElement(point: MapPoint): HTMLElement {
  const root = document.createElement('div');
  root.className = 'store-card';

  const photos = (point.photos || []).filter((url) => url.startsWith('https://') || url.startsWith('http://'));
  if (photos.length > 0) {
    root.appendChild(photoStrip(photos, point.facilityName));
  }

  const body = document.createElement('div');
  body.className = 'store-card-body';

  const title = document.createElement('div');
  title.className = 'store-card-title';
  title.textContent = point.facilityName;
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'store-card-meta';
  const dot = document.createElement('span');
  dot.className = 'store-card-dot';
  dot.style.background = RANK_COLOR[point.rank] || RANK_COLOR.C;
  meta.appendChild(dot);
  const metaText = document.createElement('span');
  metaText.textContent = [point.prefecture, point.dateLabel, `${point.rank} / ${point.judgmentLabel}`]
    .filter(Boolean)
    .join(' · ');
  meta.appendChild(metaText);
  body.appendChild(meta);

  if (point.visitCount > 1) {
    const count = document.createElement('div');
    count.className = 'store-card-count';
    count.textContent = `この店舗の視察 ${point.visitCount} 件`;
    body.appendChild(count);
  }

  if (point.address) {
    const address = document.createElement('div');
    address.className = 'store-card-address';
    address.textContent = point.address;
    body.appendChild(address);
  }

  const nav = document.createElement('a');
  nav.className = 'store-card-nav';
  nav.href = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`;
  nav.target = '_blank';
  nav.rel = 'noopener noreferrer';
  nav.textContent = 'Googleマップでナビ';
  body.appendChild(nav);

  root.appendChild(body);
  return root;
}

function photoStrip(photos: string[], name: string): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'store-card-photos';
  const image = document.createElement('img');
  image.alt = name;
  image.src = photos[0];
  frame.appendChild(image);

  if (photos.length === 1) return frame;

  let index = 0;
  const counter = document.createElement('div');
  counter.className = 'store-card-photo-count';
  counter.textContent = `1 / ${photos.length}`;
  frame.appendChild(counter);

  const show = (next: number) => {
    index = (next + photos.length) % photos.length;
    image.src = photos[index];
    counter.textContent = `${index + 1} / ${photos.length}`;
  };
  frame.appendChild(photoButton('前の写真', '‹', () => show(index - 1), 'left'));
  frame.appendChild(photoButton('次の写真', '›', () => show(index + 1), 'right'));
  return frame;
}

function photoButton(label: string, glyph: string, onClick: () => void, side: 'left' | 'right'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `store-card-photo-nav store-card-photo-nav-${side}`;
  button.setAttribute('aria-label', label);
  button.textContent = glyph;
  button.addEventListener('click', (event) => {
    L.DomEvent.stop(event);
    onClick();
  });
  return button;
}

function draftIcon(): L.DivIcon {
  return L.divIcon({
    className: 'store-pin',
    html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#ea580c;border:3px solid #fff;box-shadow:0 2px 8px rgba(234,88,12,.55)"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function rankColor(rank: Rank): string {
  return RANK_COLOR[rank];
}
