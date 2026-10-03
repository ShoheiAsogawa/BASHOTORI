import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Icon } from '../components/Icon';
import { StoreMap, rankColor, type MapPoint } from '../components/StoreMap';
import { getStoreVisits } from '../lib/supabase';
import { JUDGMENT, RANKS } from '../lib/constants';
import { locationKey, type PoiPlace } from '../lib/openpoi';
import { formatDateJP } from '../lib/utils';
import type { StoreVisit } from '../types';

interface FacilityGroup {
  key: string;
  visits: StoreVisit[];
  latest: StoreVisit;
}

export default function MapView() {
  const [visits, setVisits] = useState<StoreVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState('ALL');
  const [filterJudgment, setFilterJudgment] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    getStoreVisits()
      .then(setVisits)
      .catch((loadError: unknown) => {
        console.error(loadError);
        setError('視察記録を読み込めませんでした。');
      })
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupVisits(visits), [visits]);

  const rows = useMemo(() => {
    return groups
      .map((group) => ({ group, place: storedPlace(group.visits) }))
      .filter(({ group }) => {
        const latest = group.latest;
        const matchesSearch =
          !searchTerm ||
          latest.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (latest.prefecture || '').includes(searchTerm);
        const matchesRank = filterRank === 'ALL' || latest.rank === filterRank;
        const matchesJudgment = filterJudgment === 'ALL' || latest.judgment === filterJudgment;
        return matchesSearch && matchesRank && matchesJudgment;
      });
  }, [groups, searchTerm, filterRank, filterJudgment]);

  const points: MapPoint[] = rows.flatMap(({ group, place }) => {
    if (!place) return [];
    return [{
      id: group.key,
      latitude: place.latitude,
      longitude: place.longitude,
      facilityName: group.latest.facilityName,
      prefecture: group.latest.prefecture,
      rank: group.latest.rank,
      judgmentLabel: (JUDGMENT[group.latest.judgment] || JUDGMENT.pending).label,
      dateLabel: formatDateJP(group.latest.date),
      visitCount: group.visits.length,
      address: place.address || group.latest.address,
      photos: photoUrls(group.visits),
    }];
  });

  const unresolved = rows.filter(({ place }) => place === null);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Icon name="MapPin" className="text-orange-500" /> 視察マップ
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                保存済みの位置だけを表示します。ピンの色は最新のランクです。
              </p>
            </div>
            <div className="text-sm font-bold text-slate-600">
              {points.length} 件を表示
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="施設名・都道府県で絞り込み"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              value={filterRank}
              onChange={(event) => setFilterRank(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600"
            >
              <option value="ALL">全ランク</option>
              {Object.keys(RANKS).map((rank) => (
                <option key={rank} value={rank}>{rank}</option>
              ))}
            </select>
            <select
              value={filterJudgment}
              onChange={(event) => setFilterJudgment(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600"
            >
              <option value="ALL">全判定</option>
              {Object.entries(JUDGMENT).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">読み込み中...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white lg:max-h-[calc(100vh-220px)]">
                {rows.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">表示できる視察記録がありません。</p>
                ) : (
                  <ul>
                    {rows.map(({ group, place }) => {
                      const selected = selectedId === group.key;
                      const judgment = JUDGMENT[group.latest.judgment] || JUDGMENT.pending;
                      return (
                        <li key={group.key} className="border-b border-slate-100 last:border-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (place) setSelectedId(group.key);
                            }}
                            className={`w-full px-4 py-3 text-left ${selected ? 'bg-orange-50' : 'hover:bg-slate-50'} ${place ? '' : 'cursor-default'}`}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: place ? rankColor(group.latest.rank) : '#cbd5e1' }}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-slate-800">{group.latest.facilityName}</span>
                                <span className="block text-xs text-slate-500">
                                  {group.latest.prefecture || '都道府県なし'} · {group.latest.rank} · {judgment.label}
                                  {group.visits.length > 1 ? ` · ${group.visits.length}件` : ''}
                                </span>
                                <span className="block text-xs text-slate-400">
                                  {place ? (place.address || place.name) : '位置未登録'}
                                </span>
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <StoreMap points={points} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          )}

          {!loading && unresolved.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {unresolved.length} 件は地図に載っていません。
              <Link to="/places" className="ml-1 font-bold text-orange-600 underline">場所の登録</Link>
              から住所とピンを後から追加できます。
            </p>
          )}

          <p className="mt-4 text-xs text-slate-400">
            地図:{' '}
            <a
              href="https://maps.gsi.go.jp/development/ichiran.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              国土地理院（淡色地図）
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function groupVisits(visits: StoreVisit[]): FacilityGroup[] {
  const grouped = new Map<string, StoreVisit[]>();
  for (const visit of visits) {
    const key = locationKey(visit.facilityName, visit.prefecture);
    const list = grouped.get(key) ?? [];
    list.push(visit);
    grouped.set(key, list);
  }
  return Array.from(grouped.entries()).map(([key, list]) => {
    const visitsInGroup = [...list].sort((a, b) => b.date.localeCompare(a.date));
    return { key, visits: visitsInGroup, latest: visitsInGroup[0] };
  });
}

function photoUrls(visits: StoreVisit[]): string[] {
  const urls: string[] = [];
  for (const visit of visits) {
    for (const url of parsePhotoUrls(visit.photoUrl)) {
      if (!urls.includes(url)) urls.push(url);
      if (urls.length >= 6) return urls;
    }
  }
  return urls;
}

function parsePhotoUrls(photoUrl: string | undefined): string[] {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item : item?.url))
        .filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));
    }
  } catch {
    if (/^https?:\/\//.test(photoUrl)) return [photoUrl];
  }
  return [];
}

function storedPlace(visits: StoreVisit[]): PoiPlace | null {
  const visit = visits.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  if (!visit || visit.latitude == null || visit.longitude == null) return null;
  return {
    name: visit.poiName || visit.facilityName,
    address: visit.address || '',
    prefecture: visit.prefecture || '',
    city: '',
    latitude: visit.latitude,
    longitude: visit.longitude,
    level: null,
    licenses: visit.poiLicenses || [],
    attributions: visit.poiAttributions || [],
  };
}
