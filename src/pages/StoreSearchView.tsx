import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Icon } from '../components/Icon';
import { callGemini } from '../lib/gemini';
import { marked } from 'marked';
import { checkRateLimit, incrementRequestCount } from '../lib/rateLimit';

export default function StoreSearchView() {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    // リクエスト制限チェック
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      setResult(`❌ **リクエスト制限に達しました**\n\n本日の検索回数の上限（${rateLimit.limit}回）に達しました。\n明日（${new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString('ja-JP')}）にリセットされます。\n\n無料枠を超えないよう、1日あたり${rateLimit.limit}回までに制限しています。`);
      return;
    }

    setLoading(true);
    setResult('');

    // リクエストカウントを増やす
    incrementRequestCount();

    const prompt = `
あなたは日本の商業施設リサーチャーです。
**重要**: ウェブ検索で確認できた、実在する施設だけを答えてください。
虚偽の情報や推測による情報は一切含めないでください。

以下の地域の、催事イベント（買取イベント）の開催に適した集客力のある商業施設を5〜10件リストアップしてください。

ターゲット地域: ${location}

**検索要件**:
1. ウェブ検索で、実在する商業施設を調べてください
2. 各施設について、以下の情報を必ず確認してください：
   - 施設名（正確な名称）
   - 正確な住所
   - ジャンル・業種
   - 地図で開ける住所

**出力形式**（マークダウン）:
各施設について、以下の形式で出力してください：

### 施設名（実在する施設のみ）

- **ジャンル**: 
- **住所**: 
- **Googleマップ**: [地図を見る](https://www.google.com/maps/search/?api=1&query=施設名+住所)
- **特徴**: (集客力、客層など、実在する情報のみ)

**注意事項**:
- 実在しない施設は絶対に含めないでください
- 推測や創作の情報は含めないでください
- ウェブ検索で確認できない施設は除外してください
- 各施設の住所は、地図検索できる正式な表記にしてください
- 検索で見つかった出典がある施設だけをリストアップしてください
    `;

    try {
      // ウェブ検索つきの回答は時間がかかるため、120秒で打ち切る
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('検索がタイムアウトしました。時間をおいて再度お試しください。')), 120000);
      });

      const responsePromise = callGemini(prompt);
      const response = await Promise.race([responsePromise, timeoutPromise]);
      setResult(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('店舗検索エラー:', error);
      setResult(`❌ 検索エラーが発生しました。\n\n**エラー詳細**: ${errorMessage}\n\n**対処方法**:\n- 時間をおいて、もう一度検索してください\n- ブラウザのコンソール（F12）で詳細なエラーを確認してください`);
    } finally {
      setLoading(false);
    }
  };

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
              地域名を入力すると、AIがGoogle検索を行い、催事に適した商業施設をリストアップします。
            </p>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 大阪府岸和田市、神奈川県横浜市..."
                className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-base outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
              <button
                type="submit"
                disabled={loading || !location || !checkRateLimit().allowed}
                className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg w-32 justify-center whitespace-nowrap text-sm"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-l-white rounded-full animate-spin" />
                    <span className="text-xs">検索中</span>
                  </div>
                ) : (
                  <>
                    <Icon name="Search" size={18} /> 検索
                  </>
                )}
              </button>
            </form>
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

          {!result && !loading && (
            <div className="text-center py-20 text-slate-400">
              <Icon name="Compass" size={48} className="mx-auto mb-4 opacity-20" />
              <p>地域を入力して検索を開始してください</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

