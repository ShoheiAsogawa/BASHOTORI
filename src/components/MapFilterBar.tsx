import { useState, type ReactNode } from 'react';
import { JUDGMENT } from '../lib/constants';
import {
  compareGroups,
  groupHasPhoto,
  groupMatches,
  hasActiveVisitFilter,
  type FilterableGroup,
  type VisitFilterState,
  type VisitSort,
} from '../lib/visitFilters';
import { PREFECTURES } from '../types';
import { Icon } from './Icon';

interface MapFilterBarProps {
  state: VisitFilterState;
  groups: FilterableGroup[];
  resultCount: number;
  onChange: (state: VisitFilterState) => void;
}

const RANK_STYLE: Record<string, { color: string; label: string }> = {
  S: { color: '#f97316', label: '超優良' },
  A: { color: '#eab308', label: '期待大' },
  B: { color: '#3b82f6', label: '標準' },
  C: { color: '#94a3b8', label: '検討' },
  D: { color: '#ef4444', label: '厳しい' },
};

const JUDGMENT_COLOR: Record<string, string> = {
  pending: '#64748b',
  negotiating: '#2563eb',
  approved: '#059669',
  rejected: '#dc2626',
};

const SORTS: { value: VisitSort; label: string }[] = [
  { value: 'date', label: '新しい順' },
  { value: 'rank', label: 'ランク順' },
  { value: 'name', label: '名前順' },
];

const PERIODS: { days: number | null; label: string }[] = [
  { days: null, label: 'すべて' },
  { days: 30, label: '30日' },
  { days: 90, label: '3か月' },
  { days: 365, label: '1年' },
];

const PREFECTURE_PREVIEW = 8;

