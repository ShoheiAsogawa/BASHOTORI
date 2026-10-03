import { useEffect, useState, useRef } from 'react';
import { Icon } from './Icon';
import { RANKS, JUDGMENT, ENVIRONMENTS, IMITATIONS, REGISTER_COUNTS, COMPETITOR_COUNTS, TRAFFIC_LEVELS, CUSTOMER_SEGMENTS, FLOW_LINE_RATINGS, SEASONALITY_OPTIONS, BUSY_DAY_OPTIONS, STAFF_COUNTS, SPACE_SIZES } from '../lib/constants';
import { PREFECTURES, type Prefecture } from '../types';
import { formatDate, generateId } from '../lib/utils';
import { uploadImage, deleteImage, compressImage } from '../lib/storage';
import { suggestPlaces, writePoiCache, type PoiPlace } from '../lib/openpoi';
import type { StoreVisit, Photo, CustomerSegment } from '../types';

interface StoreFormModalProps {
  initialData?: StoreVisit | null;
  selectedDate?: Date | null;
  onClose: () => void;
  onSave: (data: Partial<StoreVisit>) => Promise<StoreVisit>;
  loading: boolean;
  readOnly?: boolean; // 読み取り専用モード
  onEdit?: () => void; // 編集モードに切り替えるコールバック
  onSaved?: (savedData: StoreVisit) => void; // 保存完了後のコールバック
}

