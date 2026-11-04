export function isGeneralRecord(role?: string | null): boolean {
  return role === 'general';
}

export function RecordLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 ring-1 ring-slate-300" />
        管理者の記録
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-sky-300 ring-1 ring-sky-500" />
        一般の記録
      </span>
    </div>
  );
}

export function RecordSourceBadge({ role }: { role?: string | null }) {
  const general = isGeneralRecord(role);
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
        general ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {general ? '一般' : '管理者'}
    </span>
  );
}