export function MapFilterBar({ state, groups, resultCount, onChange }: MapFilterBarProps) {
  const [showAllPrefectures, setShowAllPrefectures] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const patch = (partial: Partial<VisitFilterState>) => onChange({ ...state, ...partial });
  const active = hasActiveVisitFilter(state);
  const photoCount = groups.filter((group) => groupMatches(group, state, 'photo') && groupHasPhoto(group)).length;
  const prefectureOptions = PREFECTURES
    .filter((prefecture) => groups.some((group) => group.latest.prefecture === prefecture))
    .map((prefecture) => ({
      prefecture,
      count: groups.filter((group) => groupMatches(group, state, 'prefecture') && group.latest.prefecture === prefecture).length,
    }))
    .sort((a, b) => {
      const selected = Number(state.prefectures.includes(b.prefecture)) - Number(state.prefectures.includes(a.prefecture));
      return selected || b.count - a.count;
    });
  const visiblePrefectures = showAllPrefectures ? prefectureOptions : prefectureOptions.slice(0, PREFECTURE_PREVIEW);
  const activePeriod = PERIODS.find((period) => (
    period.days === null ? !state.from && !state.to : !state.to && state.from === daysAgo(period.days)
  ));
  const customDates = showCustomDates || (!activePeriod && Boolean(state.from || state.to));

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="絞り込み">
      <div className="border-b border-slate-100 p-3 sm:p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="Search" size={18} />
          </span>
          <input
            type="search"
            value={state.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder="施設名・住所・担当者で探す"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {state.query && (
            <button
              type="button"
              onClick={() => patch({ query: '' })}
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300"
              aria-label="検索文字を消す"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 p-3 sm:p-4 lg:grid-cols-2">
        <Field label="ランク">
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(RANK_STYLE).map(([rank, style]) => {
              const selected = state.ranks.includes(rank);
              const count = groups.filter((group) => groupMatches(group, state, 'rank') && group.latest.rank === rank).length;
              const disabled = count === 0 && !selected;
              return (
                <button
                  key={rank}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`ランク${rank}（${style.label}）${count}件`}
                  disabled={disabled}
                  onClick={() => patch({ ranks: toggle(state.ranks, rank) })}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-xl border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected ? 'text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  style={selected ? { background: style.color, borderColor: style.color } : undefined}
                >
                  <span className="text-lg font-black leading-none" style={selected ? undefined : { color: style.color }}>{rank}</span>
                  <span className={`mt-1 text-[11px] font-bold leading-none ${selected ? 'text-white/85' : 'text-slate-400'}`}>{count}</span>
                  {selected && <CheckBadge />}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="判定">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {Object.entries(JUDGMENT).map(([key, info]) => {
              const selected = state.judgments.includes(key);
              const count = groups.filter((group) => groupMatches(group, state, 'judgment') && group.latest.judgment === key).length;
              const color = JUDGMENT_COLOR[key] || '#64748b';
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  disabled={count === 0 && !selected}
                  onClick={() => patch({ judgments: toggle(state.judgments, key) })}
                  className={`flex h-14 items-center gap-2 rounded-xl border-2 px-3 text-left transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected ? 'text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  style={selected ? { background: color, borderColor: color } : undefined}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={selected ? { background: 'rgba(255,255,255,.2)' } : { background: `${color}1a`, color }}
                  >
                    <Icon name={info.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold leading-tight">{info.label}</span>
                    <span className={`block text-[11px] font-bold leading-tight ${selected ? 'text-white/80' : 'text-slate-400'}`}>{count} 件</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="視察日">
          <Segmented>
            {PERIODS.map((period) => {
              const selected = !customDates && activePeriod === period;
              return (
                <SegmentButton
                  key={period.label}
                  selected={selected}
                  onClick={() => {
                    setShowCustomDates(false);
                    patch({ from: period.days === null ? '' : daysAgo(period.days), to: '' });
                  }}
                >
                  {period.label}
                </SegmentButton>
              );
            })}
            <SegmentButton selected={customDates} onClick={() => setShowCustomDates(true)}>
              指定
            </SegmentButton>
          </Segmented>
          {customDates && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                aria-label="開始日"
                value={state.from}
                max={state.to || undefined}
                onChange={(event) => patch({ from: event.target.value })}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
              <span className="text-sm font-bold text-slate-400">〜</span>
              <input
                type="date"
                aria-label="終了日"
                value={state.to}
                min={state.from || undefined}
                onChange={(event) => patch({ to: event.target.value })}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>
          )}
        </Field>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <Field label="写真">
            <button
              type="button"
              role="switch"
              aria-checked={state.photosOnly}
              disabled={photoCount === 0 && !state.photosOnly}
              onClick={() => patch({ photosOnly: !state.photosOnly })}
              className={`flex h-11 items-center gap-2.5 rounded-xl border-2 px-3 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
                state.photosOnly ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`relative h-5 w-9 rounded-full transition ${state.photosOnly ? 'bg-orange-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${state.photosOnly ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              <span className="whitespace-nowrap">あり <span className="text-xs opacity-60">{photoCount}</span></span>
            </button>
          </Field>
          <Field label="並び">
            <Segmented>
              {SORTS.map((sort) => (
                <SegmentButton key={sort.value} selected={state.sort === sort.value} onClick={() => patch({ sort: sort.value })}>
                  {sort.label}
                </SegmentButton>
              ))}
            </Segmented>
          </Field>
        </div>

        {prefectureOptions.length > 0 && (
          <div className="lg:col-span-2">
            <Field label="都道府県">
              <div className="flex flex-wrap gap-1.5">
                {visiblePrefectures.map(({ prefecture, count }) => {
                  const selected = state.prefectures.includes(prefecture);
                  return (
                    <button
                      key={prefecture}
                      type="button"
                      aria-pressed={selected}
                      disabled={count === 0 && !selected}
                      onClick={() => patch({ prefectures: toggle(state.prefectures, prefecture) })}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {selected && <Icon name="Check" size={14} />}
                      {shortPrefecture(prefecture)}
                      <span className={`text-xs ${selected ? 'text-white/70' : 'text-slate-400'}`}>{count}</span>
                    </button>
                  );
                })}
                {prefectureOptions.length > PREFECTURE_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllPrefectures((value) => !value)}
                    className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-orange-600 transition hover:bg-orange-50"
                  >
                    {showAllPrefectures ? '閉じる' : `ほか ${prefectureOptions.length - PREFECTURE_PREVIEW}`}
                    <Icon name={showAllPrefectures ? 'ChevronUp' : 'ChevronDown'} size={14} />
                  </button>
                )}
              </div>
            </Field>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-3 py-3 sm:px-4">
        <p className="text-slate-500">
          <span className="text-2xl font-black text-slate-900">{resultCount}</span>
          <span className="ml-1 text-sm font-bold">件</span>
          <span className="ml-2 text-xs font-medium">全 {groups.length} 店舗</span>
        </p>
        {active && (
          <button
            type="button"
            onClick={() => {
              setShowCustomDates(false);
              onChange({ ...state, query: '', ranks: [], judgments: [], prefectures: [], photosOnly: false, from: '', to: '' });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
          >
            <Icon name="X" size={15} />
            条件をクリア
          </button>
        )}
      </div>
    </section>
  );
}

export function sortGroups<T extends FilterableGroup>(groups: T[], sort: VisitSort): T[] {
  return [...groups].sort((a, b) => compareGroups(a, b, sort));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function Segmented({ children }: { children: ReactNode }) {
  return <div className="flex h-11 rounded-xl bg-slate-100 p-1">{children}</div>;
}

function SegmentButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 text-sm font-bold transition ${
        selected ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function CheckBadge() {
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white">
      <Icon name="Check" size={11} />
    </span>
  );
}

function shortPrefecture(prefecture: string): string {
  if (prefecture === '北海道') return prefecture;
  return prefecture.replace(/[都府県]$/, '');
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
