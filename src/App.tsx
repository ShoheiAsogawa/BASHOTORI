import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CalendarView from './pages/CalendarView';
import DashboardView from './pages/DashboardView';
import StoreSearchView from './pages/StoreSearchView';
import LoginView from './pages/LoginView';

const MapView = lazy(() => import('./pages/MapView'));
const PlaceRegisterView = lazy(() => import('./pages/PlaceRegisterView'));
import { getCurrentUser, type SessionUser } from './lib/auth';

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((error) => {
        console.error('Session error:', error);
        setUser(null);
      })
      .finally(() => setLoading(false));
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

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginView onLoginSuccess={setUser} />
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