export function StoreFormModal({
  initialData,
  selectedDate,
  onClose,
  onSave,
  loading,
  readOnly = false,
  onEdit,
  onSaved,
}: StoreFormModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // 初期写真データの処理
  const [initialPhotos] = useState<Photo[]>(() => {
    if (initialData?.photoUrl) {
      try {
        const parsed = JSON.parse(initialData.photoUrl);
        if (Array.isArray(parsed)) {
          return parsed.map((p: any) => (typeof p === 'string' ? { id: null, url: p } : p));
        }
        return [{ id: null, url: initialData.photoUrl }];
      } catch (e) {
        return [{ id: null, url: initialData.photoUrl }];
      }
    }
    return [];
  });

  const [formData, setFormData] = useState({
    id: initialData?.id || generateId(),
    date: initialData?.date || (selectedDate ? formatDate(selectedDate) : formatDate(new Date())),
    facilityName: initialData?.facilityName || '',
    staffName: initialData?.staffName || '',
    prefecture: initialData?.prefecture || '',
    rank: initialData?.rank || 'B',
    judgment: initialData?.judgment || 'pending',
    environment: initialData?.environment || '屋内',
    imitationTable: initialData?.imitationTable || '設置可',
    registerCount: initialData?.registerCount || '',
    spaceSize: initialData?.spaceSize || '',
    spaceSizeNote: initialData?.spaceSizeNote || '',
    trafficCount: initialData?.trafficCount || '',
    trafficCountNote: initialData?.trafficCountNote || '',
    demographics: initialData?.demographics || [],
    demographicsNote: initialData?.demographicsNote || '',
    flowLine: initialData?.flowLine || '',
    flowLineNote: initialData?.flowLineNote || '',
    competitors: initialData?.competitors || '',
    competitorsNote: initialData?.competitorsNote || '',
    staffCount: initialData?.staffCount || '',
    seasonality: initialData?.seasonality || '',
    busyDay: initialData?.busyDay || '',
    busyDayNote: initialData?.busyDayNote || '',
    overallReview: initialData?.overallReview || '',
    conditions: initialData?.conditions || '',
    latitude: initialData?.latitude ?? null,
    longitude: initialData?.longitude ?? null,
    address: initialData?.address || '',
    poiName: initialData?.poiName || '',
    poiLicenses: initialData?.poiLicenses || [],
    poiAttributions: initialData?.poiAttributions || [],
    photos: initialPhotos,
  });
  const [placeSuggestions, setPlaceSuggestions] = useState<PoiPlace[]>([]);
  const [nameFocused, setNameFocused] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<Photo | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'facilityName') {
        next.latitude = null;
        next.longitude = null;
        next.address = '';
        next.poiName = '';
        next.poiLicenses = [];
        next.poiAttributions = [];
      }
      return next;
    });
  };

  useEffect(() => {
    if (readOnly) return;
    const query = formData.facilityName.trim();
    if (query.length < 2) {
      setPlaceSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      suggestPlaces(query, 5, controller.signal)
        .then((places) => {
          if (!controller.signal.aborted) setPlaceSuggestions(places);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setPlaceSuggestions([]);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [formData.facilityName, readOnly]);

  const selectPlace = (place: PoiPlace) => {
    writePoiCache(place.name, place.prefecture || formData.prefecture, place);
    setFormData((prev) => ({
      ...prev,
      facilityName: place.name,
      prefecture: place.prefecture || prev.prefecture,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      poiName: place.name,
      poiLicenses: place.licenses,
      poiAttributions: place.attributions,
    }));
    setPlaceSuggestions([]);
    setNameFocused(false);
  };

  const handleDemographicsChange = (segment: CustomerSegment) => {
    setFormData((prev) => {
      const current = prev.demographics as CustomerSegment[];
      const newDemographics = current.includes(segment)
        ? current.filter((s) => s !== segment)
        : [...current, segment];
      return { ...prev, demographics: newDemographics };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (formData.photos.length >= 3) {
      alert('写真は最大3枚までです');
      return;
    }

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const index = formData.photos.length + 1;
      // 新規登録の場合でも一時的なIDを使用して画像をアップロード
      const visitId = initialData?.id || formData.id;
      const photo = await uploadImage(compressedFile, visitId, index);

      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, photo],
      }));
    } catch (error) {
      console.error('画像アップロードエラー:', error);
      const errorMessage = error instanceof Error ? error.message : '画像処理中にエラーが発生しました';
      alert(`画像アップロードエラー: ${errorMessage}\n\nSupabaseの設定を確認してください。`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (image: Photo) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.url !== image.url),
    }));
    setViewingImage(null);

    if (image.id) {
      try {
        await deleteImage(image);
      } catch (error) {
        console.error('画像削除エラー:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitData = {
        ...formData,
        photoUrl: JSON.stringify(formData.photos),
        prefecture: (formData.prefecture || undefined) as Prefecture | undefined,
      } as Partial<StoreVisit>;
      delete (submitData as any).photos;
      
      // 新規登録の場合はidを削除（データベースが自動生成するため）
      if (!initialData) {
        delete (submitData as any).id;
      }
      
      const savedData = await onSave(submitData);
      
      // 保存完了のトーストを表示
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 2000);
      
      // 保存後のコールバックを呼び出し
      if (onSaved) {
        onSaved(savedData);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存エラー: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {viewingImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition z-20"
          >
            <Icon name="X" size={24} />
          </button>
          <div className="relative max-w-4xl max-h-[80vh] p-2 flex flex-col items-center w-full">
            <img
              src={viewingImage.url}
              alt="Enlarged"
              className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleDeleteImage(viewingImage)}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600/90 hover:bg-red-700 text-white rounded-xl shadow-lg font-bold transition backdrop-blur-md"
              >
                <Icon name="Trash2" size={18} /> この画像を削除
              </button>
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white animate-fade-in">
          <div className="w-12 h-12 border-4 border-white/30 border-l-orange-500 rounded-full animate-spin mb-4" />
          <p className="font-bold text-lg">画像を圧縮・アップロード中...</p>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm text-white animate-fade-in">
          <div className="w-12 h-12 border-4 border-white/30 border-l-orange-500 rounded-full animate-spin mb-4" />
          <p className="font-bold text-lg">保存中...</p>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] animate-fade-in">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <Icon name="Check" size={18} className="text-orange-500" />
            <span className="font-bold text-sm">保存完了</span>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto transition-opacity"
          onClick={onClose}
        />
        <div className="relative z-10 bg-white w-full sm:max-w-2xl h-[95vh] sm:h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto animate-scale-in overflow-hidden">
          <div className="p-4 border-b bg-white flex justify-between items-center shrink-0 z-20 shadow-sm">
            <h3 className="font-black text-slate-800 text-lg tracking-tight">
              {readOnly ? 'レポート詳細' : initialData ? 'レポート編集' : '新規レポート作成'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
            {readOnly && (
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 flex items-center gap-2">
                <Icon name="Eye" size={16} />
                読み取り専用モードです。{onEdit && '「編集」ボタンをクリックして編集できます。'}
              </div>
            )}
            {/* 1. 基本情報 */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Icon name="Calendar" size={16} /> 基本情報
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">視察日</label>
                  <input
                    required
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    disabled={readOnly}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">担当者</label>
                  <input
                    required
                    type="text"
                    name="staffName"
                    value={formData.staffName}
                    onChange={handleChange}
                    placeholder="名前"
                    disabled={readOnly}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="relative mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">施設名</label>
                <input
                  required
                  type="text"
                  name="facilityName"
                  value={formData.facilityName}
                  onChange={handleChange}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="例: イオンモール〇〇店"
                  disabled={readOnly}
                  autoComplete="off"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 text-lg focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {nameFocused && placeSuggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {placeSuggestions.map((place) => (
                      <li key={`${place.name}-${place.latitude}-${place.longitude}`}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectPlace(place)}
                          className="w-full px-3 py-2 text-left hover:bg-orange-50"
                        >
                          <span className="block text-sm font-bold text-slate-800">{place.name}</span>
                          <span className="block text-xs text-slate-500">
                            {[place.prefecture, place.city, place.address].filter(Boolean).join(' ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {formData.latitude != null && formData.longitude != null && (
                  <p className="mt-1 text-xs text-emerald-700">
                    地図上の位置を設定済み{formData.address ? `（${formData.address}）` : ''}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">都道府県</label>
                <select
                  name="prefecture"
                  value={formData.prefecture}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">選択してください</option>
                  {PREFECTURES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>
              </div>

              {/* 現場写真アップロード */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-600 mb-2">現場写真 (最大3枚)</label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {formData.photos.map((imgObj, idx) => (
                    <div
                      key={idx}
                      onClick={() => setViewingImage(imgObj)}
                      className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 group cursor-pointer hover:ring-2 ring-orange-400 transition"
                    >
                      <img
                        src={imgObj.url}
                        alt={`現場写真 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                      <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition scale-75">
                        <Icon name="Maximize" size={16} />
                      </div>
                    </div>
                  ))}

                  {formData.photos.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-24 h-24 shrink-0 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-orange-500 hover:border-orange-300 transition"
                    >
                      {uploading ? (
                        <div className="w-6 h-6 border-2 border-slate-300 border-l-orange-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Icon name="Camera" size={24} />
                          <span className="text-[10px] mt-1">追加</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </section>

            {/* 2. 環境・設備 */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Icon name="MapPin" size={16} /> 環境・設備
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">屋内・屋外</label>
                  <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                    {ENVIRONMENTS.map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, environment: env })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                          formData.environment === env
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="environment" value={formData.environment} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">イミテーション台</label>
                  <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                    {IMITATIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, imitationTable: opt })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                          formData.imitationTable === opt
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="imitationTable" value={formData.imitationTable} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-2">レジ設置台数</label>
                <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                  {REGISTER_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, registerCount: count })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.registerCount === count
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="registerCount" value={formData.registerCount} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">催事スペースの広さ</label>
                <div className="flex rounded-lg bg-slate-100 p-1 mb-2 gap-1">
                  {SPACE_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, spaceSize: size })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.spaceSize === size
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="spaceSize" value={formData.spaceSize} />
                <textarea
                  name="spaceSizeNote"
                  value={formData.spaceSizeNote}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="備考（例: 2m×3m、長机2本ギリギリ）"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </section>

            {/* 3. 客層・動線 */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Icon name="Users" size={16} /> 客層・動線
              </h4>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-2">通行量</label>
                <div className="flex rounded-lg bg-slate-100 p-1 mb-2 gap-1">
                  {TRAFFIC_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, trafficCount: level })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.trafficCount === level
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="trafficCount" value={formData.trafficCount} />
                <textarea
                  name="trafficCountNote"
                  value={formData.trafficCountNote}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="備考（例: 何時ごろ視察、10分に20人ほどは声掛けできそう）"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-2">客層（複数選択可）</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {CUSTOMER_SEGMENTS.map((segment) => (
                    <button
                      key={segment}
                      type="button"
                      onClick={() => !readOnly && handleDemographicsChange(segment)}
                      disabled={readOnly}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                        (formData.demographics as CustomerSegment[]).includes(segment)
                          ? 'bg-orange-100 border-orange-300 text-orange-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {segment}
                    </button>
                  ))}
                </div>
                <textarea
                  name="demographicsNote"
                  value={formData.demographicsNote}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="備考（例: 現場系の男性が多め、ラグジュアリーは少なそうなど）"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">導線</label>
                <div className="flex rounded-lg bg-slate-100 p-1 mb-2 gap-1">
                  {FLOW_LINE_RATINGS.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, flowLine: rating })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.flowLine === rating
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="flowLine" value={formData.flowLine} />
                <textarea
                  name="flowLineNote"
                  value={formData.flowLineNote}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="備考（例: エレベーター横で人通りが多いなど）"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </section>

            {/* 4. 運営・条件 */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Icon name="Store" size={16} /> 運営・条件
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">適正査定員人数</label>
                  <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                    {STAFF_COUNTS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, staffCount: count })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                          formData.staffCount === count
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="staffCount" value={formData.staffCount} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">近隣競合店</label>
                  <div className="flex rounded-lg bg-slate-100 p-1 mb-2 gap-1">
                    {COMPETITOR_COUNTS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, competitors: count })}
                        disabled={readOnly}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                          formData.competitors === count
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                            : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                        } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="competitors" value={formData.competitors} />
                  <textarea
                    name="competitorsNote"
                    value={formData.competitorsNote}
                    onChange={handleChange}
                    disabled={readOnly}
                    rows={2}
                    placeholder="備考（例: 大吉とお宝やのフランチャイズがあるなど）"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-2">季節</label>
                <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                  {SEASONALITY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => !readOnly && setFormData({ ...formData, seasonality: option })}
                      disabled={readOnly}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.seasonality === option
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                          : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="seasonality" value={formData.seasonality} />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-2">客が多い曜日</label>
                <div className="flex rounded-lg bg-slate-100 p-1 mb-2 gap-1">
                  {BUSY_DAY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => !readOnly && setFormData({ ...formData, busyDay: option })}
                      disabled={readOnly}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                        formData.busyDay === option
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                          : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-transparent'
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="busyDay" value={formData.busyDay} />
                <textarea
                  name="busyDayNote"
                  value={formData.busyDayNote}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="備考（例: 火曜日はセールのため人が多いなど）"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">条件・賃料メモ</label>
                <textarea
                  name="conditions"
                  value={formData.conditions}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={2}
                  placeholder="賃料、什器貸出の有無など"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </section>

            {/* 5. 最終判定 */}
            <section className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b-2 border-orange-200 pb-2">
                <h4 className="text-3xl font-black text-slate-800 uppercase">最終判定</h4>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">総合レビュー・懸念点</label>
                <textarea
                  name="overallReview"
                  value={formData.overallReview}
                  onChange={handleChange}
                  disabled={readOnly}
                  rows={3}
                  placeholder="担当者の最終感触、やる価値、リスクなど"
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-600 mb-2">ポテンシャルランク</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(RANKS).map(([r, info]) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => !readOnly && setFormData({ ...formData, rank: r as any })}
                      disabled={readOnly}
                      className={`relative py-3 rounded-xl border transition flex flex-col items-center justify-center ${
                        formData.rank === r
                          ? `${info.activeBg} ${info.border} ${info.text} shadow-md scale-105 z-10`
                          : `bg-white ${info.border} text-slate-500 ${info.hoverBg}`
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-lg font-black leading-none">{r}</span>
                      <span className="text-[9px] font-bold opacity-80">{info.desc}</span>
                      {formData.rank === r && (
                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${info.dot}`} />
                      )}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="rank" value={formData.rank} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">出店可否ジャッジ</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(JUDGMENT).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => !readOnly && setFormData({ ...formData, judgment: k as any })}
                      disabled={readOnly}
                      className={`py-2 px-3 rounded-lg border transition text-xs font-bold flex items-center justify-center gap-2 ${
                        formData.judgment === k
                          ? `${v.activeBg} ${v.border} ${v.color} shadow-md`
                          : `bg-white ${v.border} text-slate-500 ${v.hoverBg}`
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <Icon name={v.icon} size={14} /> {v.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="judgment" value={formData.judgment} />
              </div>
            </section>
          </form>

          <div className="p-4 border-t bg-white shrink-0 flex gap-3 pb-8 sm:pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
            {readOnly ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 text-slate-600 font-bold bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition"
                >
                  閉じる
                </button>
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex-[2] py-3.5 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Icon name="Edit" size={18} /> 編集
                  </button>
                )}
              </>
            ) : (
              <>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-slate-600 font-bold bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              onClick={() => formRef.current?.requestSubmit()}
              className="flex-[2] py-3.5 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {saving || loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-l-white rounded-full animate-spin" />
                  <span>保存中...</span>
                </div>
              ) : (
                <>
                  <Icon name="Save" size={18} /> 保存する
                </>
              )}
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

