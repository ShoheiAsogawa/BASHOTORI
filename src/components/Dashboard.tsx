import { useState, useMemo, useEffect } from 'react';
import { Icon } from './Icon';
import { StoreFormModal } from './StoreFormModal';
import { RANKS, JUDGMENT, ENVIRONMENTS, REGISTER_COUNTS, TRAFFIC_LEVELS, SEASONALITY_OPTIONS, BUSY_DAY_OPTIONS, STAFF_COUNTS, SPACE_SIZES, COMPETITOR_COUNTS } from '../lib/constants';
import { PREFECTURES } from '../types';
import { formatDateJP } from '../lib/utils';
import { canEditVisits } from '../lib/auth';
import { isGeneralRecord, RecordLegend, RecordSourceBadge } from './RecordLegend';
import type { StoreVisit } from '../types';
import * as XLSX from 'xlsx';

interface DashboardProps {
  visits: StoreVisit[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearch: () => void;
  filterRank: string;
  onFilterRankChange: (rank: string) => void;
  filterJudgment: string;
  onFilterJudgmentChange: (judgment: string) => void;
  filterPrefecture: string;
  onFilterPrefectureChange: (prefecture: string) => void;
  filterEnvironment: string;
  onFilterEnvironmentChange: (environment: string) => void;
  filterRegisterCount: string;
  onFilterRegisterCountChange: (count: string) => void;
  filterTrafficCount: string;
  onFilterTrafficCountChange: (traffic: string) => void;
  filterSeasonality: string;
  onFilterSeasonalityChange: (seasonality: string) => void;
  filterBusyDay: string;
  onFilterBusyDayChange: (busyDay: string) => void;
  filterStaffCount: string;
  onFilterStaffCountChange: (staffCount: string) => void;
  filterSpaceSize: string;
  onFilterSpaceSizeChange: (spaceSize: string) => void;
  filterCompetitors: string;
  onFilterCompetitorsChange: (competitors: string) => void;
  filterMonth: string;
  onFilterMonthChange: (month: string) => void;
  filteredVisits: StoreVisit[];
  onSave: (data: Partial<StoreVisit>) => Promise<StoreVisit>;
  loading: boolean;
}

export function Dashboard({
  visits,
  currentDate,
  onDateChange,
  searchTerm,
  onSearchChange,
  onSearch,
  filterRank,
  onFilterRankChange,
  filterJudgment,
  onFilterJudgmentChange,
  filterPrefecture,
  onFilterPrefectureChange,
  filterEnvironment,
  onFilterEnvironmentChange,
  filterRegisterCount,
  onFilterRegisterCountChange,
  filterTrafficCount,
  onFilterTrafficCountChange,
  filterSeasonality,
  onFilterSeasonalityChange,
  filterBusyDay,
  onFilterBusyDayChange,
  filterStaffCount,
  onFilterStaffCountChange,
  filterSpaceSize,
  onFilterSpaceSizeChange,
  filterCompetitors,
  onFilterCompetitorsChange,
  filterMonth,
  onFilterMonthChange,
  filteredVisits,
  onSave,
  loading,
}: DashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [sortField, setSortField] = useState<'date' | 'facilityName' | 'staffName' | 'prefecture' | 'rank' | 'judgment' | 'environment' | 'seasonality' | 'registerCount' | 'trafficCount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedVisit, setSelectedVisit] = useState<StoreVisit | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    setCanEdit(await canEditVisits());
  };

