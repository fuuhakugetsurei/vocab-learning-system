import { SRSRecord, SavedWordCard } from "./schema";

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * SM-2 間隔重複計算
 * @param prev 當前 SRS 記錄
 * @param grade 使用者評分 (0: 完全忘記, 3: 勉強想起, 5: 完美反射)
 */
export function calculateSM2(prev: SRSRecord, grade: ReviewGrade): SRSRecord {
  let { interval, repetition, easeFactor } = prev;

  // 計算新的難度因子 (Ease Factor)
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // 若評分 < 3 (遺忘)，重置連續次數與間隔
  if (grade < 3) {
    repetition = 0;
    interval = 1;
  } else {
    // 答對，依據連續次數推算下次間隔天數
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    repetition,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewDate: nextDate.toISOString(),
    lastReviewDate: now.toISOString(),
  };
}

/**
 * 篩選出今天需要複習的單字卡 (nextReviewDate <= 當前時間)
 */
export function filterDueCards(cards: SavedWordCard[]): SavedWordCard[] {
  const now = new Date().getTime();
  return cards.filter((card) => {
    if (!card.srs?.nextReviewDate) return true;
    return new Date(card.srs.nextReviewDate).getTime() <= now;
  });
}