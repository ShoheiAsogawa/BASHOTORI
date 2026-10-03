// Gemini API呼び出し
const AWS_API_GATEWAY_URL = import.meta.env.VITE_AWS_API_GATEWAY_URL;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function callGemini(prompt: string): Promise<string> {
  // 優先順位: 1. API Gateway経由、2. 直接Gemini API、3. モック
  if (AWS_API_GATEWAY_URL) {
    // 本番環境: AWS Lambda経由
    try {
      const response = await fetch(AWS_API_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result || data.text || 'エラー: レスポンス形式が不正です';
    } catch (error) {
      console.error('Error calling API Gateway:', error);
      // フォールバック: 直接Gemini APIを試す
    }
  }

  // 開発環境: 直接Gemini APIを呼び出す
  if (GEMINI_API_KEY) {
    // まず利用可能なモデルを確認
    try {
      const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
      const modelsResponse = await fetch(listModelsUrl);
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        console.log('Available models:', modelsData.models?.map((m: any) => m.name) || 'No models found');
      }
    } catch (e) {
      console.warn('Could not fetch available models:', e);
    }

    // 利用可能なモデルから、generateContentをサポートするモデルを試す
    // リストから: gemini-2.5-flash, gemini-2.5-pro, gemini-flash-latest, gemini-pro-latest など
    const endpointsToTry = [
      { version: 'v1beta', model: 'gemini-2.5-flash' },
      { version: 'v1beta', model: 'gemini-2.5-pro' },
      { version: 'v1beta', model: 'gemini-flash-latest' },
      { version: 'v1beta', model: 'gemini-pro-latest' },
      { version: 'v1beta', model: 'gemini-2.0-flash' },
      { version: 'v1', model: 'gemini-2.5-flash' },
      { version: 'v1', model: 'gemini-2.5-pro' },
      { version: 'v1', model: 'gemini-flash-latest' },
      { version: 'v1', model: 'gemini-pro-latest' },
    ];

    for (let i = 0; i < endpointsToTry.length; i++) {
      const { version, model } = endpointsToTry[i];
      const isLast = i === endpointsToTry.length - 1;
      
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
        console.log(`Trying ${version}/${model}`);
        
        // タイムアウト付きfetch（90秒 - google_searchツール使用時は時間がかかるため）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${apiUrl}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            tools: [{ google_search: {} }], // Google検索ツールを有効化
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.text();
          let errorMessage = `Gemini API request failed: ${response.status}`;
          
          // 429エラー（レート制限）の場合は次のエンドポイントを試す
          if (response.status === 429) {
            console.warn(`${version}/${model} rate limited (429), trying next...`);
            if (!isLast) {
              continue;
            }
            errorMessage = 'APIレート制限に達しました。しばらく時間をおいて再度お試しください。';
          } else {
            try {
              const errorJson = JSON.parse(errorData);
              console.error(`${version}/${model} error:`, errorJson);
              if (errorJson.error) {
                errorMessage = errorJson.error.message || errorMessage;
              }
            } catch (e) {
              console.error('Gemini API error (raw):', errorData);
            }
          }
          
          // 最後のエンドポイントでない場合は次を試す
          if (!isLast) {
            console.log(`${version}/${model} failed, trying next...`);
            continue;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json() as any;

        if (data.error) {
          console.error(`${version}/${model} response error:`, data.error);
          if (!isLast) {
            continue;
          }
          throw new Error(data.error.message || 'Gemini API error');
        }

        // Google検索ツールを使用した場合、複数のレスポンスがある可能性がある
        let result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // テキストがない場合、functionCallの結果を確認
        if (!result && data.candidates?.[0]?.content?.parts) {
          const parts = data.candidates[0].content.parts;
          for (const part of parts) {
            if (part.text) {
              result = part.text;
              break;
            }
          }
        }
        
        if (!result) {
          console.warn('No text response, checking for function calls...', data);
          result = '検索結果を取得できませんでした。もう一度お試しください。';
        }
        
        console.log(`✅ Successfully used ${version}/${model}`);
        return result;
      } catch (error) {
        // タイムアウトエラーの処理
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('Request timeout:', error);
          if (isLast) {
            throw new Error('検索がタイムアウトしました。時間をおいて再度お試しください。');
          }
          continue;
        }
        
        // 最後のエンドポイントでも失敗した場合のみエラーをスロー
        if (isLast) {
          console.error('Error calling Gemini API directly:', error);
          // フォールバック: モックレスポンス
          console.warn('Falling back to mock response');
          return mockGeminiResponse(prompt);
        }
        // 次のエンドポイントを試す
        continue;
      }
    }
  }

  // 本番: Worker の /api/gemini が DeepSeek のウェブ検索を呼ぶ
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json().catch(() => ({} as { error?: string; result?: string; text?: string }));
    if (!response.ok) {
      throw new Error(data.error || `API request failed: ${response.statusText}`);
    }
    return data.result || data.text || 'エラー: レスポンス形式が不正です';
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    console.error('Error calling /api/gemini:', error);
  }

  // モックレスポンス（APIもWorkerも使えない開発時のみ）
  console.warn('No API key or Gateway URL set, returning mock response');
  return mockGeminiResponse(prompt);
}

// モックレスポンス（開発用）
function mockGeminiResponse(prompt: string): string {
  if (prompt.includes('売上シミュレーション')) {
    return `### 📊 AI売上予測\n- **予想日販**: 50,000円 〜 80,000円\n- **成功確率**: 70%\n- **推奨商材**: 貴金属、切手など\n\n### 💡 攻略アドバイス\n通行量が多いため、目立つ場所での集客が期待できます。`;
  } else if (prompt.includes('アドバイス')) {
    return '【AI営業アドバイス】\n今月は交渉中の案件が増えていますね！成約率を上げるため、優先順位をつけてフォローアップを強化しましょう。';
  } else if (prompt.includes('施設')) {
    return `### 施設名\n- **ジャンル**: ショッピングモール\n- **住所**: 東京都...\n- **Googleマップ**: [地図を見る](https://www.google.com/maps)\n- **特徴**: 集客力が高く、催事に適しています。`;
  }
  return 'AI分析結果（モック）';
}