  const sortedVisits = useMemo(() => {
    return [...filteredVisits].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'facilityName':
          aVal = a.facilityName || '';
          bVal = b.facilityName || '';
          break;
        case 'rank':
          const rankOrder = { S: 5, A: 4, B: 3, C: 2, D: 1 };
          aVal = rankOrder[a.rank] || 0;
          bVal = rankOrder[b.rank] || 0;
          break;
        case 'judgment':
          const judgmentOrder = { approved: 4, negotiating: 3, pending: 2, rejected: 1 };
          aVal = judgmentOrder[a.judgment] || 0;
          bVal = judgmentOrder[b.judgment] || 0;
          break;
        case 'staffName':
          aVal = (a.staffName || '').toLowerCase();
          bVal = (b.staffName || '').toLowerCase();
          break;
        case 'prefecture':
          aVal = (a.prefecture || '').toLowerCase();
          bVal = (b.prefecture || '').toLowerCase();
          break;
        case 'environment':
          const envOrder = { '屋内': 3, '半屋内': 2, '屋外': 1 };
          aVal = envOrder[a.environment as keyof typeof envOrder] || 0;
          bVal = envOrder[b.environment as keyof typeof envOrder] || 0;
          break;
        case 'seasonality':
          const seasonOrder = { 'オールシーズンok': 2, '春秋ならok': 1 };
          aVal = seasonOrder[a.seasonality as keyof typeof seasonOrder] || 0;
          bVal = seasonOrder[b.seasonality as keyof typeof seasonOrder] || 0;
          break;
        case 'registerCount':
          const regOrder = { '7台以上': 3, '4-6台': 2, '1-3台': 1 };
          aVal = regOrder[a.registerCount as keyof typeof regOrder] || 0;
          bVal = regOrder[b.registerCount as keyof typeof regOrder] || 0;
          break;
        case 'trafficCount':
          const trafficOrder = { '多い': 3, '普通': 2, '少ない': 1 };
          aVal = trafficOrder[a.trafficCount as keyof typeof trafficOrder] || 0;
          bVal = trafficOrder[b.trafficCount as keyof typeof trafficOrder] || 0;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVisits, sortField, sortDirection]);

