// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { BatchWordAnalysisSchema } from "@/lib/schema";
import { CustomApiConfig, ProviderType } from "@/lib/api-config";
import { lookupCEECLevel } from "@/lib/ceec-dict";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, config } = body as { input: string; config?: CustomApiConfig };

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "請輸入有效的英文或中文單字" }, { status: 400 });
    }

    // 以空白切分，最多支援一次 10 個詞彙
    const words = Array.from(new Set(input.trim().split(/\s+/).filter(Boolean))).slice(0, 10);
    if (words.length === 0) {
      return NextResponse.json({ error: "未偵測到任何詞彙" }, { status: 400 });
    }

    const systemInstruction = `
你是一位專精於台灣高中英語教學與詞彙學的專家。請深度分析使用者提供的詞彙清單（可能包含英文單字、拼錯英文、或中文詞彙）。

【語言與格式規範】：
- 所有中文解釋、翻譯、記憶法、例句翻譯一律使用「繁體中文（台灣）」。
- 字首 (prefix)、字根 (root)、字尾 (suffix) 的意涵解釋必須使用「繁體中文」。
- 必須輸出純 JSON 物件，包含 results 陣列。

JSON 格式規範：
{
  "results": [
    {
      "originalWord": "輸入的原字串（中文或英文）",
      "isValid": true,
      "isCorrected": false,
      "errorMessage": "",
      "word": "英文單字原形",
      "phonetic": "/音標/",
      "level": "Level 1 ~ Level 6 或 7000單外",
      "meanings": [{"pos": "詞性", "primary": "主要繁中解釋", "secondary": ["次要解釋"]}],
      "collocations": [{"phrase": "搭配詞組", "meaning": "繁中意思", "example": "極簡短句"}],
      "etymology": {"prefix": "字首繁中", "root": "字根繁中", "suffix": "字尾繁中", "relatedWords": ["關聯單字"]},
      "mnemonics": "繁中記憶技巧",
      "examples": [{"en": "Example.", "zh": "例句翻譯。"}],
      "synonyms": ["同義詞"]
    }
  ]
}

【輸入情況處理原則】：
1. 【中文查詢】（例如輸入 "放棄"、"堅持"）：
   - originalWord 填入原始中文（例如 "放棄"）
   - word 填入最核心、最道地對應的「英文目標單字原形」（例如 "abandon" 或 "persist"）
   - isValid 設為 true
   - isCorrected 設為 false
   - 針對該英文單字產出完整的解析、搭配詞與例句。
2. 【拼寫錯誤英文】（例如 "tactik" -> "tactic"）：
   - originalWord 填入原錯字，word 填入正確單字，isValid=true, isCorrected=true。
3. 【英文正確單字】：
   - originalWord 與 word 均填該單字，isValid=true, isCorrected=false。
4. 【無意義亂碼】（例如 "cfjkerkoe"）：
   - originalWord 填原字串, isValid=false, errorMessage="查無此單字/詞彙", 其餘留空。
`;

    let contentText = "";
    const activeProvider: ProviderType = config?.activeProvider || "gemini";
    const currentItem = config?.configs?.[activeProvider];
    const apiKey = currentItem?.apiKey || (activeProvider === "gemini" ? process.env.GEMINI_API_KEY : "");
    const modelId = currentItem?.modelId || (activeProvider === "gemini" ? "gemini-2.5-flash" : "google/gemini-2.0-flash-exp:free");

    if (!apiKey && activeProvider === "gemini" && !process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "尚未設定 Gemini API Key，請至右上角設定填入。" }, { status: 400 });
    }
    if (!apiKey && activeProvider !== "gemini") {
      return NextResponse.json({ error: `尚未設定 ${activeProvider} API Key，請至右上角設定填入。` }, { status: 400 });
    }

    if (activeProvider === "gemini") {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: `請分析以下詞彙清單: [${words.join(", ")}]`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      contentText = response.text || "";
    } else {
      let baseURL = currentItem?.baseUrl;
      if (activeProvider === "groq") baseURL = baseURL || "https://api.groq.com/openai/v1";
      if (activeProvider === "openrouter") baseURL = baseURL || "https://openrouter.ai/api/v1";
      if (activeProvider === "openai-compatible") baseURL = baseURL || "https://api.openai.com/v1";

      const defaultHeaders: Record<string, string> = {};
      if (activeProvider === "openrouter") {
        defaultHeaders["HTTP-Referer"] = "http://localhost:3000";
        defaultHeaders["X-Title"] = "VocabLearner";
      }

      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        defaultHeaders: defaultHeaders,
      });

      const completion = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `請分析以下詞彙清單: [${words.join(", ")}]` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      contentText = completion.choices[0].message.content || "";
    }

    if (!contentText) throw new Error("AI 服務未回傳任何內容");

    // 【容錯處理】：過濾思考標籤、User Safety 標籤與 Markdown 語法，擷取 JSON 區塊
    const cleanText = contentText
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/User Safety:.*?\n/gi, "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    let parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);

    // ✅ 替換為：相容「純陣列」、「單一物件卡片」、「正常 results 陣列」
    if (Array.isArray(parsedJson)) {
      // 情況 1：AI 直接回傳 [ {...}, {...} ]
      parsedJson = { results: parsedJson };
    } else if (parsedJson && !parsedJson.results) {
      // 情況 2：AI 偷懶直接回傳單一單字物件 { word: "...", phonetic: "..." }
      if (parsedJson.word || parsedJson.originalWord) {
        parsedJson = { results: [parsedJson] };
      } else {
        // 萬一 AI 用了別的 key (例如 { "data": [...] } 或 { "words": [...] })
        const possibleArray = Object.values(parsedJson).find((v) => Array.isArray(v));
        parsedJson = { results: (possibleArray as any[]) || [parsedJson] };
      }
    }

    const validatedData = BatchWordAnalysisSchema.parse(parsedJson);

    // 混合查表：以輸出的英文目標字比對 7000 單字典
    const finalResults = validatedData.results.map((card) => {
      if (card.isValid && card.word) {
        const officialLevel = lookupCEECLevel(card.word);
        if (officialLevel) {
          card.level = officialLevel;
        } else if (!card.level.startsWith("Level")) {
          card.level = "7000單外";
        }
      }
      return card;
    });

    return NextResponse.json(finalResults, { status: 200 });
  } catch (error: any) {
    console.error("API Error Details:", error);
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "AI 輸出資料結構不符規範", details: error.issues }, { status: 500 });
    }
    return NextResponse.json({ error: error.message || "伺服器請求發生錯誤" }, { status: 500 });
  }
}