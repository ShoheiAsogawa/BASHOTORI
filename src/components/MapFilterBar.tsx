import type { ReactNode } from 'react';
import { JUDGMENT, RANKS } from '../lib/constants';
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

export function MapFilterBar({ state, groups, resultCount, onChange }: MapFilterBarProps) {
  const patch = (partial: Partial<VisitFilterState>) => onChange({ ...state, ...partial });
  const active = hasActiveVisitFilter(state);
  const photoCount = groups.filter((group) => groupMatches(group, state, 'photo') && groupHasPhoto(group)).length;
  const prefectureOptions = PREFECTURES.filter((prefecture) => groups.some((group) => group.latest.prefecture === prefecture));

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="絞り込み">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="Search" size={16} />
        </span>
        <input
          type="search"
          value={state.query}
          onChange={(event) => patch({ query: event.target.value })}
          placeholder="施設名・住所・担当者で絞り込む"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        />
        {state.query && (
          <button
            type="button"
            onClick={() => patch({ query: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            aria-label="検索文字を消す"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      <FilterRow label="ランク">
        {Object.entries(RANKS).map(([rank, info]) => {
          const selected = state.ranks.includes(rank);
          const count = groups.filter((group) => groupMatches(group, state, 'rank') && group.latest.rank === rank).length;
          return (
            <Chip
              key={rank}
              pressed={selected}
              disabled={count === 0 && !selected}
              onClick={() => patch({ ranks: toggle(state.ranks, rank) })}
              className={selected ? `${info.bg} ${info.text} ${info.border}` : ''}
            >
              <span className={`h-2 w-2 rounded-full ${info.dot}`} />
              {rank}
              <Count value={count} />
            </Chip>
          );
        })}
      </FilterRow>

      <FilterRow label="判定">
        {Object.entries(JUDGMENT).map(([key, info]) => {
          const selected = state.judgments.includes(key);
          const count = groups.filter((group) => groupMatches(group, state, 'judgment') && group.latest.judgment === key).length;
          return (
            <Chip
              key={key}
              pressed={selected}
              disabled={count === 0 && !selected}
              onClick={() => patch({ judgments: toggle(state.judgments, key) })}
              className={selected ? `${info.activeBg} ${info.border} text-slate-800` : ''}
            >
              <span className={`h-2 w-2 rounded-full ${info.dot}`} />
              {info.label}
              <Count value={count} />
            </Chip>
          );
        })}
      </FilterRow>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            pressed={state.photosOnly}
            disabled={photoCount === 0 && !state.photosOnly}
            onClick={() => patch({ photosOnly: !state.photosOnly })}
            className={state.photosOnly ? 'border-orange-300 bg-orange-50 text-orange-800' : ''}
          >
            <Icon name="Camera" size={14} />
            写真あり
            <Count value={photoCount} />
          </Chip>
          <label className="text-[11px] font-bold text-slate-500">
            <span className="mb-1 block">開始日</span>
            <input
              type="date"
              value={state.from}
              max={state.to || undefined}
              onChange={(event) => patch({ from: event.target.value })}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
          <label className="text-[11px] font-bold text-slate-500">
            <span className="mb-1 block">終了日</span>
            <input
              type="date"
              value={state.to}
              min={state.from || undefined}
              onChange={(event) => patch({ to: event.target.value })}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
          並び
          <select
            value={state.sort}
            onChange={(event) => patch({ sort: event.target.value as VisitSort })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="date">新しい視察順</option>
            <option value="rank">ランク順</option>
            <option value="name">名前順</option>
          </select>
        </label>
      </div>

      {prefectureOptions.length > 0 && (
        <FilterRow label="都道府県">
          {prefectureOptions.map((prefecture) => {
            const selected = state.prefectures.includes(prefecture);
            const count = groups.filter((group) => groupMatches(group, state, 'prefecture') && group.latest.prefecture === prefecture).length;
            return (
              <Chip
                key={prefecture}
                pressed={selected}
                disabled={count === 0 && !selected}
                onClick={() => patch({ prefectures: toggle(state.prefectures, prefecture) })}
                className={selected ? 'border-orange-300 bg-orange-50 text-orange-800' : ''}
              >
                {prefecture.replace(/[都府県]$/, '').replace(/県$/, '') || prefecture}
                <Count value={count} />
              </Chip>
            );
          })}
        </FilterRow>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <p className="text-sm font-bold text-slate-700">
          {resultCount} 件
          <span className="ml-1 font-medium text-slate-400">/ {groups.length} 店舗</span>
        </p>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ ...state, query: '', ranks: [], judgments: [], prefectures: [], photosOnly: false, from: '', to: '' })}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50"
          >
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

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? className : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="font-medium text-current opacity-60">{value}</span>;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
