import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CalendarView from './pages/CalendarView';
import DashboardView from './pages/DashboardView';
import StoreSearchView from './pages/StoreSearchView';
import LoginView from './pages/LoginView';

const MapView = lazy(() => import('./pages/MapView'));
const PlaceRegisterView = lazy(() => import('./pages/PlaceRegisterView'));
import { supabase } from './lib/supabase';
import { Icon } from './components/Icon';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証状態の確認
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }).catch((error) => {
        console.error('Session error:', error);
        setLoading(false);
      });

      // 認証状態の変更を監視
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => {
        subscription?.unsubscribe();
      };
    } else {
      // Supabaseクライアントが初期化されていない場合
      console.error('Supabase client is not initialized');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-slate-600 font-bold">読み込み中...</div>
        </div>
      </div>
    );
  }

  // Supabaseが初期化されていない場合のエラー表示
  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Icon name="AlertTriangle" size={24} className="text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">設定エラー</h2>
          </div>
          <div className="text-slate-600 space-y-2">
            <p>Supabaseが初期化されていません。</p>
            <p className="text-sm">環境変数が正しく設定されているか確認してください：</p>
            <ul className="text-sm list-disc list-inside space-y-1 mt-2">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
            <p className="text-xs text-slate-500 mt-4">
              AWS Amplify Consoleで環境変数を設定してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginView
              onLoginSuccess={() => {
                // ログイン成功時の処理はonAuthStateChangeで自動的に処理される
              }}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          user ? (
            <>
    <Routes>
      <Route path="/" element={<CalendarView />} />
      <Route path="/dashboard" element={<DashboardView />} />
      <Route
        path="/map"
        element={
          <Suspense fallback={<div className="p-10 text-center text-slate-500">地図を読み込み中...</div>}>
            <MapView />
          </Suspense>
        }
      />
      <Route path="/search" element={<StoreSearchView />} />
      <Route
        path="/places"
        element={
          <Suspense fallback={<div className="p-10 text-center text-slate-500">場所の登録を読み込み中...</div>}>
            <PlaceRegisterView />
          </Suspense>
        }
      />
              </Routes>
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;

