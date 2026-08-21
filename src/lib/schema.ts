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

// Phase 2: Firestore 雲端字庫卡片型別 (含 SM-2 狀態)
export interface SavedWordCard extends WordAnalysis {
  id: string;
  userId: string;
  createdAt: number;
  repetition: number;     // 連續正確複習次數
  interval: number;       // 下次複習間隔 (天)
  easeFactor: number;     // 難度因子 (預設 2.5)
  nextReviewDate: number; // 下次複習時間戳記 (毫秒)
  lastReviewedAt: number | null;
}