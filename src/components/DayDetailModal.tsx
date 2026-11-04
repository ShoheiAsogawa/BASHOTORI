import { Icon } from './Icon';
import { RANKS, JUDGMENT } from '../lib/constants';
import { isGeneralRecord, RecordSourceBadge } from './RecordLegend';
import type { StoreVisit } from '../types';

interface DayDetailModalProps {
  dateObj: Date | null;
  visits: StoreVisit[];
  onClose: () => void;
  onAdd?: () => void;
  onEdit?: (visit: StoreVisit) => void;
  onDelete?: (id: string) => void;
}

export function DayDetailModal({
  dateObj,
  visits,
  onClose,
  onAdd,
  onEdit,
}: DayDetailModalProps) {
  if (!dateObj) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[80vh] flex flex-col">
        <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="bg-white text-orange-600 font-bold rounded-lg px-3 py-1 shadow-sm text-lg">
              {dateObj.getDate()}
            </span>
            <span className="text-orange-900 font-bold">
              {dateObj.getFullYear()}年 {dateObj.getMonth() + 1}月
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-full text-orange-800 transition"
          >
            <Icon name="X" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-slate-50 space-y-3">
          {visits.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Icon name="Calendar" size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm mt-2">視察記録はありません</p>
            </div>
          ) : (
            visits.map((v) => (
              <div
                key={v.id}
                onClick={() => onEdit && onEdit(v)}
                className={`group p-4 rounded-xl border shadow-sm hover:shadow-md transition relative overflow-hidden ${
                  isGeneralRecord(v.recordedRole)
                    ? 'bg-sky-50 border-sky-200 hover:border-sky-300'
                    : 'bg-white border-slate-200 hover:border-orange-200'
                } ${onEdit ? 'cursor-pointer' : ''}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${RANKS[v.rank].dot}`} />
                <div className="flex justify-between items-start mb-1 pl-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${RANKS[v.rank].bg} ${RANKS[v.rank].text}`}
                    >
                      {v.rank}ランク
                    </span>
                    <RecordSourceBadge role={v.recordedRole} />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${(JUDGMENT[v.judgment] || JUDGMENT['pending']).color}`}
                    >
                      {(JUDGMENT[v.judgment] || JUDGMENT['pending']).label}
                    </span>
                  </div>
                  {onEdit && (
                    <div className="text-slate-300 group-hover:text-orange-500 transition text-xs flex items-center gap-1">
                      編集 <Icon name="Edit" size={12} />
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-slate-800 pl-2 text-lg mb-1">{v.facilityName}</h4>
                <div className="pl-2 text-xs text-slate-500 flex flex-wrap gap-3">
                  {v.trafficCount && (
                    <span className="flex items-center gap-1">
                      <Icon name="Users" size={12} /> {v.trafficCount}
                    </span>
                  )}
                  {v.environment && (
                    <span className="flex items-center gap-1">
                      <Icon name="Building" size={12} /> {v.environment}
                    </span>
                  )}
                  {v.photoUrl && (
                    <span className="flex items-center gap-1 text-orange-600 font-bold">
                      <Icon name="Image" size={12} /> 写真
                      {v.photoUrl.startsWith('[') ? JSON.parse(v.photoUrl).length : 1}枚
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {onAdd && (
          <div className="p-4 bg-white border-t border-slate-100">
            <button
              onClick={onAdd}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Icon name="Plus" size={18} /> 新しい視察を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