  const handleExportExcel = () => {
    const rows = sortedVisits.map((visit) => ({
      '日付': formatDateJP(visit.date),
      '施設名': visit.facilityName || '',
      '担当者': visit.staffName || '',
      '記録': isGeneralRecord(visit.recordedRole) ? '一般' : '管理者',
      '都道府県': visit.prefecture || '',
      'ランク': visit.rank || '',
      '判定': (JUDGMENT[visit.judgment] || JUDGMENT.pending).label,
      '環境': visit.environment || '',
      'イミテーション台': visit.imitationTable || '',
      'レジ設置台数': visit.registerCount || '',
      '催事スペース': visit.spaceSize || '',
      '通行量': visit.trafficCount || '',
      '客層': (visit.demographics || []).join(' / '),
      '導線評価': visit.flowLine || '',
      '近隣競合店': visit.competitors || '',
      '適正査定員人数': visit.staffCount || '',
      '季節': visit.seasonality || '',
      '客が多い曜日': visit.busyDay || '',
      '総評': visit.overallReview || '',
      '条件': visit.conditions || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '視察記録');
    const now = new Date();
    const fileName = `store-visits-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const stats = useMemo(() => {
    // currentDateがnullの場合は全期間、そうでない場合は指定された月
    const isAllPeriod = !currentDate;
    const year = isAllPeriod ? new Date().getFullYear() : currentDate.getFullYear();
    const month = isAllPeriod ? new Date().getMonth() : currentDate.getMonth();

    const yearVisits = isAllPeriod ? visits : visits.filter((v) => new Date(v.date).getFullYear() === year);
    const yearTotal = yearVisits.length;
    const yearHot = yearVisits.filter((v) =>
      ['S', 'A'].includes(v.rank) && ['approved', 'negotiating'].includes(v.judgment)
    ).length;

    const monthVisits = isAllPeriod ? visits : yearVisits.filter((v) => new Date(v.date).getMonth() === month);
    const monthTotal = monthVisits.length;
    const monthHot = monthVisits.filter((v) =>
      ['S', 'A'].includes(v.rank) && ['approved', 'negotiating'].includes(v.judgment)
    ).length;

    const prevMonthDate = isAllPeriod ? null : new Date(year, month - 1, 1);
    const prevMonthVisits = isAllPeriod ? [] : visits.filter((v) => {
      const d = new Date(v.date);
      return d.getFullYear() === prevMonthDate!.getFullYear() && d.getMonth() === prevMonthDate!.getMonth();
    });
    const monthDiff = isAllPeriod ? 0 : monthTotal - prevMonthVisits.length;
    const diffSign = monthDiff > 0 ? '+' : '';

    const byRank: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    monthVisits.forEach((v) => {
      if (byRank[v.rank] !== undefined) byRank[v.rank]++;
    });
    const byJudgment: Record<string, number> = {
      approved: 0,
      negotiating: 0,
      pending: 0,
      rejected: 0,
    };
    monthVisits.forEach((v) => {
      if (byJudgment[v.judgment] !== undefined) byJudgment[v.judgment]++;
    });

    // 全期間の都道府県別の集計
    const byPrefectureAll: Record<string, number> = {};
    visits.forEach((v) => {
      if (v.prefecture) {
        byPrefectureAll[v.prefecture] = (byPrefectureAll[v.prefecture] || 0) + 1;
      }
    });
    const topPrefectures = Object.entries(byPrefectureAll)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // 全期間のランク内訳
    const byRankAll: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    visits.forEach((v) => {
      if (byRankAll[v.rank] !== undefined) byRankAll[v.rank]++;
    });

    // 全期間の判定状況
    const byJudgmentAll: Record<string, number> = {
      approved: 0,
      negotiating: 0,
      pending: 0,
      rejected: 0,
    };
    visits.forEach((v) => {
      if (byJudgmentAll[v.judgment] !== undefined) byJudgmentAll[v.judgment]++;
    });

    // 交渉中・出店可の件数
    const activeDeals = byJudgment.approved + byJudgment.negotiating;

    return {
      isAllPeriod,
      year,
      month: month + 1,
      yearTotal,
      yearHot,
      monthTotal,
      monthHot,
      monthDiff,
      diffSign,
      byRank,
      byJudgment,
      byRankAll,
      byJudgmentAll,
      topPrefectures,
      activeDeals,
    };
  }, [visits, currentDate]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div
        className="px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
              <Icon name="Briefcase" size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                {stats.year}年 年間累計
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">
                  {stats.yearTotal}
                  <span className="text-sm font-normal text-slate-400 ml-1">件</span>
                </span>
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                  SorA {stats.yearHot}件
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-10 bg-slate-200"></div>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Icon name="Calendar" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {stats.isAllPeriod ? '全期間' : `${stats.month}月`} 実績
                </div>
                <select
                  value={stats.isAllPeriod ? 'ALL' : `${stats.year}-${String(stats.month).padStart(2, '0')}`}
                  onChange={(e) => {
                    if (e.target.value === 'ALL') {
                      onDateChange(null as any);
                    } else {
                      const [y, m] = e.target.value.split('-').map(Number);
                      onDateChange(new Date(y, m - 1, 1));
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                  <option value="ALL">指定なし（全期間）</option>
                  {(() => {
                    const options = [];
                    const now = new Date();
                    for (let i = 11; i >= 0; i--) {
                      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                      options.push(
                        <option key={value} value={value}>
                          {label}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">
                  {stats.monthTotal}
                  <span className="text-sm font-normal text-slate-400 ml-1">件</span>
                </span>
                {!stats.isAllPeriod && (
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      stats.monthDiff >= 0
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-red-500 bg-red-50'
                    }`}
                  >
                    前月比 {stats.diffSign}
                    {stats.monthDiff}件
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block text-slate-400 bg-slate-100 p-2 rounded-full mt-4 md:mt-0">
          {isOpen ? <Icon name="ChevronUp" size={18} /> : <Icon name="ChevronDown" size={18} />}
        </div>
      </div>

      {isOpen && (
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50 animate-fade-in">
          {/* 事業指標 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">交渉中・出店可</div>
              <div className="text-3xl font-black text-slate-800">{stats.activeDeals}</div>
              <div className="text-xs text-slate-500 mt-1">
                件（出店可: {stats.byJudgment.approved}件 / 交渉中: {stats.byJudgment.negotiating}件）
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">S&Aランク</div>
              <div className="text-3xl font-black text-slate-800">{stats.monthHot}</div>
              <div className="text-xs text-slate-500 mt-1">
                月間 {stats.monthTotal > 0 ? ((stats.monthHot / stats.monthTotal) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>

          {/* 都道府県別 */}
          <div className="mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">
                都道府県別 視察件数（全期間・トップ5）
              </h5>
              <div className="space-y-2">
                {stats.topPrefectures.length > 0 ? (
                  stats.topPrefectures.map(([pref, count], idx) => {
                    const maxCount = stats.topPrefectures[0][1];
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={pref} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <span className="text-xs font-bold text-slate-400 w-6 text-center">#{idx + 1}</span>
                          <span className="text-sm font-bold text-slate-700">{pref}</span>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-orange-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            style={{ width: `${percentage}%` }}
                          >
                            <span className="text-xs font-black text-white">{count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-400 text-center py-4">データがありません</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">
                {stats.month}月 ランク内訳
              </h5>
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
                  {Object.keys(RANKS).map((r) => {
                    const count = stats.byRank[r];
                    const pct = stats.monthTotal > 0 ? (count / stats.monthTotal) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={r}
                        style={{ width: `${pct}%` }}
                        className={`${RANKS[r].dot} transition-all duration-500 border-r border-white/20 last:border-0`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(RANKS).map((r) => (
                    <div
                      key={r}
                      className="flex items-center justify-between bg-white p-2 rounded border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${RANKS[r].dot}`} />
                        <span className="text-xs font-bold text-slate-600">{r}ランク</span>
                      </div>
                      <span className="text-sm font-black text-slate-800">{stats.byRank[r]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">
                {stats.isAllPeriod ? '全期間' : `${stats.month}月`} 判定状況
              </h5>
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
                  {Object.entries(JUDGMENT).map(([k, info]) => {
                    const count = stats.byJudgment[k];
                    const pct = stats.monthTotal > 0 ? (count / stats.monthTotal) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={k}
                        style={{ width: `${pct}%` }}
                        className={`${info.dot} transition-all duration-500 border-r border-white/20 last:border-0`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(JUDGMENT).map(([k, info]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={info.icon} size={14} className={info.color.split(' ')[0]} />
                        <span className="text-[10px] font-bold text-slate-500">{info.label}</span>
                      </div>
                      <span className="text-sm font-black text-slate-700">{stats.byJudgment[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 全期間のランク内訳 */}
            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">
                全期間 ランク内訳
              </h5>
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
                  {Object.keys(RANKS).map((r) => {
                    const count = stats.byRankAll[r];
                    const total = visits.length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={r}
                        style={{ width: `${pct}%` }}
                        className={`${RANKS[r].dot} transition-all duration-500 border-r border-white/20 last:border-0`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(RANKS).map((r) => (
                    <div
                      key={r}
                      className="flex items-center justify-between bg-white p-2 rounded border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${RANKS[r].dot}`} />
                        <span className="text-xs font-bold text-slate-600">{r}ランク</span>
                      </div>
                      <span className="text-sm font-black text-slate-800">{stats.byRankAll[r]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 全期間の判定状況 */}
            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">
                全期間 判定状況
              </h5>
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
                  {Object.entries(JUDGMENT).map(([k, info]) => {
                    const count = stats.byJudgmentAll[k];
                    const total = visits.length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={k}
                        style={{ width: `${pct}%` }}
                        className={`${info.dot} transition-all duration-500 border-r border-white/20 last:border-0`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(JUDGMENT).map(([k, info]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={info.icon} size={14} className={info.color.split(' ')[0]} />
                        <span className="text-[10px] font-bold text-slate-500">{info.label}</span>
                      </div>
                      <span className="text-sm font-black text-slate-700">{stats.byJudgmentAll[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 検索・フィルタリング */}
          <div className="mb-6">
            <h5 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
              <Icon name="Filter" size={14} /> 検索・フィルタリング
            </h5>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              {/* 月選択（検索用） */}
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <label className="text-xs font-bold text-slate-600 whitespace-nowrap">表示月（検索用）:</label>
                <select
                  value={filterMonth}
                  onChange={(e) => onFilterMonthChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                >
                  <option value="ALL">指定なし</option>
                  {(() => {
                    const options = [];
                    const now = new Date();
                    for (let i = 11; i >= 0; i--) {
                      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                      options.push(
                        <option key={value} value={value}>
                          {label}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
              </div>
              {/* 検索欄 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="Search" size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="施設名・担当者名で検索..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSearch();
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                  />
                </div>
                <button
                  onClick={onSearch}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-md shadow-orange-500/30 active:scale-95"
                >
                  <Icon name="Search" size={16} />
                  検索
                </button>
              </div>

              {/* フィルター */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">ランク</label>
                    <select
                      value={filterRank}
                      onChange={(e) => onFilterRankChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">全ランク</option>
                      <option value="S">S</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">判定</label>
                    <select
                      value={filterJudgment}
                      onChange={(e) => onFilterJudgmentChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">全判定</option>
                      <option value="pending">調査中</option>
                      <option value="negotiating">交渉中</option>
                      <option value="approved">出店可</option>
                      <option value="rejected">不可/NG</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">都道府県</label>
                    <select
                      value={filterPrefecture}
                      onChange={(e) => onFilterPrefectureChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">全都道府県</option>
                      {PREFECTURES.map((pref) => (
                        <option key={pref} value={pref}>
                          {pref}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">環境</label>
                    <select
                      value={filterEnvironment}
                      onChange={(e) => onFilterEnvironmentChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">全環境</option>
                      {ENVIRONMENTS.map((env) => (
                        <option key={env} value={env}>
                          {env}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">レジ設置台数</label>
                    <select
                      value={filterRegisterCount}
                      onChange={(e) => onFilterRegisterCountChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {REGISTER_COUNTS.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">通行量</label>
                    <select
                      value={filterTrafficCount}
                      onChange={(e) => onFilterTrafficCountChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {TRAFFIC_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">季節</label>
                    <select
                      value={filterSeasonality}
                      onChange={(e) => onFilterSeasonalityChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {SEASONALITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">客が多い曜日</label>
                    <select
                      value={filterBusyDay}
                      onChange={(e) => onFilterBusyDayChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {BUSY_DAY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">適正査定員人数</label>
                    <select
                      value={filterStaffCount}
                      onChange={(e) => onFilterStaffCountChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {STAFF_COUNTS.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">催事スペース</label>
                    <select
                      value={filterSpaceSize}
                      onChange={(e) => onFilterSpaceSizeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {SPACE_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">近隣競合店</label>
                    <select
                      value={filterCompetitors}
                      onChange={(e) => onFilterCompetitorsChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold text-slate-700"
                    >
                      <option value="ALL">すべて</option>
                      {COMPETITOR_COUNTS.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* データテーブル */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                <Icon name="List" size={14} /> 視察記録一覧
              </h5>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {filteredVisits.length}件
                </span>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={sortedVisits.length === 0}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-1"
                >
                  <Icon name="FileText" size={14} />
                  Excel出力
                </button>
              </div>
            </div>
            <div className="mb-3">
              <RecordLegend />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'date') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('date');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          日付
                          {sortField === 'date' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'facilityName') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('facilityName');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          施設名
                          {sortField === 'facilityName' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'staffName') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('staffName');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          担当者
                          {sortField === 'staffName' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'prefecture') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('prefecture');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          都道府県
                          {sortField === 'prefecture' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'rank') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('rank');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          ランク
                          {sortField === 'rank' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'judgment') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('judgment');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          判定
                          {sortField === 'judgment' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'environment') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('environment');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          環境
                          {sortField === 'environment' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'seasonality') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('seasonality');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          季節
                          {sortField === 'seasonality' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'registerCount') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('registerCount');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          レジ台数
                          {sortField === 'registerCount' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => {
                          if (sortField === 'trafficCount') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('trafficCount');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          通行量
                          {sortField === 'trafficCount' && (
                            <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVisits.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                          該当する記録がありません
                        </td>
                      </tr>
                    ) : (
                      sortedVisits.map((visit) => (
                          <tr
                            key={visit.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedVisit(visit);
                              setIsDetailModalOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedVisit(visit);
                                setIsDetailModalOpen(true);
                              }
                            }}
                            className={`transition cursor-pointer ${
                              isGeneralRecord(visit.recordedRole) ? 'bg-sky-50 hover:bg-sky-100' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {formatDateJP(visit.date)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                {visit.facilityName}
                                <RecordSourceBadge role={visit.recordedRole} />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{visit.staffName}</td>
                            <td className="px-4 py-3 text-slate-600">{visit.prefecture || '-'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${
                                  RANKS[visit.rank].text
                                } ${RANKS[visit.rank].activeBg} ${RANKS[visit.rank].border}`}
                              >
                                {visit.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                  (JUDGMENT[visit.judgment] || JUDGMENT['pending']).activeBg
                                } ${(JUDGMENT[visit.judgment] || JUDGMENT['pending']).color} ${(JUDGMENT[visit.judgment] || JUDGMENT['pending']).border}`}
                              >
                                <Icon name={(JUDGMENT[visit.judgment] || JUDGMENT['pending']).icon} size={12} />
                                {(JUDGMENT[visit.judgment] || JUDGMENT['pending']).label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{visit.environment || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                              {visit.seasonality === '春秋ならok' ? '春秋' : visit.seasonality === 'オールシーズンok' ? 'AS' : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{visit.registerCount || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{visit.trafficCount || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="text-orange-600 font-bold text-xs flex items-center gap-1">
                                <Icon name="Eye" size={14} />
                                詳細
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      {isDetailModalOpen && selectedVisit && (
        <StoreFormModal
          initialData={selectedVisit}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedVisit(null);
          }}
          onSave={onSave}
          loading={loading}
          readOnly={!canEdit}
          onEdit={canEdit ? () => {
            setIsDetailModalOpen(false);
            // 編集モードで開く（親コンポーネントで処理）
          } : undefined}
          onSaved={(savedData) => {
            // 保存後に更新されたデータで表示を更新
            setSelectedVisit(savedData);
          }}
        />
      )}
    </div>
  );
}

