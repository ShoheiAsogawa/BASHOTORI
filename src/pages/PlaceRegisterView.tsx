import { useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Icon } from '../components/Icon';
import { StoreMap, type MapFocus, type MapPoint } from '../components/StoreMap';
import { isAdmin } from '../lib/auth';
import { getCurrentLocation } from '../lib/location';
import { locationKey, prefectureCenter, scorePlace, searchPlaces, suggestPlaces, type PoiPlace } from '../lib/openpoi';
import { getStoreVisits, reverseGeocodePin, saveStoreVisit, type VisitWrite } from '../lib/supabase';
import { formatDate, formatDateJP } from '../lib/utils';
import { PREFECTURES, type StoreVisit } from '../types';

type PinFilter = 'missing' | 'located' | 'all';

interface FacilityGroup {
  key: string;
  visits: StoreVisit[];
  latest: StoreVisit;
  located: boolean;
}

interface EditorState {
  mode: 'existing' | 'new';
  key: string | null;
  visitIds: string[];
  facilityName: string;
  prefecture: string;
  address: string;
  staffName: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  poiName: string;
  poiLicenses: string[];
  poiAttributions: string[];
  pinTouched: boolean;
  cleared: boolean;
}

const EMPTY_EDITOR: EditorState = {
  mode: 'new',
  key: null,
  visitIds: [],
  facilityName: '',
  prefecture: '',
  address: '',
  staffName: '',
  date: formatDate(new Date()),
  latitude: null,
  longitude: null,
  poiName: '',
  poiLicenses: [],
  poiAttributions: [],
  pinTouched: false,
  cleared: false,
};

