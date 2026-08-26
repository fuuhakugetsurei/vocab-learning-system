import { WordAnalysis } from "./schema";
import ceecRawData from "@/data/ceec-vocab.json";
import { lookupLocalDict } from "./local-dict";

export interface MeaningItem {
  pos: string;
  def: string;
}

export interface Raw7000Word {
  word: string;
  phonetic?: string;
  level?: number | string;
  pos?: string;
  meaningsList?: MeaningItem[];
  meaning?: string;
  category?: string;
  example?: string;
  exampleZh?: string;
}

/**
 * 精準拆解多詞性字串（相容 a., adj., n., vt., vi., adv. 等）
 */
function parseMultiPosMeanings(rawTranslation: string, fallbackPos: string): MeaningItem[] {
  if (!rawTranslation) {
    return [{ pos: fallbackPos || "釋義", def: "常見核心字彙" }];
  }

  // 將常見的換行與跳脫符號統一轉為分號
  const normalized = rawTranslation
    .replace(/\\n/g, " ; ")
    .replace(/\n/g, " ; ")
    .trim();

  // 詞性正規標記
  const posPattern = /(?:^|[;\s；])((?:adj|adv|art|conj|int|prep|pron|num|aux|abbr|phr|vt|vi|[nva])\.)\s*/gi;

  const matches = [...normalized.matchAll(posPattern)];
  if (matches.length === 0) {
    return [{ pos: fallbackPos || "釋義", def: normalized }];
  }

  const items: MeaningItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    let posTag = current[1].toLowerCase();
    if (posTag === "a.") posTag = "adj."; // 統一將 a. 正規化為 adj.

    const startIndex = current.index! + current[0].length;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index! : normalized.length;

    let defText = normalized.substring(startIndex, endIndex).trim();
    defText = defText.replace(/^[；;,\s]+|[；;,\s]+$/g, ""); // 去除頭尾多餘分號

    if (defText) {
      items.push({
        pos: posTag,
        def: defText,
      });
    }
  }

  return items.length > 0 ? items : [{ pos: fallbackPos || "釋義", def: normalized }];
}

export function convertRawToWordAnalysis(raw: Raw7000Word): WordAnalysis {
  const meanings = raw.meaningsList && raw.meaningsList.length > 0
    ? raw.meaningsList.map((m) => ({
        pos: m.pos,
        primary: m.def,
        secondary: [],
      }))
    : [{ pos: raw.pos || "釋義", primary: raw.meaning || "暫無釋義", secondary: [] }];

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
    examples: raw.example ? [{ en: raw.example, zh: raw.exampleZh || "" }] : [],
    synonyms: [],
    confusables: [],
  };
}

export async function fetch7000WordsByLevel(level: number): Promise<Raw7000Word[]> {
  try {
    const rawVocab = (ceecRawData as { vocabulary?: Array<{ word: string; level: number; pos?: string }> }).vocabulary || [];
    if (!Array.isArray(rawVocab)) return [];

    // 1. 篩選指定 Level
    const filtered = rawVocab.filter((item) => Number(item.level) === level);

    // 2. 依照字母 A-Z 固定排序
    filtered.sort((a, b) => a.word.localeCompare(b.word));

    // 3. 補充繁中釋義與音標
    const enrichedList: Raw7000Word[] = filtered.map((item) => {
      const cleanWord = item.word.trim();
      const dictResult = lookupLocalDict(cleanWord);

      let phonetic = "";
      let meaningsList: MeaningItem[] = [];

      if (dictResult) {
        phonetic = dictResult.phonetic || "";
        meaningsList = parseMultiPosMeanings(dictResult.translation || "", item.pos || "");
      } else {
        meaningsList = [{ pos: item.pos || "釋義", def: "常見核心字彙" }];
      }

      return {
        word: item.word,
        level: item.level,
        pos: item.pos || "",
        phonetic: phonetic,
        meaningsList: meaningsList,
        meaning: meaningsList.map((m) => `${m.pos} ${m.def}`).join(" ； "),
      };
    });

    return enrichedList;
  } catch (err) {
    console.error(`載入 Level ${level} 單字失敗:`, err);
    return [];
  }
}