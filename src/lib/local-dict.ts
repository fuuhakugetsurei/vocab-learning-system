import rawLocalDict from '@/data/local-dict.json';

interface DictEntry {
  p: string; // 音標 (Phonetic)
  t: string; // 台灣繁體中文釋義 (Translation)
}

// 建立記憶體 Hash Map 進行 O(1) 檢索
const localDictMap = new Map<string, DictEntry>(
  Object.entries(rawLocalDict as Record<string, DictEntry>)
);

export interface LocalLookupResult {
  phonetic: string;
  translation: string;
}

/**
 * 查詢本地 ECDICT 字典
 * @param word 英文單字
 * @returns 查詢結果或 null
 */
export function lookupLocalDict(word: string): LocalLookupResult | null {
  if (!word) return null;
  const normalized = word.toLowerCase().trim();
  const entry = localDictMap.get(normalized);
  if (!entry) return null;

  return {
    phonetic: entry.p || '',
    translation: entry.t || '',
  };
}