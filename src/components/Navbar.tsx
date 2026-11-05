import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { getUserRole, logout } from '../lib/auth';

export function Navbar() {
  const location = useLocation();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    getUserRole().then(setRole).catch(() => setRole(null));
  }, []);

  const admin = role === 'admin';
  const general = role === 'general';
  const bar = general
    ? 'bg-sky-100/80 border border-sky-200'
    : 'bg-slate-100/80 border border-slate-200/50';
  const active = general
    ? 'bg-sky-500 text-white shadow-sm'
    : 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5';
  const idle = general
    ? 'text-sky-800/80 hover:text-sky-950 hover:bg-white/70'
    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50';
  const item = (path: string, compact = false) =>
    `${
      compact
        ? 'shrink-0 whitespace-nowrap px-3 py-2 text-xs gap-1 justify-center'
        : 'px-4 py-1.5 text-sm gap-2'
    } rounded-lg font-bold transition-all duration-200 flex items-center ${
      location.pathname === path ? active : idle
    }`;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className={`sticky top-0 z-40 px-6 py-4 shadow-sm/50 backdrop-blur-xl ${general ? 'bg-sky-50/90 border-b border-sky-200' : 'bg-white/80 border-b border-slate-200'}`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-xl tracking-tight leading-none">
                  <span className="font-bold text-slate-900">BASHOTORI </span>
                  <span className={`font-bold ml-1 ${general ? 'text-sky-500' : 'text-orange-500'}`}>First Courage</span>
                </h1>
              </div>
            </Link>

            <div className={`hidden md:flex p-1 rounded-xl ${bar}`}>
              <Link to="/" className={item('/')}>
                <Icon name="Calendar" size={16} /> カレンダー
              </Link>
              <Link to="/dashboard" className={item('/dashboard')}>
                <Icon name="TrendingUp" size={16} /> ダッシュボード
              </Link>
              <Link to="/map" className={item('/map')}>
                <Icon name="MapPin" size={16} /> 地図
              </Link>
              {admin && (
              <Link to="/places" className={item('/places')}>
                <Icon name="Compass" size={16} /> 場所登録
              </Link>
              )}
              <Link to="/search" className={item('/search')}>
                <Icon name="Search" size={16} /> AI店舗検索
              </Link>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
              general ? 'bg-sky-100 hover:bg-sky-200 text-sky-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Icon name="LogOut" size={16} />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>

        <div className={`md:hidden flex gap-1 overflow-x-auto scrollbar-hide p-1 rounded-xl w-full ${bar}`}>
          <Link ref={location.pathname === '/' ? activeRef : undefined} to="/" className={item('/', true)}>
            <Icon name="Calendar" size={14} /> カレンダー
          </Link>
          <Link ref={location.pathname === '/dashboard' ? activeRef : undefined} to="/dashboard" className={item('/dashboard', true)}>
            <Icon name="TrendingUp" size={14} /> ダッシュボード
          </Link>
          <Link ref={location.pathname === '/map' ? activeRef : undefined} to="/map" className={item('/map', true)}>
            <Icon name="MapPin" size={14} /> 地図
          </Link>
          {admin && (
          <Link ref={location.pathname === '/places' ? activeRef : undefined} to="/places" className={item('/places', true)}>
            <Icon name="Compass" size={14} /> 場所
          </Link>
          )}
          <Link ref={location.pathname === '/search' ? activeRef : undefined} to="/search" className={item('/search', true)}>
            <Icon name="Search" size={14} /> AI検索
          </Link>
        </div>
      </div>
    </header>
  );
}

