import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { supabase } from '../lib/supabase';

export function Navbar() {
  const location = useLocation();

  const handleLogout = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <header className="bg-white sticky top-0 z-40 px-6 py-4 border-b border-slate-200 shadow-sm/50 backdrop-blur-xl bg-white/80">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-xl tracking-tight leading-none">
                  <span className="font-bold text-slate-900">BASHOTORI </span>
                  <span className="font-bold text-orange-500 ml-1">First Courage</span>
                </h1>
              </div>
            </Link>

            <div className="hidden md:flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
              <Link
                to="/"
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === '/'
                    ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Icon name="Calendar" size={16} /> カレンダー
              </Link>
              <Link
                to="/dashboard"
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === '/dashboard'
                    ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Icon name="TrendingUp" size={16} /> ダッシュボード
              </Link>
              <Link
                to="/map"
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === '/map'
                    ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Icon name="MapPin" size={16} /> 地図
              </Link>
              <Link
                to="/search"
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === '/search'
                    ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Icon name="Search" size={16} /> AI店舗検索
              </Link>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition flex items-center gap-2"
          >
            <Icon name="LogOut" size={16} />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>

        <div className="md:hidden flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 w-full">
          <Link
            to="/"
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
              location.pathname === '/' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon name="Calendar" size={14} /> カレンダー
          </Link>
          <Link
            to="/dashboard"
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
              location.pathname === '/dashboard' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon name="TrendingUp" size={14} /> ダッシュボード
          </Link>
          <Link
            to="/map"
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
              location.pathname === '/map' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon name="MapPin" size={14} /> 地図
          </Link>
          <Link
            to="/search"
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
              location.pathname === '/search' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon name="Search" size={14} /> AI検索
          </Link>
        </div>
      </div>
    </header>
  );
}

