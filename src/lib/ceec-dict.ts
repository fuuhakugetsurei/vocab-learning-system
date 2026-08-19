// src/lib/ceec-dict.ts
import rawData from "@/data/ceec-vocab.json";

interface VocabEntry {
  id: number;
  word: string;
  pos: string;
  level: number;
}

// 建立全域 Hash Map (O(1) 查找)
const CEEC_7000_MAP = new Map<string, number>();

function initDict() {
  const list = (rawData as any).vocabulary as VocabEntry[];
  if (!list) return;

  for (const item of list) {
    const rawWord = item.word.toLowerCase().trim();

    // 處理括號或斜線分割詞（如 "actor/actress"、"achieve(ment)" 等）
    const cleanWords = rawWord
      .replace(/\(.*?\)/g, "") // 去除括號註解
      .split("/")             // 拆分斜線詞
      .map((w) => w.trim())
      .filter(Boolean);

    for (const w of cleanWords) {
      CEEC_7000_MAP.set(w, item.level);
    }
    
    // 同時保留原字串對照
    CEEC_7000_MAP.set(rawWord, item.level);
  }
}

// 模組載入時初始化一次
initDict();

/**
 * 查詢單字是否屬於大考中心 7000 單
 */
export function lookupCEECLevel(word: string): string | null {
  if (!word) return null;
  const target = word.toLowerCase().trim();
  
  const level = CEEC_7000_MAP.get(target);
  if (level) {
    return `Level ${level}`;
  }
  return null;
}