import { z } from "zod";

export const WordAnalysisSchema = z.object({
  originalWord: z.string().nullish().transform((v) => v || ""),
  isValid: z.boolean().nullish().transform((v) => v ?? true),
  isCorrected: z.boolean().nullish().transform((v) => v ?? false),
  errorMessage: z.string().nullish().transform((v) => v || ""),

  word: z.string().nullish().transform((v) => v || ""),
  phonetic: z.string().nullish().transform((v) => v || ""),
  level: z.string().nullish().transform((v) => v || "7000單外"),
  source: z.enum(["dict+ai", "ai-only"]).default("dict+ai"), // 標註資料來源

  meanings: z
    .array(
      z.object({
        pos: z.string().nullish().transform((v) => v || "n."),
        primary: z.string().nullish().transform((v) => v || ""),
        secondary: z.array(z.string()).nullish().transform((v) => v || []),
      })
    )
    .nullish()
    .transform((v) => v || []),

  collocations: z
    .array(
      z.object({
        phrase: z.string().describe("常用英文搭配詞組"),
        meaning: z.string().describe("繁體中文語意"),
        example: z.string().nullish().transform((v) => v || "").describe("實用短句"),
      })
    )
    .nullish()
    .transform((v) => v || []),

  etymology: z
    .object({
      prefix: z.string().nullish().transform((v) => v || ""),
      root: z.string().nullish().transform((v) => v || ""),
      suffix: z.string().nullish().transform((v) => v || ""),
      relatedWords: z.array(z.string()).nullish().transform((v) => v || []),
    })
    .nullish()
    .transform((v) => v || { prefix: "", root: "", suffix: "", relatedWords: [] }),

  mnemonics: z.string().nullish().transform((v) => v || ""),

  examples: z
    .array(
      z.object({
        en: z.string().nullish().transform((v) => v || ""),
        zh: z.string().nullish().transform((v) => v || ""),
      })
    )
    .nullish()
    .transform((v) => v || []),

  // 在 synonyms 底下新增 confusables
  synonyms: z.array(z.string()).nullish().transform((v) => v || []),
  confusables: z.array(z.string()).nullish().transform((v) => v || []).describe("形近或易混淆單字清單")
});

export const BatchWordAnalysisSchema = z.object({
  results: z.array(WordAnalysisSchema),
});

export type WordAnalysis = z.infer<typeof WordAnalysisSchema>;

// --- 新增：雲端單字卡與 SRS 複習型別 ---

export interface SRSRecord {
  interval: number;       // 當前間隔天數 (I_n)
  repetition: number;     // 連續正確次數 (n)
  easeFactor: number;     // 難度因子 (EF, 預設 2.5)
  nextReviewDate: string; // 下次複習時間 (ISO 8601 字串)
  lastReviewDate?: string;// 上次複習時間 (ISO 8601 字串)
}

export interface SavedWordCard {
  id: string;             // 單字 (小寫作為 Firestore Document ID)
  word: string;
  data: WordAnalysis;     // 完整的深度解析資料
  savedAt: string;        // 收藏時間 (ISO 8601 字串)
  srs: SRSRecord;         // SRS 複習狀態
  tags?: string[];        // 標籤 (預設包含 CEEC 等級)
}