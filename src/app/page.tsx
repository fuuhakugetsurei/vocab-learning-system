"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { User } from "firebase/auth";
import { WordAnalysis, SavedWordCard } from "@/lib/schema";
import SettingsModal from "@/components/SettingsModal";
import ClickableText from "@/components/ClickableText";
import QuickLookupModal, { QuickLookupData } from "@/components/QuickLookupModal";
import { AuthBar } from "@/components/AuthBar";
import { ReviewModal } from "@/components/ReviewModal";
import { Vocab7000Modal } from "@/components/Vocab7000Modal";
import { filterDueCards } from "@/lib/srs";
import { 
  saveWordCard, 
  removeWordCard, 
  fetchUserVocabularies 
} from "@/lib/firebase";
import { 
  Search, 
  Volume2, 
  BookOpen, 
  GitBranch, 
  Lightbulb, 
  AlertTriangle, 
  XCircle, 
  BookmarkPlus,
  BookmarkCheck,
  Sparkles,
  Layers,
  GraduationCap,
  Languages,
  Zap,
  Loader2,
  Trash2,
  Flame,
  X
} from "lucide-react";

// 擴展型別：支援進行中載入卡片
type DisplayCard = WordAnalysis & { isAsyncLoading?: boolean };

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<DisplayCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // 使用者與設定狀態
  const [user, setUser] = useState<User | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentConfigName, setCurrentConfigName] = useState<string>("Gemini (系統預設)");

  // 快查彈窗狀態
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickData, setQuickData] = useState<QuickLookupData | null>(null);

  // 雲端單字庫狀態
  const [savedWordsSet, setSavedWordsSet] = useState<Set<string>>(new Set());
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedWordCard[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // 複習模式狀態
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // 7000 單字庫刷題模式狀態
  const [is7000Open, setIs7000Open] = useState(false);

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

  // 載入使用者已收藏的單字清單 (集合)
  const refreshUserSavedWords = useCallback(async () => {
    if (!user) {
      setSavedWordsSet(new Set());
      setSavedCards([]);
      return;
    }
    try {
      setLoadingSaved(true);
      const list = await fetchUserVocabularies(user);
      setSavedCards(list);
      setSavedWordsSet(new Set(list.map((c) => c.word.toLowerCase())));
    } catch (err) {
      console.error("載入雲端單字庫失敗:", err);
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  useEffect(() => {
    checkConfig();
  }, []);

  useEffect(() => {
    refreshUserSavedWords();
  }, [refreshUserSavedWords]);

  // 點擊任何單字時觸發本地秒查
  const handleWordClick = async (word: string) => {
    const clean = word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
    if (!clean) return;

    setQuickLoading(true);
    setQuickData({ found: false, word: clean });
    setIsQuickOpen(true);

    try {
      const res = await fetch(`/api/quick-lookup?word=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setQuickData(data);
    } catch {
      setQuickData({ found: false, word: clean });
    } finally {
      setQuickLoading(false);
    }
  };

  // 深度非同步解析單一單字（漸進式載入）
  const triggerDeepAnalysisForWord = async (wordToAnalyze: string) => {
    const placeholderCard: DisplayCard = {
      originalWord: wordToAnalyze,
      isValid: true,
      isCorrected: false,
      errorMessage: "",
      word: wordToAnalyze,
      phonetic: quickData?.phonetic || "",
      level: quickData?.level || "分析中...",
      source: "dict+ai",
      meanings: quickData?.translation 
        ? [{ pos: "釋義", primary: quickData.translation.split("；")[0] || "", secondary: [] }] 
        : [],
      collocations: [],
      etymology: { prefix: "", root: "", suffix: "", relatedWords: [] },
      mnemonics: "",
      examples: [],
      synonyms: [],
      confusables: [],
      isAsyncLoading: true,
    };

    setCards((prev) => [placeholderCard, ...prev]);

    let apiConfig = undefined;
    const saved = localStorage.getItem("vocab_api_config_v2");
    if (saved) {
      try {
        apiConfig = JSON.parse(saved);
      } catch (err) {
        console.error(err);
      }
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          input: wordToAnalyze,
          config: apiConfig
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "分析失敗");

      const enrichedCard = Array.isArray(json) ? json[0] : json;

      setCards((prev) =>
        prev.map((c) => (c.originalWord === wordToAnalyze && c.isAsyncLoading ? enrichedCard : c))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "深度生成失敗";
      setCards((prev) =>
        prev.map((c) =>
          c.originalWord === wordToAnalyze && c.isAsyncLoading
            ? { ...c, isAsyncLoading: false, errorMessage: msg, isValid: false }
            : c
        )
      );
    }
  };

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "發生未知錯誤";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 收藏 / 取消收藏切換
  const handleToggleSave = async (data: WordAnalysis) => {
    if (!user) {
      alert("請先登入 Google 帳號以啟用雲端字庫同步！");
      return;
    }
    const wordKey = data.word.toLowerCase();
    const isCurrentlySaved = savedWordsSet.has(wordKey);

    try {
      if (isCurrentlySaved) {
        await removeWordCard(user, data.word);
        setSavedWordsSet((prev) => {
          const next = new Set(prev);
          next.delete(wordKey);
          return next;
        });
        setSavedCards((prev) => prev.filter((c) => c.id !== wordKey));
      } else {
        await saveWordCard(user, data);
        setSavedWordsSet((prev) => new Set(prev).add(wordKey));
        await refreshUserSavedWords();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失敗";
      alert(`雲端同步失敗: ${msg}`);
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

  // 篩選今日到期需複習的單字
  const dueCards = filterDueCards(savedCards);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          {/* 左側標題與資訊 */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                單字深度學習系統
              </h1>
            </div>
            <p className="text-slate-500 text-xs truncate">
              <span className="hidden sm:inline">支援：</span>中英雙向、點擊快查、7000 單 ｜ 引擎：<span className="font-mono font-semibold text-blue-600">{currentConfigName}</span>
            </p>
          </div>

          {/* 右側操作區 (強制單行、不換行) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 7000 單字庫入口按鈕 */}
            <button
              type="button"
              onClick={() => setIs7000Open(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
              <span>7000 單</span>
            </button>

            {/* SRS 複習入口按鈕 */}
            {user && savedCards.length > 0 && (
              <button
                type="button"
                onClick={() => setIsReviewOpen(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap ${
                  dueCards.length > 0
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 animate-pulse"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <Flame className={`h-3.5 w-3.5 ${dueCards.length > 0 ? "text-white" : "text-amber-500"}`} />
                <span>
                  {dueCards.length > 0
                    ? `今日複習 (${dueCards.length})`
                    : `複習 (${savedCards.length})`}
                </span>
              </button>
            )}

            <AuthBar
              user={user}
              setUser={setUser}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenSavedModal={() => setIsSavedModalOpen(true)}
            />
          </div>
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
                <Loader2 className="w-4 h-4 animate-spin" />
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

            const isSaved = savedWordsSet.has(data.word.toLowerCase());

            return (
              <div
                key={`${data.word}-${index}`}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 transition hover:shadow-md relative overflow-hidden"
              >
                {/* 漸進式載入進度條 */}
                {data.isAsyncLoading && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 overflow-hidden">
                    <div className="h-full bg-blue-600 animate-pulse w-full"></div>
                  </div>
                )}

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
                      {data.isAsyncLoading ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full font-medium animate-pulse border border-blue-200">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          AI 深度解析生成中...
                        </span>
                      ) : (
                        renderSourceBadge(data.source)
                      )}
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

                  {/* 收藏按鈕 */}
                  <button
                    type="button"
                    onClick={() => handleToggleSave(data)}
                    className={`px-3.5 py-1.5 rounded-xl transition border flex items-center gap-1.5 text-xs font-semibold shadow-xs ${
                      isSaved
                        ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-amber-600" />
                        <span>已收藏</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4" />
                        <span>收藏單字</span>
                      </>
                    )}
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

                {/* 深度內容：非同步載入骨架或完整呈現 */}
                {data.isAsyncLoading ? (
                  <div className="p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">
                      正在為「<strong>{data.word}</strong>」生成字根拆解、聯想記憶技巧與大考例句...
                    </p>
                  </div>
                ) : (
                  <>
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
                                <span className="font-bold text-slate-900 text-sm">
                                  <ClickableText text={col.phrase} onWordClick={handleWordClick} />
                                </span>
                                <span className="text-xs text-blue-700 font-medium">{col.meaning}</span>
                              </div>
                              {col.example && (
                                <p className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-1">
                                  &quot;<ClickableText text={col.example} onWordClick={handleWordClick} />&quot;
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
                          <span className="text-blue-600 font-medium space-x-1.5">
                            {data.etymology.relatedWords.map((rw, rwIdx) => (
                              <ClickableText
                                key={rwIdx}
                                text={rw}
                                onWordClick={handleWordClick}
                                className="underline decoration-dotted"
                              />
                            ))}
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
                              <p className="text-slate-900 font-medium">
                                <ClickableText text={ex.en} onWordClick={handleWordClick} />
                              </p>
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
                        <div className="flex flex-wrap gap-1.5">
                          {data.synonyms.map((syn, synIdx) => (
                            <ClickableText
                              key={synIdx}
                              text={syn}
                              onWordClick={handleWordClick}
                              className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 hover:bg-blue-100"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 形近 / 易混淆字 */}
                    {data.confusables && data.confusables.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-amber-700 shrink-0">形近/易混淆字：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {data.confusables.map((cw, cIdx) => (
                            <ClickableText
                              key={cIdx}
                              text={cw}
                              onWordClick={handleWordClick}
                              className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md font-mono text-[11px] hover:bg-amber-100"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 雲端字庫清單彈窗 */}
      {isSavedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  我的雲端字庫 ({savedCards.length})
                </h2>
              </div>
              <button
                onClick={() => setIsSavedModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-3">
              {loadingSaved ? (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <span className="text-xs">讀取雲端單字中...</span>
                </div>
              ) : savedCards.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  目前尚未收藏任何單字卡。
                </div>
              ) : (
                savedCards.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition flex items-center justify-between bg-slate-50/50 hover:bg-white"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{sc.word}</span>
                        <span className="text-xs text-slate-500 font-mono">{sc.data.phonetic}</span>
                        {renderLevelBadge(sc.data.level)}
                      </div>
                      <p className="text-xs text-slate-600">
                        {sc.data.meanings.map((m) => `${m.pos} ${m.primary}`).join(" ； ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCards([sc.data]);
                          setIsSavedModalOpen(false);
                        }}
                        className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition"
                      >
                        檢視詳情
                      </button>
                      <button
                        onClick={async () => {
                          if (user && confirm(`確定要移除「${sc.word}」嗎？`)) {
                            await removeWordCard(user, sc.word);
                            await refreshUserSavedWords();
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                        title="從雲端刪除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7000 單字庫翻卡學習彈窗 */}
      <Vocab7000Modal
        isOpen={is7000Open}
        onClose={() => setIs7000Open(false)}
        user={user}
        onCardSaved={refreshUserSavedWords}
        onDeepAnalyze={triggerDeepAnalysisForWord}
      />

      {/* SRS 智慧複習彈窗 */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        dueCards={dueCards.length > 0 ? dueCards : savedCards}
        user={user}
        onReviewFinished={refreshUserSavedWords}
      />

      {/* 設定彈窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={checkConfig}
      />

      {/* 本地字典秒查彈窗 */}
      <QuickLookupModal
        isOpen={isQuickOpen}
        loading={quickLoading}
        data={quickData}
        onClose={() => setIsQuickOpen(false)}
        onDeepAnalyze={triggerDeepAnalysisForWord}
      />
    </main>
  );
}