export default function PlaceRegisterView() {
  const [visits, setVisits] = useState<StoreVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [filter, setFilter] = useState<PinFilter>('missing');
  const [searchTerm, setSearchTerm] = useState('');
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [candidates, setCandidates] = useState<PoiPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const addressRef = useRef('');
  addressRef.current = editor.address;

  const load = async () => {
    const data = await getStoreVisits();
    setVisits(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStoreVisits(), isAdmin()])
      .then(([data, isAdminUser]) => {
        if (cancelled) return;
        setVisits(data);
        setAdmin(isAdminUser);
      })
      .catch(() => {
        if (!cancelled) setError('視察記録を読み込めませんでした。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupVisits(visits), [visits]);
  const missingCount = groups.filter((group) => !group.located).length;
  const locatedCount = groups.length - missingCount;

  const visibleGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return groups.filter((group) => {
      if (!query && filter === 'missing' && group.located) return false;
      if (!query && filter === 'located' && !group.located) return false;
      if (!query) return true;
      const blob = `${group.latest.facilityName} ${group.latest.prefecture || ''} ${group.latest.address || ''}`.toLowerCase();
      return blob.includes(query);
    });
  }, [groups, filter, searchTerm]);

  const contextPoints: MapPoint[] = useMemo(() => {
    return groups.flatMap((group) => {
      if (group.key === editor.key) return [];
      const place = storedCoordinates(group.visits);
      if (!place) return [];
      return [{
        id: group.key,
        latitude: place.latitude,
        longitude: place.longitude,
        facilityName: group.latest.facilityName,
        prefecture: group.latest.prefecture,
        rank: group.latest.rank,
        judgmentLabel: '',
        dateLabel: formatDateJP(group.latest.date),
        visitCount: group.visits.length,
        address: place.address,
      }];
    });
  }, [groups, editor.key]);

  const openedRef = useRef(false);

  const selectGroup = (group: FacilityGroup) => {
    const place = storedCoordinates(group.visits);
    const next: EditorState = {
      mode: 'existing',
      key: group.key,
      visitIds: group.visits.map((visit) => visit.id),
      facilityName: group.latest.facilityName,
      prefecture: group.latest.prefecture || '',
      address: place?.address || group.latest.address || '',
      staffName: group.latest.staffName,
      date: group.latest.date,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      poiName: place?.poiName || '',
      poiLicenses: place?.poiLicenses || [],
      poiAttributions: place?.poiAttributions || [],
      pinTouched: false,
      cleared: false,
    };
    setEditor(next);
    setCandidates([]);
    setNotice('');
    setError('');
    moveMap(next.latitude, next.longitude, next.prefecture, Boolean(place));
  };

  useEffect(() => {
    if (loading || openedRef.current || groups.length === 0) return;
    openedRef.current = true;
    const first = groups.find((group) => !group.located) || groups[0];
    selectGroup(first);
  }, [loading, groups]);

  const startNew = () => {
    setEditor({ ...EMPTY_EDITOR, date: formatDate(new Date()) });
    setCandidates([]);
    setNotice('');
    setError('');
    setFocus({ latitude: 36.2, longitude: 137.5, zoom: 5, token: Date.now() });
  };

  const moveMap = (latitude: number | null, longitude: number | null, prefecture: string, hasPin: boolean) => {
    if (latitude != null && longitude != null) {
      setFocus({ latitude, longitude, zoom: hasPin ? 16 : 15, token: Date.now() });
      return;
    }
    const center = prefectureCenter(prefecture);
    if (center) setFocus({ ...center, zoom: 10, token: Date.now() });
  };

  const placePin = (latitude: number, longitude: number) => {
    if (!admin) return;
    setEditor((prev) => ({
      ...prev,
      latitude,
      longitude,
      pinTouched: true,
      cleared: false,
      poiName: prev.facilityName.trim() || prev.poiName,
      poiLicenses: [],
      poiAttributions: [],
    }));
    setError('');
  };

  useEffect(() => {
    if (!editor.pinTouched || editor.latitude == null || editor.longitude == null) return;
    if (addressRef.current.trim()) return;
    const latitude = editor.latitude;
    const longitude = editor.longitude;
    let cancelled = false;
    setLookingUp(true);
    const timer = window.setTimeout(() => {
      reverseGeocodePin(latitude, longitude)
        .then((place) => {
          if (cancelled || addressRef.current.trim()) return;
          setEditor((prev) => ({
            ...prev,
            address: place.address,
            prefecture: prev.prefecture || place.prefecture,
          }));
        })
        .catch(() => {
          if (!cancelled) setError('ピンの住所は取得できませんでした。住所欄に直接入力できます。');
        })
        .finally(() => {
          if (!cancelled) setLookingUp(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editor.pinTouched, editor.latitude, editor.longitude]);

  const searchFacilities = async () => {
    const query = (editor.facilityName || editor.address).trim();
    if (query.length < 2) {
      setError('店舗名か住所を2文字以上入力してから検索してください。');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const [suggested, searched] = await Promise.all([
        suggestPlaces(query, 6),
        searchPlaces(query, 8, undefined),
      ]);
      const seen = new Set<string>();
      const merged: PoiPlace[] = [];
      for (const place of [...suggested, ...searched]) {
        const key = `${place.latitude.toFixed(4)}|${place.longitude.toFixed(4)}|${place.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(place);
      }
      merged.sort((left, right) => scorePlace(query, editor.prefecture || undefined, right) - scorePlace(query, editor.prefecture || undefined, left));
      setCandidates(merged.slice(0, 6));
      if (merged.length === 0) setError('候補が見つかりません。地図をクリックしてピンを置いてください。');
    } catch (searchError) {
      console.error(searchError);
      setError('施設検索に失敗しました。');
    } finally {
      setSearching(false);
    }
  };

  const applyCandidate = (place: PoiPlace) => {
    setEditor((prev) => ({
      ...prev,
      facilityName: prev.mode === 'new' && !prev.facilityName.trim() ? place.name : prev.facilityName,
      prefecture: place.prefecture || prev.prefecture,
      address: place.address || prev.address,
      latitude: place.latitude,
      longitude: place.longitude,
      poiName: place.name,
      poiLicenses: place.licenses,
      poiAttributions: place.attributions,
      pinTouched: true,
      cleared: false,
    }));
    setFocus({ latitude: place.latitude, longitude: place.longitude, zoom: 16, token: Date.now() });
    setNotice(`${place.name} の位置をピンにしました。保存するまで記録は変わりません。`);
    setError('');
  };

  const fillAddressFromPin = async () => {
    if (editor.latitude == null || editor.longitude == null) return;
    setLookingUp(true);
    setError('');
    try {
      const place = await reverseGeocodePin(editor.latitude, editor.longitude);
      setEditor((prev) => ({
        ...prev,
        address: place.address,
        prefecture: prev.prefecture || place.prefecture,
      }));
    } catch (lookupError) {
      console.error(lookupError);
      setError('ピンの住所は取得できませんでした。');
    } finally {
      setLookingUp(false);
    }
  };

  const useCurrentLocation = async () => {
    setError('');
    try {
      const here = await getCurrentLocation();
      placePin(here.latitude, here.longitude);
      setFocus({ latitude: here.latitude, longitude: here.longitude, zoom: 16, token: Date.now() });
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : '現在地を取得できませんでした。');
    }
  };

  const clearPin = () => {
    setEditor((prev) => ({
      ...prev,
      latitude: null,
      longitude: null,
      pinTouched: false,
      cleared: true,
      poiName: '',
      poiLicenses: [],
      poiAttributions: [],
    }));
  };

  const save = async () => {
    const facilityName = editor.facilityName.trim();
    if (!facilityName) {
      setError('店舗名を入力してください。');
      return;
    }
    if (editor.mode === 'new' && !editor.staffName.trim()) {
      setError('新しい記録には担当者名が必要です。');
      return;
    }
    if (editor.mode === 'new' && !editor.date) {
      setError('視察日を入力してください。');
      return;
    }
    if ((editor.latitude == null) !== (editor.longitude == null)) {
      setError('ピンは緯度と経度の両方を指定してください。');
      return;
    }
    if (editor.latitude != null && editor.longitude != null && !inJapan(editor.latitude, editor.longitude)) {
      setError('日本国内の位置を指定してください。');
      return;
    }

    const payload: VisitWrite = {
      facilityName,
      prefecture: (editor.prefecture || null) as VisitWrite['prefecture'],
      address: editor.address.trim() || null,
      latitude: editor.latitude,
      longitude: editor.longitude,
      poiName: editor.poiName || facilityName,
      poiLicenses: editor.poiLicenses,
      poiAttributions: editor.poiAttributions,
      skipGeocode: editor.cleared || editor.pinTouched || editor.latitude != null,
    };

    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editor.mode === 'new') {
        const saved = await saveStoreVisit({
          ...payload,
          date: editor.date,
          staffName: editor.staffName.trim(),
          rank: 'B',
          judgment: 'pending',
          environment: '屋内',
          imitationTable: '設置可',
        });
        const data = await load();
        const group = groupVisits(data).find((item) => item.visits.some((visit) => visit.id === saved.id));
        if (group) {
          setFilter(group.located ? 'located' : 'missing');
          setSearchTerm('');
          selectGroup(group);
        }
        setNotice('新しい店舗を登録しました。ランクなどの詳細はカレンダーから追記できます。');
      } else {
        for (const id of editor.visitIds) {
          await saveStoreVisit({ id, ...payload });
        }
        const data = await load();
        const group = groupVisits(data).find((item) => item.key === locationKey(facilityName, editor.prefecture || undefined));
        if (group) {
          setFilter(group.located ? 'located' : 'missing');
          setSearchTerm('');
          selectGroup(group);
        }
        setNotice(`同じ店舗の視察 ${editor.visitIds.length} 件に、名前・住所・ピンを保存しました。`);
      }
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const draftPin = editor.latitude != null && editor.longitude != null
    ? { latitude: editor.latitude, longitude: editor.longitude, label: editor.facilityName || '新しい店舗' }
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Icon name="Compass" className="text-orange-500" /> 場所の登録
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                登録済みの視察に住所と地図ピンを後から足せます。新しい店舗も、名前・住所・ピンで追加できます。
              </p>
            </div>
            <div className="text-sm font-bold text-slate-600">
              ピンなし {missingCount} 店舗 / ピンあり {locatedCount} 店舗
            </div>
          </div>

          {!admin && !loading && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              閲覧専用のため、場所の保存はできません。
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</div>
          )}
          {notice && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
          )}

          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {([
                ['missing', 'ピンなし'],
                ['located', 'ピンあり'],
                ['all', 'すべて'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ${filter === value ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="店舗名・住所・都道府県で絞り込み（ピンの有無は問わない）"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
            {admin && (
              <button
                type="button"
                onClick={startNew}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-700"
              >
                <span className="inline-flex items-center gap-1"><Icon name="Plus" size={16} /> 新しい店舗</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">読み込み中...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white lg:max-h-[calc(100vh-220px)]">
                {visibleGroups.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">該当する店舗がありません。</p>
                ) : (
                  <ul>
                    {visibleGroups.map((group) => {
                      const selected = editor.mode === 'existing' && editor.key === group.key;
                      const stored = storedCoordinates(group.visits);
                      return (
                        <li key={group.key} className="border-b border-slate-100 last:border-0">
                          <button
                            type="button"
                            onClick={() => selectGroup(group)}
                            className={`w-full px-4 py-3 text-left ${selected ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                          >
                            <span className="block truncate text-sm font-bold text-slate-800">{group.latest.facilityName}</span>
                            <span className="block text-xs text-slate-500">
                              {group.latest.prefecture || '都道府県なし'} · 視察 {group.visits.length} 件 · {formatDateJP(group.latest.date)}
                            </span>
                            <span className={`block text-xs ${group.located ? 'text-slate-400' : 'text-orange-600'}`}>
                              {group.located ? (stored?.address || group.latest.address || 'ピン登録済み') : '住所とピンが未登録'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                <form
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <h3 className="mb-3 text-sm font-bold text-slate-800">
                    {editor.mode === 'new' ? '新しい店舗' : '選択中の店舗'}
                  </h3>
                  <label className="mb-3 block text-xs font-bold text-slate-500">
                    店舗名
                    <input
                      value={editor.facilityName}
                      disabled={!admin}
                      onChange={(event) => setEditor((prev) => ({ ...prev, facilityName: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="mb-3 block text-xs font-bold text-slate-500">
                    都道府県
                    <select
                      value={editor.prefecture}
                      disabled={!admin}
                      onChange={(event) => {
                        const prefecture = event.target.value;
                        setEditor((prev) => ({ ...prev, prefecture }));
                        if (editor.latitude == null) moveMap(null, null, prefecture, false);
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50"
                    >
                      <option value="">未選択</option>
                      {PREFECTURES.map((prefecture) => (
                        <option key={prefecture} value={prefecture}>{prefecture}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mb-3 block text-xs font-bold text-slate-500">
                    住所
                    <textarea
                      value={editor.address}
                      disabled={!admin}
                      rows={3}
                      onChange={(event) => setEditor((prev) => ({ ...prev, address: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50"
                    />
                  </label>
                  {editor.mode === 'new' && (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">
                        担当者
                        <input
                          value={editor.staffName}
                          disabled={!admin}
                          onChange={(event) => setEditor((prev) => ({ ...prev, staffName: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-500">
                        視察日
                        <input
                          type="date"
                          value={editor.date}
                          disabled={!admin}
                          onChange={(event) => setEditor((prev) => ({ ...prev, date: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </label>
                    </div>
                  )}
                  <p className="mb-3 text-xs text-slate-500">
                    {editor.latitude != null && editor.longitude != null
                      ? `ピン ${editor.latitude.toFixed(5)}, ${editor.longitude.toFixed(5)}`
                      : 'ピンは未設定です。地図をクリックするか、施設検索で置けます。'}
                    {lookingUp ? ' 住所を調べています。' : ''}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button type="button" disabled={!admin || searching} onClick={() => void searchFacilities()} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                      {searching ? '検索中...' : '名前・住所から探す'}
                    </button>
                    <button type="button" disabled={!admin || editor.latitude == null} onClick={() => void fillAddressFromPin()} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                      ピンから住所
                    </button>
                    <button type="button" disabled={!admin} onClick={() => void useCurrentLocation()} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                      現在地
                    </button>
                    <button type="button" disabled={!admin || editor.latitude == null} onClick={clearPin} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                      ピンを外す
                    </button>
                  </div>
                  {candidates.length > 0 && (
                    <ul className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-slate-200">
                      {candidates.map((place) => (
                        <li key={`${place.latitude}-${place.longitude}-${place.name}`} className="border-b border-slate-100 last:border-0">
                          <button type="button" disabled={!admin} onClick={() => applyCandidate(place)} className="w-full px-3 py-2 text-left hover:bg-orange-50 disabled:opacity-50">
                            <span className="block text-sm font-bold text-slate-800">{place.name}</span>
                            <span className="block text-xs text-slate-500">{place.prefecture} {place.address}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {editor.mode === 'existing' && (
                    <p className="mb-3 text-xs text-slate-500">
                      保存すると、この店舗名の視察 {editor.visitIds.length} 件すべてに同じ住所とピンが入ります。
                    </p>
                  )}
                  {editor.mode === 'new' && (
                    <p className="mb-3 text-xs text-slate-500">
                      ランクは B、判定は未定で下書きします。詳しい視察内容はあとからカレンダーで追記できます。
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!admin || saving || (editor.mode === 'existing' && editor.visitIds.length === 0)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Icon name="Save" size={16} /> {saving ? '保存中...' : '保存する'}
                  </button>
                </form>
                <div>
                  <StoreMap
                    points={contextPoints}
                    draftPin={draftPin}
                    onPick={admin ? placePin : undefined}
                    focus={focus}
                    autoFit={false}
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    地図をクリックするとピンを置けます。オレンジのピンはドラッグでも動かせます。地図は国土地理院、施設検索は OpenPOI API です。
                  </p>
                </div>
              </div>
            </div>
          )}
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
  return Array.from(grouped.entries())
    .map(([key, list]) => {
      const visitsInGroup = [...list].sort((left, right) => right.date.localeCompare(left.date));
      return {
        key,
        visits: visitsInGroup,
        latest: visitsInGroup[0],
        located: visitsInGroup.some((visit) => Number.isFinite(visit.latitude) && Number.isFinite(visit.longitude)),
      };
    })
    .sort((left, right) => left.latest.facilityName.localeCompare(right.latest.facilityName, 'ja'));
}

function storedCoordinates(visits: StoreVisit[]): {
  latitude: number;
  longitude: number;
  address: string;
  poiName: string;
  poiLicenses: string[];
  poiAttributions: string[];
} | null {
  const visit = visits.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  if (!visit || visit.latitude == null || visit.longitude == null) return null;
  return {
    latitude: visit.latitude,
    longitude: visit.longitude,
    address: visit.address || '',
    poiName: visit.poiName || '',
    poiLicenses: visit.poiLicenses || [],
    poiAttributions: visit.poiAttributions || [],
  };
}

function inJapan(latitude: number, longitude: number): boolean {
  return latitude >= 24 && latitude <= 46.5 && longitude >= 122 && longitude <= 154;
}
