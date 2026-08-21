import { NextRequest, NextResponse } from 'next/server';
import { lookupCEECLevel } from '@/lib/ceec-dict';
import { lookupLocalDict } from '@/lib/local-dict';
import { WordAnalysisSchema, type WordAnalysis } from '@/lib/schema';
import { z } from 'zod';

export const runtime = 'nodejs';

// 移除 Markdown 標記、DeepSeek <think> 標籤與安全前綴
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/^User Safety: safe\s*/gi, '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { words, provider, apiKey, baseUrl, modelId } = body;

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: '請提供要查詢的單字清單' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: '請先在設定中填寫 API Key' }, { status: 401 });
    }

    // 1. 本地字典預查
    const wordsWithLocalInfo = words.map((w: string) => {
      const cleanWord = w.trim();
      const localData = lookupLocalDict(cleanWord);
      return {
        originalWord: cleanWord,
        localData,
      };
    });

    const promptInputDetails = wordsWithLocalInfo.map((item, idx) => {
      if (item.localData) {
        return `${idx + 1}. 單字: "${item.originalWord}" (已知音標: "${item.localData.phonetic}", 字典釋義: "${item.localData.translation}")`;
      }
      return `${idx + 1}. 輸入內容: "${item.originalWord}" (本地無釋義，若是中文請反查對應英文單字，若是拼錯請自動糾錯)`;
    }).join('\n');

    // 2. 嚴格對齊 WordAnalysisSchema 的 Prompt
    const systemPrompt = `你是一位專業的英語語言學專家與大考教學顧問。
使用者會提供一組輸入清單（英文單字、拼錯單字或中文）。部分單字已附帶已知字典釋義。
請為每個輸入輸出符合結構規範的 JSON 陣列。

【重要規範】
1. 所有中文（包含釋義、詞性說明、字根解釋、記憶法、例句翻譯）一律嚴格使用繁體中文（台灣）。不可使用簡體字。
2. 頂層格式必須為純 JSON 陣列 [...]。
3. 若單字已有「字典釋義」，請以該釋義整理出 meanings（主次語意），並專注於 etymology (字根字首與同字根關聯字)、collocations (搭配詞) 與 mnemonics (記憶技巧)。

【輸出 JSON 單一物件範例】
{
  "originalWord": "abandon",
  "isValid": true,
  "isCorrected": false,
  "errorMessage": "",
  "word": "abandon",
  "phonetic": "/əˈbændən/",
  "level": "4",
  "meanings": [
    { "pos": "v.", "primary": "放棄；拋棄", "secondary": ["遺棄", "中止"] },
    { "pos": "n.", "primary": "放任；狂熱", "secondary": [] }
  ],
  "collocations": [
    {
      "phrase": "abandon hope",
      "meaning": "放棄希望",
      "example": "They refused to abandon hope despite the crisis."
    }
  ],
  "etymology": {
    "prefix": "a- (朝向、加強)",
    "root": "bandon (控制、管轄)",
    "suffix": "",
    "relatedWords": ["ban", "bandit"]
  },
  "mnemonics": "諧音「一個半頓」，丟掉一個半頓的重物 -> 放棄、拋棄。",
  "examples": [
    { "en": "The sailors had to abandon the sinking ship.", "zh": "水手們不得不放棄這艘正在下沉的船。" }
  ],
  "synonyms": ["desert", "forsake", "relinquish"]
}`;

    const userPrompt = `請分析以下內容：\n${promptInputDetails}`;

    // 3. 呼叫 LLM
    let apiUrl = baseUrl;
    let authHeader = `Bearer ${apiKey}`;
    let resolvedModel = modelId;

    if (provider === 'gemini') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
    } else if (provider === 'groq') {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      resolvedModel = modelId || 'llama-3.3-70b-versatile';
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      resolvedModel = modelId || 'deepseek/deepseek-chat';
    } else if (!apiUrl) {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      resolvedModel = modelId || 'gpt-4o-mini';
    }

    let rawOutput = '';

    if (provider === 'gemini') {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API 呼叫失敗: ${errText}`);
      }

      const resData = await response.json();
      rawOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${provider} API 呼叫失敗: ${errText}`);
      }

      const resData = await response.json();
      rawOutput = resData.choices?.[0]?.message?.content || '';
    }

    // 4. 解析與驗證
    const cleanedJson = cleanJsonOutput(rawOutput);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      throw new Error(`無法解析模型回傳的 JSON: ${cleanedJson.substring(0, 100)}...`);
    }

    let resultsArray: unknown[] = [];
    if (Array.isArray(parsed)) {
      resultsArray = parsed;
    } else if (parsed && typeof parsed === 'object' && 'results' in parsed && Array.isArray((parsed as { results: unknown[] }).results)) {
      resultsArray = (parsed as { results: unknown[] }).results;
    } else if (parsed && typeof parsed === 'object') {
      resultsArray = [parsed];
    }

    const ArraySchema = z.array(WordAnalysisSchema);
    const parsedData = ArraySchema.safeParse(resultsArray);

    if (!parsedData.success) {
      console.error('Zod 驗證錯誤:', parsedData.error.format());
      return NextResponse.json({ error: '模型回傳結構不符合規範', details: parsedData.error.issues }, { status: 500 });
    }

    // 5. 結合 CEEC 7000 單覆寫 level 欄位
    const validatedResults: WordAnalysis[] = parsedData.data.map((card) => {
      const ceecLevel = lookupCEECLevel(card.word);
      return {
        ...card,
        level: ceecLevel ? `Level ${ceecLevel}` : (card.level || '7000單外'),
      };
    });

    return NextResponse.json({ results: validatedResults });
  } catch (error: unknown) {
    console.error('API 解析異常:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '內部處理發生錯誤' },
      { status: 500 }
    );
  }
}