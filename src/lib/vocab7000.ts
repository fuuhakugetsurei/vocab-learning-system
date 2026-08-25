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

export function convertRawToWordAnalysis(raw: Raw7000Word): WordAnalysis {
  const rawTrans = raw.translation || "";
  const meanings = rawTrans
    ? rawTrans.split(/[；;]/).map((trans, idx) => ({
        pos: idx === 0 && raw.pos ? raw.pos : "釋義",
        primary: trans.trim(),
        secondary: [],
      }))
    : [{ pos: raw.pos || "釋義", primary: "暫無釋義", secondary: [] }];

  return {
    originalWord: raw.word,
    isValid: true,
    isCorrected: false,
    errorMessage: "",
    word: raw.word,
    phonetic: raw.phonetic || "",
    level: raw.level ? `Level ${raw.level}` : "7000單",
    source: "dict+ai",
    meanings,
    collocations: [],
    etymology: { prefix: "", root: "", suffix: "", relatedWords: [] },
    mnemonics: "",
    examples: raw.example
      ? [{ en: raw.example, zh: raw.exampleZh || "" }]
      : [],
    synonyms: [],
    confusables: [],
  };
}

export async function fetch7000WordsByLevel(level: number): Promise<Raw7000Word[]> {
  try {
    const res = await fetch(`/api/quick-lookup?level=${level}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error(`獲取 Level ${level} 單字失敗:`, err);
  }
  return [];
}