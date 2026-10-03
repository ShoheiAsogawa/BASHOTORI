// ランク定義
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';

// 判定ステータス
export type Judgment = 'pending' | 'negotiating' | 'approved' | 'rejected';

// 都道府県
export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
] as const;

export type Prefecture = typeof PREFECTURES[number];

// レジ設置台数
export type RegisterCount = '1-3台' | '4-6台' | '7台以上';

// 近隣競合店数
export type CompetitorCount = '無し' | '1店舗' | '2店舗' | '3店舗以上';

// 通行量
export type TrafficLevel = '少ない' | '普通' | '多い';

// 客層（複数選択可）
export type CustomerSegment = 
  | 'ファミリー層'
  | 'ラグジュアリー層'
  | 'シニア層'
  | '主婦層'
  | '女性多め'
  | '男性多め';

// 導線評価
export type FlowLineRating = '◎' | '⚪︎' | '△';

// 季節適性
export type Seasonality = '春秋ならok' | 'オールシーズンok';

// 客が多い曜日
export type BusyDay = '土日祝' | '何曜日でもok';

// 適正査定員人数
export type StaffCount = '1人' | '2人' | '3人';

// 催事スペースの広さ
export type SpaceSize = '小さい' | '普通' | '広い';

// 環境
export type Environment = '屋内' | '半屋内' | '屋外';

// イミテーション台
export type ImitationTable = '設置可' | '条件付' | '不可';

// 画像オブジェクト
export interface Photo {
  id: string | null;
  url: string;
}

// 店舗視察データ
export interface StoreVisit {
  id: string;
  date: string; // YYYY-MM-DD
  facilityName: string;
  staffName: string;
  prefecture?: Prefecture;
  rank: Rank;
  judgment: Judgment;
  
  // 環境・設備
  environment: Environment;
  imitationTable: ImitationTable;
  registerCount?: RegisterCount;
  spaceSize?: SpaceSize;
  spaceSizeNote?: string;
  
  // 客層・動線
  trafficCount?: TrafficLevel;
  trafficCountNote?: string;
  demographics?: CustomerSegment[];
  demographicsNote?: string;
  flowLine?: FlowLineRating;
  flowLineNote?: string;
  
  // 運営・条件
  competitors?: CompetitorCount;
  competitorsNote?: string;
  staffCount?: StaffCount;
  seasonality?: Seasonality;
  busyDay?: BusyDay;
  busyDayNote?: string;
  
  // その他
  overallReview?: string;
  conditions?: string;
  photoUrl?: string; // JSON string of Photo[]

  // OpenPOI API で特定した位置。licenses / attributions は検索結果と一緒に保存する
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  poiName?: string;
  poiLicenses?: string[];
  poiAttributions?: string[];
  
  createdAt: string;
  updatedAt: string;
}

// フォームデータ（StoreVisitの一部）
export type StoreVisitFormData = Omit<StoreVisit, 'id' | 'createdAt' | 'updatedAt'>;

// ランク情報
export interface RankInfo {
  label: string;
  desc: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  ring: string;
  hoverBg: string;
  activeBg: string;
}

// 判定情報
export interface JudgmentInfo {
  label: string;
  color: string;
  icon: string;
  border: string;
  hoverBg: string;
  activeBg: string;
  dot: string;
}

