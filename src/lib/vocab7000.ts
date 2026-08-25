import { WordAnalysis } from "./schema";

export interface Raw7000Word {
  word: string;
  phonetic?: string;
  level?: number | string;
  translation?: string;
  pos?: string;
  example?: string;
  exampleZh?: string;
}

// 將 7000 單簡化結構轉成系統標準的 WordAnalysis 格式
export function convertRawToWordAnalysis(raw: Raw7000Word): WordAnalysis {
  const meanings = raw.translation
    ? raw.translation.split("；").map((trans, idx) => ({
        pos: idx === 0 && raw.pos ? raw.pos : "釋義",
        primary: trans.trim(),
        secondary: [],
      }))
    : [{ pos: raw.pos || "釋義", primary: "暫無釋義", secondary: [] }];

  const examples = raw.example
    ? [
        {
          en: raw.example,
          zh: raw.exampleZh || "例句翻譯",
        },
      ]
    : [];

  return {
    originalWord: raw.word,
    isValid: true,
    isCorrected: false,
    errorMessage: "",
    word: raw.word,
    phonetic: raw.phonetic || "",
    level: raw.level ? `Level ${raw.level}` : "Level 3",
    source: "dict+ai",
    meanings,
    collocations: [],
    etymology: { prefix: "", root: "", suffix: "", relatedWords: [] },
    mnemonics: "",
    examples,
    synonyms: [],
    confusables: [],
  };
}

// 取得指定 Level 的單字清單 (透過 API 或是動態載入 public 目錄下的 json)
export async function fetch7000WordsByLevel(level: number): Promise<Raw7000Word[]> {
  try {
    const res = await fetch(`/api/quick-lookup?level=${level}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn("無法透過 API 取得 7000 單，嘗試讀取靜態檔...", err);
  }

  // 備用方案：若有放 public/7000.json
  try {
    const res = await fetch("/7000.json");
    if (res.ok) {
      const allWords: Raw7000Word[] = await res.json();
      return allWords.filter((w) => Number(w.level) === level);
    }
  } catch (e) {
    console.error("載入 7000.json 失敗", e);
  }

  return [];
}