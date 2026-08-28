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

    // 1. 提取並清理輸入單字清單（支援逗號、換行分隔，保留片語空格）
    let rawItems: string[] = [];
    if (Array.isArray(body)) {
      rawItems = body.map(String);
    } else if (body && typeof body === 'object') {
      const candidate =
        body.input ?? body.words ?? body.query ?? body.text ?? body.search;
      if (Array.isArray(candidate)) {
        rawItems = candidate.map(String);
      } else if (typeof candidate === 'string') {
        // 修正點：以 逗號、換行 切分，不再使用 \s+ 破壞片語空格
        rawItems = candidate.split(/[,，\r\n]+/);
      }
    }

    const words = rawItems
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (words.length === 0) {
      return NextResponse.json({ error: '請提供要查詢的單字或片語清單' }, { status: 400 });
    }

    // 2. 解構 API 設定
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

    // 3. 本地 ECDICT 字典預查與分類（若為片語或含空格，則不查單詞本地字典，由 AI 主導）
    const wordsWithLocalInfo = words.map((rawWord: string) => {
      // 若使用者輸入了底線 (take_part_in)，也轉換為空格標準片語格式
      const cleanWord = rawWord.includes('_') ? rawWord.replace(/_+/g, ' ').trim() : rawWord;
      const isChinese = /[\u4e00-\u9fa5]/.test(cleanWord);
      const isPhrase = cleanWord.includes(' ');
      const localData = (isChinese || isPhrase) ? null : lookupLocalDict(cleanWord);

      return {
        originalWord: rawWord,
        cleanWord,
        isChinese,
        isPhrase,
        localData,
      };
    });

    // 4. 構建 Prompt
    const promptInputList = wordsWithLocalInfo
      .map((item, idx) => {
        if (item.isChinese) {
          return `${idx + 1}. 中文概念: "${item.cleanWord}" (請反查其核心對應英文單字或片語，並給予深度分析)`;
        }
        if (item.isPhrase) {
          return `${idx + 1}. 英文片語: "${item.cleanWord}" (請給予完整詞性如 phr.、繁中釋義、搭配詞、記憶法與例句)`;
        }
        if (item.localData) {
          return `${idx + 1}. 英文單字: "${item.cleanWord}" (已知音標: "${item.localData.phonetic}", 已知中譯: "${item.localData.translation}")`;
        }
        return `${idx + 1}. 英文輸入: "${item.cleanWord}" (字典無資料，若為拼錯請更正，並提供完整分析)`;
      })
      .join('\n');

    const systemPrompt = `你是一位專業的英語教學專家與大考顧問。
使用者會提供一組輸入清單（英文單字、片語、拼錯單字或中文）。請針對每一項輸出結構化的深度學習卡片 JSON 陣列。

【重要準則】
1. 所有中文說明（釋義、詞性說明、字根解析、搭配詞釋義、記憶技巧、例句翻譯）一律嚴格使用台灣繁體中文，禁止使用簡體字。
2. 輸出必須為純 JSON 陣列格式 [...]，禁止任何額外文字或 Markdown 標籤。
3. 若輸入是片語（如 "take part in"），務必在 meanings 中填寫詞性 (pos: 如 "phr." 或 "v.") 與主要繁中釋義 (primary)。
4. 若偵測到使用者拼錯單字或輸入底線分隔，請將 isCorrected 設為 true，並於 word 填入標準英文單字/片語。
5. 請提供 2~4 個外型或發音極為相似的「形近/易混淆字」(confusables)，片語亦可提供結構相似的片語。
【輸出範例結構】
[
  {
    "originalWord": "take part in",
    "isValid": true,
    "isCorrected": false,
    "errorMessage": "",
    "word": "take part in",
    "phonetic": "/teɪk pɑːrt ɪn/",
    "meanings": [
      { "pos": "phr.", "primary": "參加；參與", "secondary": ["加入", "分擔"] }
    ],
    "collocations": [
      {
        "phrase": "take an active part in",
        "meaning": "積極參與",
        "example": "She takes an active part in school activities."
      }
    ],
    "etymology": {
      "prefix": "",
      "root": "take (取得) + part (部分) + in (在...之中) -> 參與其中",
      "suffix": "",
      "relatedWords": ["participate", "join"]
    },
    "mnemonics": "在活動中「拿 (take)」走屬於自己的那一個「角色/份額 (part)」，就是「參加」。",
    "examples": [
      {
        "en": "About 400 students took part in the competition.",
        "zh": "大約有 400 名學生參加了這場競賽。"
      }
    ],
    "synonyms": ["participate in", "join in", "engage in"],
    "confusables": ["take place", "take apart", "take pride in"]
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
      const targetWord = aiData.word || info.cleanWord;
      const ceecLevelStr = lookupCEECLevel(targetWord);

      const phonetic = info.localData?.phonetic || aiData.phonetic || '';

      let meanings = info.localData
        ? parseLocalTranslationToMeanings(info.localData.translation)
        : (aiData.meanings || []);

      if (!meanings || meanings.length === 0) {
        meanings = [{ pos: 'phr.', primary: '暫無詳細釋義', secondary: [] }];
      }

      const isCorrected =
        typeof aiData.isCorrected === 'boolean'
          ? aiData.isCorrected
          : info.cleanWord.toLowerCase() !== targetWord.toLowerCase() && !info.isChinese;

      return {
        originalWord: info.originalWord,
        isValid: aiData.isValid ?? true,
        isCorrected,
        errorMessage: aiData.errorMessage || '',
        word: targetWord,
        phonetic,
        level: ceecLevelStr || '7000單外',
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

    // 8. 最終 Zod Schema 校驗
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