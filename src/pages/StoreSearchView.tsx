import { useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Icon } from '../components/Icon';
import { callGemini } from '../lib/gemini';
import { getCurrentLocation } from '../lib/location';
import {
  buildStoreSearchPrompt,
  orderSearchResult,
  searchArea,
  type Origin,
} from '../lib/nearbySearch';
import { reverseGeocodePin } from '../lib/supabase';
import { marked } from 'marked';

export default function StoreSearchView() {
  const [location, setLocation] = useState('');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [result, setResult] = useState('');
  const [hint, setHint] = useState('');
  const requestRef = useRef(0);

  const busy = locating || loading || sorting;

  const readOrigin = async (force: boolean): Promise<{ here: Origin | null; error: string }> => {
    if (origin && !force) return { here: origin, error: '' };
    setLocating(true);
    try {
      const position = await getCurrentLocation();
      let label = '現在地付近';
      try {
        const place = await reverseGeocodePin(position.latitude, position.longitude);
        label = searchArea(place.address, place.prefecture) || label;
      } catch (error) {
        console.warn('現在地の住所を取得できませんでした', error);
      }
      const next = { latitude: position.latitude, longitude: position.longitude, label };
      setOrigin(next);
      return { here: next, error: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : '現在地を取得できませんでした';
      return { here: null, error: message };
    } finally {
      setLocating(false);
    }
  };

  const runSearch = async (area: string, here: Origin | null, unsortedHint = '現在地が取れないため、距離順には並べていません') => {
    const requestId = ++requestRef.current;
    setHint('');
    setLoading(true);
    setResult('');
    const prompt = buildStoreSearchPrompt(area, here);

    try {
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('検索がタイムアウトしました。時間をおいて再度お試しください。')), 120000);
      });
      const response = await Promise.race([callGemini(prompt), timeoutPromise]);
      if (requestId !== requestRef.current) return;

      if (!here) {
        setResult(response);
        setHint(unsortedHint);
        return;
      }

      setLoading(false);
      setSorting(true);
      const ordered = await orderSearchResult(response, here);
      if (requestId !== requestRef.current) return;
      setResult(ordered.markdown);
      if (!ordered.sorted) {
        setHint('住所から距離を計算できなかったので、検索順のままです');
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('店舗検索エラー:', error);
      setResult(`❌ 検索エラーが発生しました。\n\n**エラー詳細**: ${errorMessage}\n\n**対処方法**:\n- 時間をおいて、もう一度検索してください\n- ブラウザのコンソール（F12）で詳細なエラーを確認してください`);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setSorting(false);
      }
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const { here, error } = await readOrigin(false);
    const area = location.trim() || (here && here.label !== '現在地付近' ? here.label : '');
    if (!area) {
      setHint(error || '地域名を入力するか、現在地の利用を許可してください');
      return;
    }
    if (!location.trim() && here) setLocation(here.label);
    await runSearch(area, here, error || undefined);
  };

  const handleNearMe = async () => {
    const { here, error } = await readOrigin(true);
    if (!here) {
      setHint(error || '現在地を取得できませんでした');
      return;
    }
    if (here.label !== '現在地付近') setLocation(here.label);
    await runSearch(here.label, here);
  };

  const status = locating
    ? '現在地を取得しています'
    : loading
      ? '周辺の施設を検索しています'
      : sorting
        ? '現在地から近い順に並べています'
        : '';

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-4 sm:p-6 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Icon name="Sparkles" className="text-orange-500" /> AI店舗検索{' '}
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                Google検索連動
              </span>
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              地域名で探すか、現在地から探すと、いまいる場所から近い順に催事向きの商業施設を出します。
            </p>

            <form onSubmit={handleSearch} className="flex flex-col gap-2">
              <input
                type="text"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  if (event.target.value.trim()) setHint('');
                }}
                placeholder="例: 大阪府岸和田市、神奈川県横浜市..."
                className="min-w-0 w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-base outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleNearMe()}
                  disabled={busy}
                  className="flex-1 bg-orange-500 text-white px-3 py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <Icon name="MapPin" size={18} />
                  {locating ? '取得中' : '現在地から検索'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 bg-slate-900 text-white px-3 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-l-white rounded-full animate-spin" />
                      検索中
                    </>
                  ) : (
                    <>
                      <Icon name="Search" size={18} /> 検索
                    </>
                  )}
                </button>
              </div>
            </form>
            {origin && !status && (
              <p className="mt-3 text-xs font-bold text-slate-500">近い順の基準: {origin.label}</p>
            )}
            {status && <p className="mt-3 text-sm font-bold text-orange-700">{status}</p>}
            {hint && <p className="mt-2 text-sm font-bold text-orange-700">{hint}</p>}
          </div>

          {result && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fade-in">
              <div
                className="prose prose-slate max-w-none prose-strong:text-orange-700 prose-headings:text-slate-800 prose-a:text-orange-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline"
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const renderer = new marked.Renderer();
                    renderer.link = (href: string, title: string | null | undefined, text: string) => {
                      return `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;
                    };
                    return marked.parse(result, {
                      breaks: true,
                      gfm: true,
                      renderer,
                    });
                  })()
                }}
              />
            </div>
          )}

          {!result && !busy && (
            <div className="text-center py-20 text-slate-400">
              <Icon name="Compass" size={48} className="mx-auto mb-4 opacity-20" />
              <p>地域を入力するか、現在地から検索してください</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
