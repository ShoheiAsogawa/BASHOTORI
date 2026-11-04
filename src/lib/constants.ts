import type { RankInfo, JudgmentInfo } from '@/types';

export const RANKS: Record<string, RankInfo> = {
  S: {
    label: 'S（超優良）',
    desc: '超優良',
    bg: 'bg-[#ffedd5]',
    text: 'text-[#9a3412]',
    border: 'border-[#fed7aa]',
    dot: 'bg-[#f97316]',
    ring: 'ring-[#f97316]',
    hoverBg: 'hover:bg-[#fff7ed]',
    activeBg: 'bg-[#ffedd5]',
  },
  A: {
    label: 'A（期待大）',
    desc: '期待大',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    ring: 'ring-yellow-500',
    hoverBg: 'hover:bg-yellow-50',
    activeBg: 'bg-yellow-100',
  },
  B: {
    label: 'B（標準）',
    desc: '標準',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500',
    hoverBg: 'hover:bg-blue-50',
    activeBg: 'bg-blue-50',
  },
  C: {
    label: 'C（検討）',
    desc: '検討',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    ring: 'ring-slate-400',
    hoverBg: 'hover:bg-slate-50',
    activeBg: 'bg-slate-100',
  },
  D: {
    label: 'D（厳しい）',
    desc: '厳しい',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
    ring: 'ring-red-500',
    hoverBg: 'hover:bg-red-50',
    activeBg: 'bg-red-100',
  },
};

export const JUDGMENT: Record<string, JudgmentInfo> = {
  pending: {
    label: '調査中',
    color: 'text-slate-500 bg-slate-100',
    icon: 'Eye',
    border: 'border-slate-200',
    hoverBg: 'hover:bg-slate-50',
    activeBg: 'bg-slate-100',
    dot: 'bg-slate-400',
  },
  negotiating: {
    label: '交渉中',
    color: 'text-blue-600 bg-blue-100',
    icon: 'Briefcase',
    border: 'border-blue-200',
    hoverBg: 'hover:bg-blue-50',
    activeBg: 'bg-blue-100',
    dot: 'bg-blue-500',
  },
  approved: {
    label: '出店可',
    color: 'text-emerald-600 bg-emerald-100',
    icon: 'CheckCircle2',
    border: 'border-emerald-200',
    hoverBg: 'hover:bg-emerald-50',
    activeBg: 'bg-emerald-100',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: '不可/NG',
    color: 'text-red-600 bg-red-100',
    icon: 'X',
    border: 'border-red-200',
    hoverBg: 'hover:bg-red-50',
    activeBg: 'bg-red-100',
    dot: 'bg-red-400',
  },
};

export const ENVIRONMENTS = ['屋内', '半屋内', '屋外'] as const;
export const IMITATIONS = ['設置可', '条件付', '不可'] as const;
export const REGISTER_COUNTS = ['1-3台', '4-6台', '7台以上'] as const;
export const COMPETITOR_COUNTS = ['無し', '1店舗', '2店舗', '3店舗以上'] as const;
export const TRAFFIC_LEVELS = ['少ない', '普通', '多い'] as const;
export const CUSTOMER_SEGMENTS = [
  'ファミリー層',
  'ラグジュアリー層',
  'シニア層',
  '主婦層',
  '女性多め',
  '男性多め',
] as const;
export const FLOW_LINE_RATINGS = ['◎', '⚪︎', '△'] as const;
export const SEASONALITY_OPTIONS = ['春秋ならok', 'オールシーズンok'] as const;
export const BUSY_DAY_OPTIONS = ['土日祝', '何曜日でもok'] as const;
export const STAFF_COUNTS = ['1人', '2人', '3人'] as const;
export const SPACE_SIZES = ['小さい', '普通', '広い'] as const;

