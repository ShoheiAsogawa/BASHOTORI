import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { Icon } from '../components/Icon';
import { Calendar } from '../components/Calendar';
import { StoreFormModal } from '../components/StoreFormModal';
import { DayDetailModal } from '../components/DayDetailModal';
import { getStoreVisits, saveStoreVisit, deleteStoreVisit, type VisitWrite } from '../lib/api';
import { formatDate } from '../lib/utils';
import { canEditVisits } from '../lib/auth';
import type { StoreVisit } from '../types';

export default function CalendarView() {
  const [visits, setVisits] = useState<StoreVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [editingVisit, setEditingVisit] = useState<StoreVisit | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState<string>('ALL');
  const [filterJudgment, setFilterJudgment] = useState<string>('ALL');
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    loadData().catch((error) => {
      console.error('データ読み込みエラー:', error);
    });
    canEditVisits().then(setCanEdit).catch(() => setCanEdit(false));
  }, []);

  const loadData = async () => {
    try {
      const data = await getStoreVisits();
      setVisits(data);
    } catch (e) {
      console.error('Load Error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: VisitWrite): Promise<StoreVisit> => {
    setLoading(true);
    try {
      const savedData = await saveStoreVisit(data);
      await loadData();
      setIsFormOpen(false);
      setEditingVisit(null);
      return savedData;
    } catch (e) {
      alert('保存エラー: ' + (e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この視察記録を削除しますか？')) {
      return;
    }
    try {
      await deleteStoreVisit(id);
      await loadData();
    } catch (e) {
      alert('削除エラー: ' + (e as Error).message);
    }
  };


  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      const matchesSearch =
        v.facilityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.staffName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRank = filterRank === 'ALL' || v.rank === filterRank;
      const matchesJudgment = filterJudgment === 'ALL' || v.judgment === filterJudgment;
      return matchesSearch && matchesRank && matchesJudgment;
    });
  }, [visits, searchTerm, filterRank, filterJudgment]);

  const getDayVisits = (d: Date) => {
    if (!d) return [];
    const str = formatDate(d);
    return filteredVisits.filter((v) => v.date === str);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-4 sm:p-6 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          {/* ヘッダーセクション: 検索・日付・新規登録を整列 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              {/* 左側: 検索とフィルター */}
              <div className="flex-1 space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="Search" size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="施設名・担当者で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterRank}
                    onChange={(e) => setFilterRank(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500 font-bold text-slate-600 min-w-[100px]"
                  >
                    <option value="ALL">全ランク</option>
                    <option value="S">S</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                  <select
                    value={filterJudgment}
                    onChange={(e) => setFilterJudgment(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500 font-bold text-slate-600 min-w-[100px]"
                  >
                    <option value="ALL">全判定</option>
                    <option value="pending">調査中</option>
                    <option value="negotiating">交渉中</option>
                    <option value="approved">出店可</option>
                    <option value="rejected">不可/NG</option>
                  </select>
                </div>
              </div>

              {/* 中央: 日付表示とナビゲーション */}
              <div className="flex items-center gap-4 lg:mx-6">
                <button
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
                  }
                  className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-xl transition"
                  aria-label="前月"
                >
                  <Icon name="ChevronLeft" size={20} />
                </button>
                <div className="text-center min-w-[140px]">
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-800">
                    {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                  </h2>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="mt-1 text-xs text-slate-500 hover:text-orange-600 font-medium transition"
                  >
                    今日に戻る
                  </button>
                </div>
                <button
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
                  }
                  className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-xl transition"
                  aria-label="次月"
                >
                  <Icon name="ChevronRight" size={20} />
                </button>
              </div>

              {/* 右側: 新規登録ボタン（管理者のみ） */}
              {canEdit && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingVisit(null);
                      setIsFormOpen(true);
                    }}
                    className="w-full lg:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Icon name="Plus" size={18} />
                    新規登録
                  </button>
                </div>
              )}
            </div>
          </div>

          <Calendar
            currentDate={currentDate}
            visits={filteredVisits}
            onDateClick={(date) => setSelectedDateObj(date)}
            onAddClick={canEdit ? (date) => {
              setEditingVisit(null);
              setSelectedDateObj(date);
              setIsFormOpen(true);
            } : undefined}
          />
        </div>
      </main>

      <DayDetailModal
        dateObj={selectedDateObj}
        visits={selectedDateObj ? getDayVisits(selectedDateObj) : []}
        onClose={() => setSelectedDateObj(null)}
        onAdd={canEdit ? () => {
          setIsFormOpen(true);
          setEditingVisit(null);
        } : undefined}
        onEdit={canEdit ? (v) => {
          setIsFormOpen(true);
          setEditingVisit(v);
        } : undefined}
        onDelete={canEdit ? handleDelete : undefined}
      />

      {isFormOpen && (
        <StoreFormModal
          initialData={editingVisit}
          selectedDate={selectedDateObj}
          onClose={() => {
            setIsFormOpen(false);
            setEditingVisit(null);
          }}
          onSave={handleSave}
          loading={loading}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}

