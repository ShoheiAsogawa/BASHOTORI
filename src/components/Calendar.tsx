import { useMemo } from 'react';
import { formatDate } from '../lib/utils';
import { RANKS } from '../lib/constants';
import { isGeneralRecord } from './RecordLegend';
import type { StoreVisit } from '../types';

interface CalendarProps {
  currentDate: Date;
  visits: StoreVisit[];
  onDateClick: (date: Date) => void;
  onAddClick?: (date: Date) => void;
}

export function Calendar({ currentDate, visits, onDateClick, onAddClick }: CalendarProps) {
  const calendarDays = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const days: (Date | null)[] = Array(first).fill(null);
    for (let i = 1; i <= last; i++) days.push(new Date(y, m, i));
    return days;
  }, [currentDate]);

  const getDayVisits = (d: Date | null) => {
    if (!d) return [];
    const str = formatDate(d);
    return visits.filter((v) => v.date === str);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div
            key={d}
            className={`py-3 text-center text-[10px] font-black tracking-widest ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 gap-px border-b border-slate-100">
        {calendarDays.map((dateObj, i) => {
          if (!dateObj)
            return <div key={i} className="bg-slate-50/50 min-h-[100px] sm:min-h-[140px]" />;
          const dayVisits = getDayVisits(dateObj);
          const isToday = formatDate(dateObj) === formatDate(new Date());
          return (
            <div
              key={i}
              onClick={() => onDateClick(dateObj)}
              className={`group bg-white relative min-h-[100px] sm:min-h-[140px] p-2 transition cursor-pointer hover:bg-orange-50/50 ${
                isToday ? 'bg-orange-50/30' : ''
              }`}
            >
              <div
                className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg mb-1 ${
                  isToday ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                {dateObj.getDate()}
              </div>
              <div className="hidden sm:flex flex-col gap-1">
                {dayVisits.slice(0, 3).map((v) => {
                  const general = isGeneralRecord(v.recordedRole);
                  return (
                    <div
                      key={v.id}
                      className={`text-[10px] truncate px-1.5 py-1 rounded border-l-2 font-medium text-slate-700 ${
                        general ? 'border-sky-500 bg-sky-100' : `${RANKS[v.rank].border} bg-slate-50`
                      }`}
                    >
                      <span className={`${general ? 'text-sky-700' : RANKS[v.rank].text} font-bold mr-1`}>
                        {general ? '一般' : v.rank}
                      </span>
                      {v.facilityName}
                    </div>
                  );
                })}
                {dayVisits.length > 3 && (
                  <div className="text-[10px] text-slate-400 pl-1">他 {dayVisits.length - 3} 件...</div>
                )}
                {onAddClick && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddClick(dateObj);
                      }}
                      className="p-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-500 hover:text-white"
                    >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5v14" />
                    </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex sm:hidden flex-wrap content-start gap-1 mt-1">
                {dayVisits.map((v, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full ${isGeneralRecord(v.recordedRole) ? 'bg-sky-500 ring-2 ring-sky-200' : RANKS[v.rank].dot}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

