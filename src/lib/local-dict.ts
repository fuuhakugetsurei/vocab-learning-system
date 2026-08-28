import rawLocalDict from '@/data/local-dict.json';

interface DictEntry {
  p: string; // 音標
  t: string; // 繁中釋義
}

const localDictMap = new Map<string, DictEntry>(
  Object.entries(rawLocalDict as Record<string, DictEntry>)
);

export interface MeaningItem {
  pos: string;
  primary: string;
  secondary: string[];
}

export interface LocalLookupResult {
  phonetic: string;
  translation: string;
  meanings: MeaningItem[];
}

/**
 * 將 ECDICT 釋義字串結構化拆解為詞性、核心主語意與次語意陣列
 */
export function parseDictTranslation(translation: string): MeaningItem[] {
  if (!translation) return [{ pos: 'n.', primary: '暫無釋義', secondary: [] }];

  const cleanStr = translation
    .replace(/\\+[rn]/g, '\n')
    .replace(/\r\n|\r|\n/g, '\n')
    .trim();

  const posRegex = /(?:^|\n|；|;|\s)(vt|vi|v|n|adj|adv|a|ad|prep|conj|pron|art|num|int|abbr|pl|\[[^\]]+\])\.\s*/gi;

  const matches: { pos: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = posRegex.exec(cleanStr)) !== null) {
    let rawPos = m[1].trim();
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
    const parts = cleanStr.split(/[\n；;]+/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      blocks.push({ pos: '釋義', rawText: part });
    }
  }

  const results = blocks.map((b) => {
    const cleaned = b.rawText.replace(/[（()）]/g, '；').trim();
    const subParts = cleaned
      .split(/[\n\s,，、；;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      pos: b.pos,
      primary: subParts[0] || b.rawText,
      secondary: subParts.slice(1),
    };
  });

  return results.length > 0 ? results : [{ pos: 'n.', primary: translation, secondary: [] }];
}

export function lookupLocalDict(word: string): LocalLookupResult | null {
  if (!word) return null;
  const normalized = word.toLowerCase().trim();
  const entry = localDictMap.get(normalized);
  if (!entry) return null;

  return {
    phonetic: entry.p || '',
    translation: entry.t || '',
    meanings: parseDictTranslation(entry.t || ''),
  };
}