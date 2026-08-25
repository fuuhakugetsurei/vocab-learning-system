"use client";

import React, { useState } from "react";
import { User } from "firebase/auth";
import { SavedWordCard } from "@/lib/schema";
import { calculateSM2, ReviewGrade } from "@/lib/srs";
import { updateWordSRS } from "@/lib/firebase";
import { 
  X, 
  RotateCw, 
  Volume2, 
  CheckCircle2, 
  GraduationCap, 
  Sparkles,
  Layers,
  BookOpen
} from "lucide-react";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueCards: SavedWordCard[];
  user: User | null;
  onReviewFinished: () => void;
}

export function ReviewModal({
  isOpen,
  onClose,
  dueCards,
  user,
  onReviewFinished,
}: ReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentCard = dueCards[currentIndex];
  const isFinished = !currentCard || currentIndex >= dueCards.length;

  const playAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleGrade = async (grade: ReviewGrade) => {
    if (!user || !currentCard || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newSRS = calculateSM2(currentCard.srs, grade);
      await updateWordSRS(user, currentCard.word, newSRS);

      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      alert("儲存複習進度失敗");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              SRS 遺忘曲線複習模式
            </h2>
          </div>
          {!isFinished && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              進度：{currentIndex + 1} / {dueCards.length}
            </span>
          )}
          <button
            onClick={() => {
              onReviewFinished();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-6 flex-1 overflow-y-auto">
          {isFinished ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">太棒了！今日複習已全數完成</h3>
                <p className="text-xs text-slate-500">
                  系統已根據艾賓浩斯遺忘曲線為您重新排定下次複習週期。
                </p>
              </div>
              <button
                onClick={() => {
                  onReviewFinished();
                  onClose();
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition text-sm shadow-md"
              >
                返回主畫面
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 單字卡正面 */}
              <div className="text-center space-y-2 py-4">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {currentCard.word}
                  </h1>
                  <button
                    onClick={() => playAudio(currentCard.word)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm font-mono text-slate-400">{currentCard.data.phonetic}</p>
                <div className="flex justify-center gap-2 pt-1">
                  <span className="text-[11px] px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {currentCard.data.level}
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    間隔: {currentCard.srs.interval} 天 (連續 {currentCard.srs.repetition} 次)
                  </span>
                </div>
              </div>

              {/* 翻卡按鈕與背面內容 */}
              {!isFlipped ? (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="w-full py-12 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition flex flex-col items-center justify-center gap-2"
                >
                  <RotateCw className="h-5 w-5" />
                  <span>點擊翻面查看釋義與解析</span>
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {/* 語意 */}
                  <div className="bg-slate-50 p-4 rounded-xl space-y-1.5 border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> 核心釋義
                    </span>
                    <div className="space-y-1">
                      {currentCard.data.meanings.map((m, idx) => (
                        <p key={idx} className="text-sm text-slate-800">
                          <strong className="text-indigo-600 mr-1.5">[{m.pos}]</strong>
                          {m.primary}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* 記憶法 */}
                  {currentCard.data.mnemonics && (
                    <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
                      <span className="font-bold block text-amber-800 mb-0.5">💡 記憶技巧：</span>
                      {currentCard.data.mnemonics}
                    </div>
                  )}

                  {/* 例句 */}
                  {currentCard.data.examples && currentCard.data.examples[0] && (
                    <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 text-xs space-y-0.5">
                      <p className="font-medium text-slate-900">{currentCard.data.examples[0].en}</p>
                      <p className="text-slate-500">{currentCard.data.examples[0].zh}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部評分按鈕 (僅在翻面且未完成時顯示) */}
        {!isFinished && isFlipped && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-3 gap-2">
            <button
              disabled={isSubmitting}
              onClick={() => handleGrade(1)}
              className="py-3 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5"
            >
              <span>忘記了 ❌</span>
              <span className="text-[10px] font-normal opacity-75">重設為 1 天</span>
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleGrade(3)}
              className="py-3 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5"
            >
              <span>勉強想起 🤔</span>
              <span className="text-[10px] font-normal opacity-75">標準間隔</span>
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleGrade(5)}
              className="py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5"
            >
              <span>完美反射 ⚡</span>
              <span className="text-[10px] font-normal opacity-75">延長週期</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}