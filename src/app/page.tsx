"use client";

import React, { useState, useEffect } from "react";
import { WordAnalysis } from "@/lib/schema";
import SettingsModal from "@/components/SettingsModal";
import { 
  Search, 
  Volume2, 
  BookOpen, 
  GitBranch, 
  Lightbulb, 
  AlertTriangle, 
  XCircle, 
  BookmarkPlus,
  Settings,
  Sparkles,
  Layers,
  GraduationCap,
  Languages,
  Zap
} from "lucide-react";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<WordAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentConfigName, setCurrentConfigName] = useState<string>("Gemini (系統預設)");

  const checkConfig = () => {
    const saved = localStorage.getItem("vocab_api_config_v2");
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        const providerNames: Record<string, string> = {
          gemini: "Gemini",
          groq: "Groq",
          openrouter: "OpenRouter",
          "openai-compatible": "OpenAI 相容"
        };
        const active = cfg.activeProvider || "gemini";
        const model = cfg.configs?.[active]?.modelId || "預設";
        setCurrentConfigName(`${providerNames[active] || active} (${model})`);
      } catch {
        setCurrentConfigName("Gemini (系統預設)");
      }
    } else {
      setCurrentConfigName("Gemini (系統預設)");
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    setLoading(true);
    setError(null);

    let apiConfig = undefined;
    const saved = localStorage.getItem("vocab_api_config_v2");
    if (saved) {
      try {
        apiConfig = JSON.parse(saved);
      } catch (err) {
        console.error("解析 API 設定失敗:", err);
      }
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          input: inputText.trim(),
          config: apiConfig
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "查詢失敗，請確認 API 設定或稍後再試");
      }

      if (Array.isArray(json)) {
        setCards(json);
      } else {
        throw new Error("伺服器回傳了無效的資料格式");
      }
    } catch (err: any) {
      setError(err.message || "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

const renderLevelBadge = (rawLevel: string) => {
    let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
    let desc = "7000單外";
    let displayLevel = "7000單外";

    // 只比對 1 到 6 的大考分級數字，避免 7000 被誤抓
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
      <div className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold border rounded-full ${colorClass}`}>
        <GraduationCap className="h-3.5 w-3.5" />
        <span>{displayLevel}</span>
        {displayLevel !== "7000單外" && (
          <span className="text-[10px] opacity-75">({desc})</span>
        )}
      </div>
    );
  };

  const renderSourceBadge = (source?: string) => {
    if (source === "dict+ai") {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-full bg-amber-50 text-amber-700 border-amber-200">
          <Zap className="h-3 w-3 text-amber-600" />
          <span>字典加速</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-full bg-indigo-50 text-indigo-700 border-indigo-200">
        <Sparkles className="h-3 w-3 text-indigo-600" />
        <span>AI 全解析</span>
      </div>
    );
  };

  const isChineseInput = (original: string) => {
    return /[\u4e00-\u9fa5]/.test(original);
  };

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                單字深度學習系統
              </h1>
            </div>
            <p className="text-slate-500 text-xs">
              支援：<span className="font-semibold text-slate-700">中英雙向查詢、學測 7000 單分級</span> ｜ 引擎：<span className="font-mono font-semibold text-blue-600">{currentConfigName}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="self-start sm:self-auto px-4 py-2 text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-semibold"
          >
            <Settings className="h-4 w-4" />
            <span>自訂 API / 模型</span>
          </button>
        </header>

        {/* 搜尋欄 */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="輸入英文或中文（空白分隔），例如：放棄 persistent 繁榮"
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400 text-sm shadow-sm transition"
            />
            <Search className="absolute left-3.5 top-4 h-4 w-4 text-slate-400" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition whitespace-nowrap text-sm shadow-sm flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>分析中...</span>
              </>
            ) : (
              "深度解析"
            )}
          </button>
        </form>

        {/* 錯誤提示 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3 shadow-sm">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">分析失敗</span>
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* 單字卡清單 */}
        <div className="space-y-6">
          {cards.map((data, index) => {
            if (!data.isValid) {
              return (
                <div
                  key={`invalid-${index}`}
                  className="bg-red-50/70 border border-red-200 rounded-2xl p-5 flex items-center justify-between shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-mono font-bold text-red-900 text-lg">
                        {data.originalWord}
                      </span>
                    </div>
                    <p className="text-xs text-red-600">
                      {data.errorMessage || "查無此單字/詞彙，請檢查拼字。"}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-md border border-red-200">
                    無效字詞
                  </span>
                </div>
              );
            }

            return (
              <div
                key={`${data.word}-${index}`}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 transition hover:shadow-md"
              >
                {/* 中文查詢提示 Banner */}
                {isChineseInput(data.originalWord) && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 font-medium">
                    <Languages className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      中文概念「<strong>{data.originalWord}</strong>」對應的核心英文單字：<strong>{data.word}</strong>
                    </span>
                  </div>
                )}

                {/* 拼錯更正提示 Banner */}
                {data.isCorrected && !isChineseInput(data.originalWord) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      偵測到輸入「<strong>{data.originalWord}</strong>」可能有誤，已自動為您更正並分析「<strong>{data.word}</strong>」。
                    </span>
                  </div>
                )}

                {/* 標題、發音、學測分級與來源標籤 */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {data.word}
                      </h2>
                      {renderLevelBadge(data.level)}
                      {renderSourceBadge(data.source)}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-slate-600">
                      <span className="font-mono text-sm">{data.phonetic}</span>
                      <button
                        type="button"
                        onClick={() => playAudio(data.word)}
                        className="p-1 hover:bg-slate-100 rounded-full transition text-blue-600 focus:outline-none"
                        title="朗讀發音"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert(`已觸發收藏「${data.word}」，Phase 2 將寫入 Firestore`)}
                    className="px-3 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition border border-slate-200 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    <span>收藏</span>
                  </button>
                </div>

                {/* 語意拆解 */}
                <section className="space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" /> 語意拆解
                  </h3>
                  <div className="space-y-2">
                    {data.meanings.map((m, idx) => (
                      <div key={idx} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {m.pos}
                        </span>
                        <span className="font-semibold text-slate-900">{m.primary}</span>
                        {m.secondary && m.secondary.length > 0 && (
                          <span className="text-xs text-slate-500">
                            ({m.secondary.join("、")})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* 常用搭配詞 */}
                {data.collocations && data.collocations.length > 0 && (
                  <section className="space-y-2.5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <Layers className="h-3.5 w-3.5 text-blue-600" /> 常用搭配詞 (Collocations)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {data.collocations.map((col, cIdx) => (
                        <div key={cIdx} className="bg-white p-3 rounded-lg border border-blue-200/60 space-y-1 shadow-2xs">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">{col.phrase}</span>
                            <span className="text-xs text-blue-700 font-medium">{col.meaning}</span>
                          </div>
                          {col.example && (
                            <p className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-1">
                              "{col.example}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 字源與字根關聯 */}
                <section className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <GitBranch className="h-3.5 w-3.5 text-blue-600" /> 字源與字根關聯
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm text-slate-600">
                    <div>
                      <span className="text-slate-400 text-[11px] block">字首 (Prefix)</span>
                      <strong className="text-slate-800 text-xs">{data.etymology.prefix || "無"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">字根 (Root)</span>
                      <strong className="text-slate-800 text-xs">{data.etymology.root || "無"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">字尾 (Suffix)</span>
                      <strong className="text-slate-800 text-xs">{data.etymology.suffix || "無"}</strong>
                    </div>
                  </div>
                  {data.etymology.relatedWords && data.etymology.relatedWords.length > 0 && (
                    <div className="text-xs border-t border-slate-200/80 pt-2.5 mt-1 text-slate-600">
                      <span className="font-medium text-slate-700">同源衍生詞：</span>
                      <span className="text-blue-600 font-medium">
                        {data.etymology.relatedWords.join(", ")}
                      </span>
                    </div>
                  )}
                </section>

                {/* 記憶技巧 */}
                {data.mnemonics && (
                  <section className="space-y-1.5 bg-amber-50/60 p-4 rounded-xl border border-amber-200/60">
                    <h3 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600" /> 記憶技巧
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-normal">
                      {data.mnemonics}
                    </p>
                  </section>
                )}

                {/* 語境例句 */}
                {data.examples && data.examples.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      語境例句
                    </h3>
                    <div className="space-y-2.5">
                      {data.examples.map((ex, idx) => (
                        <div key={idx} className="text-sm space-y-0.5 border-l-2 border-blue-500 pl-3 py-0.5">
                          <p className="text-slate-900 font-medium">{ex.en}</p>
                          <p className="text-slate-500 text-xs">{ex.zh}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 同義詞 */}
                {data.synonyms && data.synonyms.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">同義詞：</span>
                    <span>{data.synonyms.join(", ")}</span>
                  </div>
                )}
                {/* 形近 / 易混淆字 */}
                {data.confusables && data.confusables.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-amber-700 shrink-0">形近/易混淆字：</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.confusables.map((cw, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md font-mono text-[11px]"
                        >
                          {cw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={checkConfig}
      />
    </main>
  );
}