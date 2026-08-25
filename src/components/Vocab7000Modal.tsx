"use client";

import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { Raw7000Word, convertRawToWordAnalysis, fetch7000WordsByLevel } from "@/lib/vocab7000";
import { saveWordCard, updateWordSRS } from "@/lib/firebase";
import { calculateSM2 } from "@/lib/srs";
import { WordAnalysis } from "@/lib/schema";
import { 
  X, 
  Volume2, 
  ChevronRight, 
  Sparkles, 
  CheckCircle2, 
  RotateCw, 
  Layers, 
  Loader2,
  BookOpen
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingSave, setProcessingSave] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function loadWords() {
      setLoading(true);
      const list = await fetch7000WordsByLevel(selectedLevel);
      // 隨機打亂題目順序
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      setWordList(shuffled);
      setCurrentIndex(0);
      setIsFlipped(false);
      setLoading(false);
    }
    loadWords();
  }, [isOpen, selectedLevel]);

  if (!isOpen) return null;

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

  // 處理評估：不熟 (Quality 1) / 中等 (Quality 3) / 精熟 (Quality 5)
  const handleRating = async (quality: 1 | 3 | 5) => {
    if (!currentRawWord) return;
    if (processingSave) return;

    if (quality === 1 || quality === 3) {
      if (!user) {
        alert("請先登入 Google 帳號，才能將不熟的單字自動同步至雲端複習排程！");
      } else {
        try {
          setProcessingSave(true);
          const fullData: WordAnalysis = convertRawToWordAnalysis(currentRawWord);
          // 寫入雲端字庫
          await saveWordCard(user, fullData);

          // 計算排程
          const initialRecord = {
            interval: 1,
            repetition: 0,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
            lastReviewDate: new Date().toISOString(),
          };
          const nextSrs = calculateSM2(initialRecord, quality);
          await updateWordSRS(user, currentRawWord.word, nextSrs);
          
          if (onCardSaved) onCardSaved();
        } catch (err) {
          console.error("同步至複習排程失敗:", err);
        } finally {
          setProcessingSave(false);
        }
      }
    }

    // 切換下一張卡片
    if (currentIndex < wordList.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      alert(`太棒了！已完成 Level ${selectedLevel} 的這輪學習！`);
      onClose();
    }
  };

  const levels = [
    { level: 1, label: "Level 1 (國中基礎)" },
    { level: 2, label: "Level 2 (基礎進階)" },
    { level: 3, label: "Level 3 (學測必備)" },
    { level: 4, label: "Level 4 (學測核心)" },
    { level: 5, label: "Level 5 (分科進階)" },
    { level: 6, label: "Level 6 (高階挑戰)" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[540px]">
        {/* Header 與 Level 切換 Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-base">7000 單字庫翻卡學習</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {levels.map((item) => (
              <button
                key={item.level}
                onClick={() => setSelectedLevel(item.level)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                  selectedLevel === item.level
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                L{item.level}
              </button>
            ))}
          </div>
        </div>

        {/* 學習內容區 */}
        <div className="p-6 flex-1 flex flex-col justify-between">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-xs">正在載入 Level {selectedLevel} 單字庫...</span>
            </div>
          ) : !currentRawWord ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
              此等級目前尚無單字資料。
            </div>
          ) : (
            <>
              {/* 進度提示 */}
              <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                <span>Level {selectedLevel} 專區</span>
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
                  <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {currentRawWord.word}
                  </h3>
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
                  <div className="mt-6 space-y-3 w-full text-left border-t border-slate-200/80 pt-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {currentRawWord.pos && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded">
                            {currentRawWord.pos}
                          </span>
                        )}
                        <span className="font-bold text-slate-900 text-base">
                          {currentRawWord.translation || "暫無中文釋義"}
                        </span>
                      </div>
                      {currentRawWord.example && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 mt-2 space-y-0.5 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">&quot;{currentRawWord.example}&quot;</p>
                          {currentRawWord.exampleZh && (
                            <p className="text-slate-400">{currentRawWord.exampleZh}</p>
                          )}
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
                        className="w-full py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>呼叫 AI 產生完整字根與例句</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 底部三大操作按鈕 */}
              <div className="mt-5">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}