import { NextRequest, NextResponse } from 'next/server';
import { lookupCEECLevel } from '@/lib/ceec-dict';
import { lookupLocalDict } from '@/lib/local-dict';
import { WordAnalysisSchema, type WordAnalysis } from '@/lib/schema';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * 清理模型輸出的 Markdown 語法、思考鏈標籤與安全前綴
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/^User Safety:\s*safe\s*/gi, '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return cleaned;
}

/**
 * 將 ECDICT 釋義字串完整解析為乾淨的詞性與主次語意陣列
 */
function parseLocalTranslationToMeanings(translation: string) {
  if (!translation) return [{ pos: 'n.', primary: '暫無釋義', secondary: [] }];

  // 1. 清理所有形式的換行符與字面值轉義（\\n、\n、\r 等），全部標準化為換行
  const cleanStr = translation
    .replace(/\\+[rn]/g, '\n')
    .replace(/\r\n|\r|\n/g, '\n')
    .trim();

  // 2. 匹配所有常見詞性標記（加入 a. / ad. 以及中括號領域標籤如 [計] 等）
  const posRegex = /(?:^|\n|；|;|\s)(vt|vi|v|n|adj|adv|a|ad|prep|conj|pron|art|num|int|abbr|pl|\[[^\]]+\])\.\s*/gi;

  const matches: { pos: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = posRegex.exec(cleanStr)) !== null) {
    let rawPos = m[1].trim();
    // 詞性正規化: a. -> a., adj. -> a., ad. -> adv.
    if (rawPos.toLowerCase() === 'adj') rawPos = 'a';
    if (rawPos.toLowerCase() === 'ad') rawPos = 'adv';
    
    matches.push({
      pos: rawPos.startsWith('[') ? rawPos : `${rawPos.toLowerCase()}.`,
      index: m.index,
      length: m[0].length,
    });
  }

  const blocks: { pos: string; rawText: string }[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const startIndex = current.index + current.length;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : cleanStr.length;
      const text = cleanStr.substring(startIndex, endIndex).trim();
      if (text) {
        blocks.push({ pos: current.pos, rawText: text });
      }
    }
  } else {
    // 若無詞性標記，依換行或分號切分
    const parts = cleanStr.split(/[\n；;]+/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      blocks.push({ pos: '釋義', rawText: part });
    }
  }

  // 3. 處理每個詞性區塊的主語意與次語意
  const results = blocks.map((b) => {
    // 將括號轉為可切分的標點，並過濾多餘分隔符號
    const cleaned = b.rawText.replace(/[（()）]/g, '；').trim();
    const subParts = cleaned
      .split(/[\n\s,，、；;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      pos: b.pos,
      primary: subParts[0] || b.rawText,
      secondary: subParts.slice(1), // 完整保留所有次語意
    };
  });

  return results.length > 0 ? results : [{ pos: 'n.', primary: translation, secondary: [] }];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. 提取並清理輸入單字清單
    let words: string[] = [];
    if (Array.isArray(body)) {
      words = body.map(String);
    } else if (body && typeof body === 'object') {
      const candidate =
        body.input ?? body.words ?? body.query ?? body.text ?? body.search;
      if (Array.isArray(candidate)) {
        words = candidate.map(String);
      } else if (typeof candidate === 'string') {
        words = candidate.trim().split(/\s+/);
      }
    }

    words = words.map((w) => w.trim()).filter((w) => w.length > 0);
    if (words.length === 0) {
      return NextResponse.json({ error: '請提供要查詢的單字清單' }, { status: 400 });
    }

    // 2. 解構 API 設定 (相容 body.config 物件或頂層傳參)
    let provider = body.provider || 'gemini';
    let apiKey = body.apiKey || '';
    let baseUrl = body.baseUrl || '';
    let modelId = body.modelId || '';

    if (body.config) {
      const active = body.config.activeProvider || provider;
      provider = active;
      const targetConfig = body.config.configs?.[active] || {};
      apiKey = targetConfig.apiKey || apiKey;
      baseUrl = targetConfig.baseUrl || baseUrl;
      modelId = targetConfig.modelId || modelId;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `請先在右上角「自訂 API / 模型」設定中填寫 ${provider.toUpperCase()} 的 API Key` },
        { status: 401 }
      );
    }

    // 3. 本地 ECDICT 字典預查與分類
    const wordsWithLocalInfo = words.map((cleanWord: string) => {
      const isChinese = /[\u4e00-\u9fa5]/.test(cleanWord);
      const localData = isChinese ? null : lookupLocalDict(cleanWord);
      return {
        originalWord: cleanWord,
        isChinese,
        localData,
      };
    });

    // 4. 構建極限節流 Prompt
    const promptInputList = wordsWithLocalInfo
      .map((item, idx) => {
        if (item.isChinese) {
          return `${idx + 1}. 中文概念: "${item.originalWord}" (請反查其核心對應英文單字，並給予深度分析)`;
        }
        if (item.localData) {
          return `${idx + 1}. 英文單字: "${item.originalWord}" (已知音標: "${item.localData.phonetic}", 已知中譯: "${item.localData.translation}")`;
        }
        return `${idx + 1}. 英文輸入: "${item.originalWord}" (字典無資料，若為拼錯請更正，並提供完整分析)`;
      })
      .join('\n');

    const systemPrompt = `你是一位專業的英語教學專家與大考顧問。
使用者會提供一組輸入清單（英文單字、片語、拼錯單字或中文）。請針對每一項輸出結構化的深度學習卡片 JSON 陣列。

【重要準則】
1. 所有中文說明（釋義、詞性說明、字根解析、搭配詞釋義、記憶技巧、例句翻譯）一律嚴格使用台灣繁體中文，禁止使用簡體字。
2. 輸出必須為純 JSON 陣列格式 [...]，禁止任何額外文字或 Markdown 標籤。
3. 若輸入是片語或字典無資料，務必在 meanings 中填寫詞性 (pos: 如 "phr." 或 "v.") 與主要繁中釋義 (primary)。
4. 若偵測到使用者拼錯單字或輸入底線分隔，請將 isCorrected 設為 true，並於 word 填入標準英文單字/片語。
5. 請提供 2~4 個外型或發音極為相似的「形近/易混淆字」(confusables)，例如 cap 應列出 ["cop", "cope", "cape"]。
【輸出範例結構】
[
  {
    "originalWord": "shake_it_off",
    "isValid": true,
    "isCorrected": true,
    "errorMessage": "",
    "word": "shake off",
    "phonetic": "/ʃeɪk ɔf/",
    "meanings": [
      { "pos": "phr.", "primary": "擺脫；甩掉", "secondary": ["治好 (感冒)", "抖落"] }
    ],
    "collocations": [
      {
        "phrase": "shake off a cold",
        "meaning": "擺脫感冒",
        "example": "It took me a week to shake off that cold."
      }
    ],
    "etymology": {
      "prefix": "",
      "root": "shake (震動) + off (離開)",
      "suffix": "",
      "relatedWords": ["shock", "shiver"]
    },
    "mnemonics": "用力「搖一搖 (shake)」讓壞情緒全部「離開 (off)」。",
    "examples": [
      {
        "en": "She managed to shake off her nervousness.",
        "zh": "她在演出前成功甩掉了緊張情緒。"
      }
    ],
    "synonyms": ["desert", "forsake", "relinquish"],
    "confusables": ["abundant", "bandon"]
  }
]`;

    const userPrompt = `請分析以下清單：\n${promptInputList}`;

    // 5. 呼叫模型
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

    // 6. JSON 解析
    const cleanedJson = cleanJsonOutput(rawOutput);
    let parsed: any[];
    try {
      const tmp = JSON.parse(cleanedJson);
      if (Array.isArray(tmp)) {
        parsed = tmp;
      } else if (tmp && typeof tmp === 'object' && Array.isArray(tmp.results)) {
        parsed = tmp.results;
      } else if (tmp && typeof tmp === 'object') {
        parsed = [tmp];
      } else {
        parsed = [];
      }
    } catch {
      throw new Error(`無法解析模型回傳的 JSON: ${cleanedJson.substring(0, 100)}...`);
    }

    // 7. 本地字典與 AI 結果深度合併
    const mergedResults: WordAnalysis[] = wordsWithLocalInfo.map((info, idx) => {
      const aiData = parsed[idx] || {};
      const targetWord = aiData.word || info.originalWord;
      const ceecLevelStr = lookupCEECLevel(targetWord);

      const phonetic = info.localData?.phonetic || aiData.phonetic || '';

      let meanings = info.localData
        ? parseLocalTranslationToMeanings(info.localData.translation)
        : (aiData.meanings || []);

      if (!meanings || meanings.length === 0) {
        meanings = [{ pos: '釋義', primary: '暫無詳細釋義', secondary: [] }];
      }

      const isCorrected =
        typeof aiData.isCorrected === 'boolean'
          ? aiData.isCorrected
          : info.originalWord.toLowerCase() !== targetWord.toLowerCase() && !info.isChinese;

      return {
        originalWord: info.originalWord,
        isValid: aiData.isValid ?? true,
        isCorrected,
        errorMessage: aiData.errorMessage || '',
        word: targetWord,
        phonetic,
        level: ceecLevelStr || '7000單外', // 直接使用 clean 字串，不重複加 Level
        source: info.localData ? 'dict+ai' : 'ai-only',
        meanings,
        collocations: aiData.collocations || [],
        etymology: aiData.etymology || {
          prefix: '',
          root: '',
          suffix: '',
          relatedWords: [],
        },
        mnemonics: aiData.mnemonics || '',
        examples: aiData.examples || [],
        synonyms: aiData.synonyms || [],
        confusables: aiData.confusables || [],
      };
    });

    // 8. 最終 Zod Schema 嚴格型別校驗
    const ArraySchema = z.array(WordAnalysisSchema);
    const validation = ArraySchema.safeParse(mergedResults);

    if (!validation.success) {
      console.error('最終資料 Zod 驗證失敗:', validation.error.format());
      return NextResponse.json(
        { error: '資料整合驗證失敗', details: validation.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(validation.data);
  } catch (error: unknown) {
    console.error('API 解析異常:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '內部處理發生錯誤' },
      { status: 500 }
    );
  }
}