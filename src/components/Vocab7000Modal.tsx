"use client";

import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { Raw7000Word, convertRawToWordAnalysis, fetch7000WordsByLevel } from "@/lib/vocab7000";
import { saveWordCard, updateWordSRS, fetchUserVocabularies } from "@/lib/firebase";
import { calculateSM2 } from "@/lib/srs";
import { WordAnalysis, SavedWordCard } from "@/lib/schema";
import { 
  X, 
  Volume2, 
  ChevronRight, 
  Sparkles, 
  RotateCw, 
  Loader2,
  BookOpen,
  ArrowLeft,
  Search
} from "lucide-react";

interface Vocab7000ModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onCardSaved?: () => void;
  onDeepAnalyze?: (word: string) => void;
}

export function Vocab7000Modal({
  isOpen,
  onClose,
  user,
  onCardSaved,
  onDeepAnalyze,
}: Vocab7000ModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [wordList, setWordList] = useState<Raw7000Word[]>([]);
  const [loading, setLoading] = useState(false);

  // 視圖切換："list" (列表總覽) 或 "card" (單字卡學習)
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [processingSave, setProcessingSave] = useState(false);

  // 使用者的雲端單字紀錄（用來判斷燈號狀態）
  const [userVocabMap, setUserVocabMap] = useState<Map<string, SavedWordCard>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");

  // 載入等級單字與使用者的雲端複習狀態
  useEffect(() => {
    if (!isOpen) return;
    async function loadData() {
      setLoading(true);
      const list = await fetch7000WordsByLevel(selectedLevel);
      setWordList(list);

      // 若使用者已登入，取得雲端字庫以對應燈號
      if (user) {
        try {
          const userCards = await fetchUserVocabularies(user);
          const map = new Map<string, SavedWordCard>();
          userCards.forEach((c) => map.set(c.word.toLowerCase(), c));
          setUserVocabMap(map);
        } catch (err) {
          console.error("載入使用者雲端字庫失敗:", err);
        }
      } else {
        setUserVocabMap(new Map());
      }

      setLoading(false);
    }
    loadData();
  }, [isOpen, selectedLevel, user]);

  if (!isOpen) return null;

  // 依搜尋條件過濾列表
  const filteredWords = wordList.filter((w) => 
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (w.meaning && w.meaning.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentRawWord = wordList[currentIndex];

  const playAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 根據使用者的 SRS 記錄判定燈號顏色
  // 🔴 不熟 (interval <= 2 或 repetition === 0)
  // 🟡 中等 (interval 3 ~ 10)
  // 🟢 精熟 (interval > 10)
  // ⚪️ 未學 (不在雲端字庫中)
  const getWordStatusBadge = (word: string) => {
    const record = userVocabMap.get(word.toLowerCase());
    if (!record) {
      return <span className="w-3 h-3 rounded-full bg-slate-300 inline-block shrink-0" title="未學 (未排入複習)"></span>;
    }
    const interval = record.srs?.interval || 1;
    if (interval <= 2) {
      return <span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0 shadow-xs shadow-red-500/50" title="🔴 不熟"></span>;
    } else if (interval <= 10) {
      return <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0 shadow-xs shadow-amber-400/50" title="🟡 中等"></span>;
    } else {
      return <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0 shadow-xs shadow-emerald-500/50" title="🟢 精熟"></span>;
    }
  };

// 處理評估：不熟 (Quality 1) / 中等 (Quality 3) / 精熟 (Quality 5)
  const handleRating = async (quality: 1 | 3 | 5) => {
    if (!currentRawWord) return;
    if (processingSave) return;

    if (!user) {
      alert("請先登入 Google 帳號，才能將評估結果同步至雲端排程！");
      return;
    }

    try {
      setProcessingSave(true);
      const fullData: WordAnalysis = convertRawToWordAnalysis(currentRawWord);
      await saveWordCard(user, fullData);

      const existingRecord = userVocabMap.get(currentRawWord.word.toLowerCase());

      let nextSrs;
      if (!existingRecord) {
        // 全新單字第一次評估：依據點擊的等級直接設定正確的初始狀態
        const now = new Date();
        if (quality === 5) {
          // 🟢 精熟：直接跳過新手期，間隔設為 14 天 (精熟門檻 > 10)
          const nextDate = new Date(now);
          nextDate.setDate(now.getDate() + 14);
          nextSrs = {
            interval: 14,
            repetition: 3,
            easeFactor: 2.6,
            nextReviewDate: nextDate.toISOString(),
            lastReviewDate: now.toISOString(),
          };
        } else if (quality === 3) {
          // 🟡 中等：設定間隔為 4 天 (中等門檻 3 ~ 10)
          const nextDate = new Date(now);
          nextDate.setDate(now.getDate() + 4);
          nextSrs = {
            interval: 4,
            repetition: 1,
            easeFactor: 2.5,
            nextReviewDate: nextDate.toISOString(),
            lastReviewDate: now.toISOString(),
          };
        } else {
          // 🔴 不熟：設定間隔為 1 天 (不熟門檻 <= 2)
          const nextDate = new Date(now);
          nextDate.setDate(now.getDate() + 1);
          nextSrs = {
            interval: 1,
            repetition: 0,
            easeFactor: 2.3,
            nextReviewDate: nextDate.toISOString(),
            lastReviewDate: now.toISOString(),
          };
        }
      } else {
        // 已存在的單字：走標準 SM-2 遞增/衰減演算法
        const baseRecord = {
          interval: existingRecord.srs.interval,
          repetition: existingRecord.srs.repetition,
          easeFactor: existingRecord.srs.easeFactor,
          nextReviewDate: existingRecord.srs.nextReviewDate,
          lastReviewDate: existingRecord.srs.lastReviewDate,
        };
        nextSrs = calculateSM2(baseRecord, quality);
      }

      await updateWordSRS(user, currentRawWord.word, nextSrs);
      
      // 即時更新本地 Map
      setUserVocabMap((prev) => {
        const next = new Map(prev);
        next.set(currentRawWord.word.toLowerCase(), {
          id: currentRawWord.word.toLowerCase(),
          word: currentRawWord.word,
          data: fullData,
          savedAt: existingRecord?.savedAt || new Date().toISOString(),
          srs: nextSrs,
        });
        return next;
      });

      if (onCardSaved) onCardSaved();
    } catch (err) {
      console.error("同步至複習排程失敗:", err);
    } finally {
      setProcessingSave(false);
    }

    if (currentIndex < wordList.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      alert(`太棒了！已瀏覽完 Level ${selectedLevel} 的所有單字！`);
      setViewMode("list");
    }
  };

  const levels = [
    { level: 1, label: "Level 1" },
    { level: 2, label: "Level 2" },
    { level: 3, label: "Level 3" },
    { level: 4, label: "Level 4" },
    { level: 5, label: "Level 5" },
    { level: 6, label: "Level 6" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[80vh] max-h-[650px]">
        
        {/* Header 與 Level 切換 Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {viewMode === "card" && (
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/50 transition mr-1"
                  title="返回列表"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-base">
                {viewMode === "list" ? "7000 單字庫總覽" : `單字卡學習 (L${selectedLevel})`}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {levels.map((item) => (
                <button
                  key={item.level}
                  onClick={() => {
                    setSelectedLevel(item.level);
                    setViewMode("list");
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                    selectedLevel === item.level
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 內容主體區 */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 bg-slate-50/30">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-xs">正在載入 Level {selectedLevel} 單字庫...</span>
            </div>
          ) : viewMode === "list" ? (
            /* ================= 視圖 A：單字列表總覽 ================= */
            <div className="flex-1 flex flex-col h-full space-y-3">
              {/* 搜尋框與統計 */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋單字或中文釋義..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="text-xs text-slate-400 whitespace-nowrap font-medium">
                  共 {wordList.length} 字
                </div>
              </div>

              {/* 列表容器 */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredWords.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    找不到符合條件的單字。
                  </div>
                ) : (
                  filteredWords.map((wordItem) => {
                    // 找出原本在 wordList 中的真實索引
                    const originalIndex = wordList.findIndex((w) => w.word === wordItem.word);

                    return (
                      <div
                        key={wordItem.word}
                        onClick={() => {
                          setCurrentIndex(originalIndex);
                          setIsFlipped(false);
                          setViewMode("card");
                        }}
                        className="p-3 bg-white hover:bg-blue-50/50 rounded-xl border border-slate-200/80 hover:border-blue-300 transition flex items-center justify-between cursor-pointer shadow-2xs group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* 燈號 */}
                          {getWordStatusBadge(wordItem.word)}
                          <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">
                            {wordItem.word}
                          </span>
                          {wordItem.phonetic && (
                            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                              /{wordItem.phonetic}/
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          <span className="text-xs text-slate-500 truncate max-w-[200px]">
                            {wordItem.meaning}
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 shrink-0 transition" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ================= 視圖 B：單字卡翻卡學習 ================= */
            <div className="flex-1 flex flex-col justify-between h-full">
              {/* 進度提示 */}
              <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                <span>Level {selectedLevel} 學習卡片</span>
                <span>
                  進度：<strong>{currentIndex + 1}</strong> / {wordList.length}
                </span>
              </div>

              {/* 翻轉字卡主體 */}
              <div
                onClick={() => !isFlipped && setIsFlipped(true)}
                className={`relative flex-1 rounded-2xl border p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 shadow-xs ${
                  isFlipped
                    ? "bg-slate-50/50 border-slate-300"
                    : "bg-gradient-to-b from-white to-blue-50/30 border-blue-200 hover:border-blue-400 hover:shadow-md"
                }`}
              >
                {/* 單字發音與標題 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {getWordStatusBadge(currentRawWord.word)}
                    <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                      {currentRawWord.word}
                    </h3>
                  </div>
                  {currentRawWord.phonetic && (
                    <div className="flex items-center justify-center gap-1.5 text-slate-500 font-mono text-sm">
                      <span>/{currentRawWord.phonetic}/</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudio(currentRawWord.word);
                        }}
                        className="p-1 hover:bg-white rounded-full transition text-blue-600"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 正面提示 */}
                {!isFlipped ? (
                  <div className="mt-8 flex items-center gap-1 text-xs text-blue-600 font-medium animate-pulse">
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>點擊卡片翻面看釋義</span>
                  </div>
                ) : (
                  /* 背面內容 */
                  <div className="mt-6 space-y-3 w-full text-left border-t border-slate-200/80 pt-4 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[180px] no-scrollbar">
                    <div className="space-y-2">
                      {currentRawWord.meaningsList && currentRawWord.meaningsList.length > 0 ? (
                        currentRawWord.meaningsList.map((item, mIdx) => (
                          <div key={mIdx} className="flex items-start gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded shrink-0 mt-0.5">
                              {item.pos}
                            </span>
                            <span className="font-semibold text-slate-800 leading-snug">
                              {item.def}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base">
                            {currentRawWord.meaning || "暫無中文釋義"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* AI 深度解析按鈕 */}
                    {onDeepAnalyze && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeepAnalyze(currentRawWord.word);
                          onClose();
                        }}
                        className="w-full py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition mt-2"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>呼叫 AI 產生完整字根與例句</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 底部操作按鈕 */}
              <div className="mt-4">
                {!isFlipped ? (
                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition text-sm flex items-center justify-center gap-1.5"
                  >
                    <span>翻開解答</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button
                      type="button"
                      disabled={processingSave}
                      onClick={() => handleRating(1)}
                      className="py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5 shadow-2xs"
                    >
                      <span>🔴 不熟</span>
                      <span className="text-[10px] text-red-500 font-normal">排入今日複習</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingSave}
                      onClick={() => handleRating(3)}
                      className="py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5 shadow-2xs"
                    >
                      <span>🟡 中等</span>
                      <span className="text-[10px] text-amber-600 font-normal">排入近期複習</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingSave}
                      onClick={() => handleRating(5)}
                      className="py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5 shadow-2xs"
                    >
                      <span>🟢 精熟</span>
                      <span className="text-[10px] text-emerald-600 font-normal">已掌握 (略過)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}