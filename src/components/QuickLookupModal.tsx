"use client";

import React from "react";
import { Volume2, X, Sparkles, GraduationCap } from "lucide-react";
import { parseDictTranslation } from "@/lib/local-dict";

export interface QuickLookupData {
  found: boolean;
  word: string;
  phonetic?: string;
  translation?: string;
  level?: string;
}

interface QuickLookupModalProps {
  isOpen: boolean;
  loading: boolean;
  data: QuickLookupData | null;
  onClose: () => void;
  onDeepAnalyze: (word: string) => void;
}

export default function QuickLookupModal({
  isOpen,
  loading,
  data,
  onClose,
  onDeepAnalyze,
}: QuickLookupModalProps) {
  if (!isOpen) return null;

  const playAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 分級徽章渲染
  const renderLevelBadge = (rawLevel?: string) => {
    if (!rawLevel) return null;

    let displayLevel = "7000單外";
    let desc = "7000單外";
    let colorClass = "bg-slate-100 text-slate-700 border-slate-200";

    const match = rawLevel.match(/\b([1-6])\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      displayLevel = `Level ${num}`;

      if (num === 1 || num === 2) {
        colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        desc = "國中基礎";
      } else if (num === 3 || num === 4) {
        colorClass = "bg-blue-50 text-blue-700 border-blue-200";
        desc = "學測核心";
      } else if (num === 5 || num === 6) {
        colorClass = "bg-purple-50 text-purple-700 border-purple-200";
        desc = "分科進階";
      }
    }

    return (
      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border flex items-center gap-1 ${colorClass}`}>
        <GraduationCap className="h-3.5 w-3.5" />
        <span>{displayLevel}</span>
        {displayLevel !== "7000單外" && (
          <span className="text-[10px] opacity-75">({desc})</span>
        )}
      </span>
    );
  };

  // 結構化解析並呈現釋義
  const renderCleanTranslation = (translation?: string) => {
    if (!translation) {
      return (
        <p className="text-slate-400 italic">本地字典無此單字，可點擊下方進行 AI 深度生成。</p>
      );
    }

    const parsedMeanings = parseDictTranslation(translation);

    return (
      <div className="space-y-2 text-left">
        {parsedMeanings.map((m, idx) => (
          <div key={idx} className="flex flex-wrap items-baseline gap-1.5 text-xs">
            {/* 詞性標籤 */}
            <span className="font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
              {m.pos}
            </span>
            {/* 第一核心語意 */}
            <span className="font-bold text-slate-900 text-sm">
              {m.primary}
            </span>
            {/* 次要衍生語意 */}
            {m.secondary.length > 0 && (
              <span className="text-slate-500 font-normal">
                ({m.secondary.slice(0, 3).join("、")})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標頭 */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              本地字典快查
            </span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900">{data?.word}</h3>
              {renderLevelBadge(data?.level)}
            </div>
            {data?.phonetic && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-1">
                <span>/{data.phonetic}/</span>
                <button
                  type="button"
                  onClick={() => data?.word && playAudio(data.word)}
                  className="p-1 hover:bg-slate-100 rounded text-blue-600 transition"
                  title="發音"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 釋義內容區 */}
        <div className="py-3 border-t border-b border-slate-100 min-h-[60px] text-xs">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-slate-400 gap-2">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              <span>檢索字典中...</span>
            </div>
          ) : (
            renderCleanTranslation(data?.translation)
          )}
        </div>

        {/* 底部動作按鈕 */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
          >
            關閉
          </button>
          <button
            type="button"
            onClick={() => {
              if (data?.word) {
                onDeepAnalyze(data.word);
                onClose();
              }
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>深入解析此單字</span>
          </button>
        </div>
      </div>
    </div>
  );
}