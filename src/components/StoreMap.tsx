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
}

const RANK_COLOR: Record<Rank, string> = {
  S: '#f97316',
  A: '#eab308',
  B: '#3b82f6',
  C: '#94a3b8',
  D: '#ef4444',
};

interface StoreMapProps {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function StoreMap({ points, selectedId, onSelect }: StoreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userAdjustedRef = useRef(false);
  const programmaticRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([36.5, 137.5], 5);

    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
      maxZoom: 18,
    }).addTo(map);

    const markUserAdjusted = () => {
      if (!programmaticRef.current) userAdjustedRef.current = true;
    };
    map.on('dragstart', markUserAdjusted);
    map.on('zoomstart', markUserAdjusted);

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
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.45)"></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([point.latitude, point.longitude], { icon, title: point.facilityName });
      marker.bindPopup(popupElement(point));
      marker.on('click', () => onSelectRef.current?.(point.id));
      marker.addTo(map);
      markersRef.current.set(point.id, marker);
      bounds.push([point.latitude, point.longitude]);
    }

    if (!userAdjustedRef.current && bounds.length > 0) {
      programmaticRef.current = true;
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: bounds.length === 1 ? 12 : 6,
        animate: false,
      });
      programmaticRef.current = false;
    }
  }, [points, selectedId]);

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
    <div className="relative z-0 h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-full min-h-[420px] w-full" role="application" aria-label="視察店舗の地図" />
    </div>
  );
}

function popupElement(point: MapPoint): HTMLElement {
  const root = document.createElement('div');
  root.className = 'text-sm leading-snug';

  const title = document.createElement('strong');
  title.textContent = point.facilityName;
  root.appendChild(title);

  const meta = document.createElement('div');
  meta.textContent = [point.prefecture, point.dateLabel, `${point.rank} / ${point.judgmentLabel}`]
    .filter(Boolean)
    .join(' · ');
  root.appendChild(meta);

  if (point.visitCount > 1) {
    const count = document.createElement('div');
    count.textContent = `視察 ${point.visitCount} 件`;
    root.appendChild(count);
  }

  if (point.address) {
    const address = document.createElement('div');
    address.textContent = point.address;
    root.appendChild(address);
  }

  return root;
}

export function rankColor(rank: Rank): string {
  return RANK_COLOR[rank];
}
