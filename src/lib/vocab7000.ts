import { WordAnalysis } from "./schema";
import ceecRawData from "@/data/ceec-vocab.json";
import { lookupLocalDict, parseDictTranslation, MeaningItem } from "./local-dict";

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

export function convertRawToWordAnalysis(raw: Raw7000Word): WordAnalysis {
  const meanings = raw.meaningsList && raw.meaningsList.length > 0
    ? raw.meaningsList.map((m) => ({
        pos: m.pos,
        primary: m.primary,
        secondary: m.secondary || [],
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

    // 3. 補充繁中釋義與音標 (透過 parseDictTranslation 拆解主次語意)
    const enrichedList: Raw7000Word[] = filtered.map((item) => {
      const cleanWord = item.word.trim();
      const dictResult = lookupLocalDict(cleanWord);

      let phonetic = "";
      let meaningsList: MeaningItem[] = [];

      if (dictResult) {
        phonetic = dictResult.phonetic || "";
        meaningsList = parseDictTranslation(dictResult.translation || "");
      } else {
        meaningsList = [{ pos: item.pos || "釋義", primary: "常見核心字彙", secondary: [] }];
      }

      return {
        word: item.word,
        level: item.level,
        pos: item.pos || "",
        phonetic: phonetic,
        meaningsList: meaningsList,
        meaning: meaningsList.map((m) => `${m.pos} ${m.primary}`).join(" ； "),
      };
    });

    return enrichedList;
  } catch (err) {
    console.error(`載入 Level ${level} 單字失敗:`, err);
    return [];
  }
}