"use client";

import React, { useState, useEffect, useMemo } from "react";
import { User } from "firebase/auth";
import { SavedWordCard } from "@/lib/schema";
import { calculateSM2, ReviewGrade } from "@/lib/srs";
import { 
  updateWordSRS, 
  removeWordCard, 
  updateWordFolder, 
  updateWordsOrder,
  saveUserFolders,
  fetchUserFolders
} from "@/lib/firebase";
import { 
  X, 
  RotateCw, 
  Volume2, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  ArrowLeft, 
  Trash2, 
  ChevronRight, 
  Flame, 
  Search, 
  Folder, 
  FolderPlus, 
  GripVertical, 
  PlusCircle, 
  FolderMinus, 
  LogOut as FolderOut, 
  CheckSquare, 
  Square 
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
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [localList, setLocalList] = useState<SavedWordCard[]>([]);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !user) return;
    async function loadFolders() {
      try {
        const saved = await fetchUserFolders(user!);
        setCustomFolders(saved);
      } catch (err) {
        console.error("載入自訂合輯失敗:", err);
      }
    }
    loadFolders();
  }, [isOpen, user]);

  const allFolders = useMemo(() => {
    const set = new Set<string>(customFolders);
    dueCards.forEach((c) => {
      if (c.folder && c.folder.trim()) set.add(c.folder.trim());
    });
    return Array.from(set);
  }, [dueCards, customFolders]);

  const filteredCards = useMemo(() => {
    let list = [...dueCards];

    if (selectedFolder === "unassigned") {
      list = list.filter((c) => !c.folder || !c.folder.trim());
    } else if (selectedFolder !== "all") {
      list = list.filter((c) => c.folder === selectedFolder);
    }

    list.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.word.toLowerCase().includes(q) ||
        c.data.meanings.some((m) => m.primary.includes(q))
      );
    }

    return list;
  }, [dueCards, selectedFolder, searchQuery]);

  const availableToAddCards = useMemo(() => {
    if (selectedFolder === "all" || selectedFolder === "unassigned") return [];
    return dueCards.filter((c) => c.folder !== selectedFolder);
  }, [dueCards, selectedFolder]);

  useEffect(() => {
    setLocalList(filteredCards);
    setSelectedWordIds(new Set());
  }, [filteredCards, selectedFolder]);

  if (!isOpen) return null;

  const currentCard = localList[currentIndex];
  const isFinished = !currentCard || currentIndex >= localList.length;

  const playAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getStatusBadge = (interval: number) => {
    if (interval <= 2) {
      return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0 shadow-xs" title="🔴 不熟"></span>;
    } else if (interval <= 10) {
      return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0 shadow-xs" title="🟡 中等"></span>;
    } else {
      return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0 shadow-xs" title="🟢 精熟"></span>;
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("請輸入新合輯名稱（例如：高頻考題、分科片語）：");
    if (!name || !name.trim() || !user) return;
    const clean = name.trim();

    if (!customFolders.includes(clean)) {
      const nextFolders = [...customFolders, clean];
      setCustomFolders(nextFolders);
      await saveUserFolders(user, nextFolders);
    }
    setSelectedFolder(clean);
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`確定要刪除「${folderName}」合輯嗎？\n合輯內的單字不會被刪除，將變回「未分類」。`)) return;
    if (!user) return;

    try {
      const cardsInFolder = dueCards.filter((c) => c.folder === folderName);
      for (const card of cardsInFolder) {
        await updateWordFolder(user, card.word, "");
      }
      const nextFolders = customFolders.filter((f) => f !== folderName);
      setCustomFolders(nextFolders);
      await saveUserFolders(user, nextFolders);

      setSelectedFolder("all");
      onReviewFinished();
    } catch (err) {
      console.error("刪除合輯失敗:", err);
      alert("刪除合輯失敗");
    }
  };

  const handleChangeFolder = async (card: SavedWordCard, folderName: string) => {
    if (!user) return;
    try {
      await updateWordFolder(user, card.word, folderName);
      onReviewFinished();
    } catch (err) {
      console.error("更新合輯失敗:", err);
      alert("更新合輯失敗");
    }
  };

  const toggleSelectWord = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWordIds.size === localList.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(localList.map((c) => c.id)));
    }
  };

  const handleBatchRemoveFromFolder = async () => {
    if (!user || selectedWordIds.size === 0) return;
    if (!confirm(`確定要將選取的 ${selectedWordIds.size} 個單字移出「${selectedFolder}」合輯嗎？`)) return;

    try {
      const targetCards = localList.filter((c) => selectedWordIds.has(c.id));
      for (const card of targetCards) {
        await updateWordFolder(user, card.word, "");
      }
      setSelectedWordIds(new Set());
      onReviewFinished();
    } catch (err) {
      console.error("批量移出失敗:", err);
      alert("批量移出合輯失敗");
    }
  };

  const handleBatchMoveToFolder = async (targetFolder: string) => {
    if (!user || selectedWordIds.size === 0 || !targetFolder) return;

    try {
      const targetCards = localList.filter((c) => selectedWordIds.has(c.id));
      for (const card of targetCards) {
        await updateWordFolder(user, card.word, targetFolder);
      }
      setSelectedWordIds(new Set());
      onReviewFinished();
    } catch (err) {
      console.error("批量移動失敗:", err);
      alert("批量移動失敗");
    }
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const updated = [...localList];
    const item = updated[draggedIdx];
    updated.splice(draggedIdx, 1);
    updated.splice(idx, 0, item);

    setDraggedIdx(idx);
    setLocalList(updated);
  };

  const handleDragEnd = async () => {
    setDraggedIdx(null);
    if (!user) return;

    const orderedIds = localList.map((c) => c.id);
    try {
      await updateWordsOrder(user, orderedIds);
      onReviewFinished();
    } catch (err) {
      console.error("更新順序失敗:", err);
    }
  };

  const handleDeleteWord = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm(`確定要將「${word}」從雲端複習庫移除嗎？`)) return;

    try {
      await removeWordCard(user, word);
      onReviewFinished();
    } catch (err) {
      console.error("刪除失敗:", err);
      alert("刪除單字失敗");
    }
  };

  const handleGrade = async (grade: ReviewGrade) => {
    if (!user || !currentCard || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newSRS = calculateSM2(currentCard.srs, grade);
      await updateWordSRS(user, currentCard.word, newSRS);

      setIsFlipped(false);
      if (currentIndex < localList.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onReviewFinished();
        setViewMode("list");
      }
    } catch (err) {
      alert("儲存複習進度失敗");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMeaningDisplay = (m: { pos: string; primary: string; secondary?: string[] }) => {
    let posTag = m.pos || "釋義";
    let rawText = (m.primary || "").trim();
    let secondaryList: string[] = m.secondary ? [...m.secondary] : [];

    const posPrefixMatch = rawText.match(/^((?:adj|adv|art|conj|int|prep|pron|num|aux|abbr|phr|vt|vi|[nva])\.)\s*/i);
    if (posPrefixMatch) {
      posTag = posPrefixMatch[1].toLowerCase();
      if (posTag === "a.") posTag = "adj.";
      rawText = rawText.substring(posPrefixMatch[0].length).trim();
    }

    const domainMatch = rawText.match(/^(\[[^\]]+\])\s*/);
    if (domainMatch) {
      if (posTag === "釋義" || !posTag) {
        posTag = domainMatch[1];
      } else if (!posTag.includes(domainMatch[1])) {
        posTag = `${posTag} ${domainMatch[1]}`;
      }
      rawText = rawText.substring(domainMatch[0].length).trim();
    }

    let primaryText = rawText;
    if (secondaryList.length === 0 && /[,\s，、；;]/.test(rawText)) {
      const parts = rawText.split(/[,，、；;\s]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        primaryText = parts[0];
        secondaryList = parts.slice(1);
      }
    }

    const cleanPosDisplay = posTag.startsWith("[") && posTag.endsWith("]")
      ? posTag.slice(1, -1)
      : posTag;

    return (
      <div className="flex flex-wrap items-baseline gap-2 text-sm">
        <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 shrink-0">
          {cleanPosDisplay}
        </span>
        <span className="font-bold text-slate-900 text-base">
          {primaryText || "常見核心字彙"}
        </span>
        {secondaryList.length > 0 && (
          <span className="text-xs text-slate-500 font-normal">
            ({secondaryList.slice(0, 4).join("、")})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {viewMode === "card" && (
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition mr-1"
                title="返回清單"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              {viewMode === "list" 
                ? (selectedFolder === "all" ? "全部待複習單字" : selectedFolder === "unassigned" ? "未分類單字" : `合輯：${selectedFolder}`)
                : "SRS 遺忘曲線複習"}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {viewMode === "list" && selectedFolder !== "all" && selectedFolder !== "unassigned" && (
              <button
                type="button"
                onClick={() => handleDeleteFolder(selectedFolder)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                title="刪除/解散此合輯"
              >
                <FolderMinus className="h-4 w-4 text-rose-500" />
                <span className="hidden sm:inline">刪除合輯</span>
              </button>
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
        </div>

        {/* 合輯分類標籤列 */}
        {viewMode === "list" && (
          <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFolder("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedFolder === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              全部 ({dueCards.length})
            </button>

            {allFolders.map((f) => {
              const count = dueCards.filter((c) => c.folder === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFolder(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                    selectedFolder === f
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Folder className="h-3 w-3" />
                  <span>{f}</span>
                  <span className="opacity-75 text-[10px]">({count})</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedFolder("unassigned")}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedFolder === "unassigned"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              未分類 ({dueCards.filter((c) => !c.folder || !c.folder.trim()).length})
            </button>

            <button
              type="button"
              onClick={handleCreateFolder}
              className="px-2.5 py-1 rounded-full text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1 shrink-0"
              title="建立新合輯資料夾"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>新增合輯</span>
            </button>
          </div>
        )}

        {/* 內容區塊 */}
        <div className="p-6 flex-1 overflow-y-auto">
          {viewMode === "list" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋單字..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {localList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentIndex(0);
                      setIsFlipped(false);
                      setViewMode("card");
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    <span>複習此清單 ({localList.length})</span>
                  </button>
                )}
              </div>

              {/* 批量操作列 */}
              {selectedWordIds.size > 0 && (
                <div className="bg-indigo-50/90 border border-indigo-200 px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-900">
                      已選取 {selectedWordIds.size} 個單字
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedWordIds(new Set())}
                      className="text-indigo-600 hover:underline text-[11px]"
                    >
                      取消選取
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedFolder !== "all" && selectedFolder !== "unassigned" && (
                      <button
                        type="button"
                        onClick={handleBatchRemoveFromFolder}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-semibold transition flex items-center gap-1 text-[11px]"
                      >
                        <FolderOut className="h-3 w-3" />
                        <span>移出此合輯</span>
                      </button>
                    )}

                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBatchMoveToFolder(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none"
                    >
                      <option value="" disabled>📁 批量移動至...</option>
                      {allFolders
                        .filter((f) => f !== selectedFolder)
                        .map((f) => (
                          <option key={f} value={f}>
                            📁 {f}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {localList.length === 0 ? (
                <div className="text-center py-6 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      「{selectedFolder}」目前尚無單字
                    </p>
                    <p className="text-xs text-slate-400">
                      從下方點擊「＋」將你的現有單字快速收錄進此合輯：
                    </p>
                  </div>

                  {availableToAddCards.length > 0 ? (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto text-left border border-slate-200/80 rounded-2xl p-2 bg-slate-50/50">
                      {availableToAddCards.map((c) => (
                        <div
                          key={c.id}
                          className="p-2 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{c.word}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeFolder(c, selectedFolder)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg transition flex items-center gap-1"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>加入合輯</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">所有單字皆已在此合輯中</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-medium transition"
                    >
                      {selectedWordIds.size === localList.length && localList.length > 0 ? (
                        <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      <span>全選 ({selectedWordIds.size}/{localList.length})</span>
                    </button>
                    <span>💡 提示：長按左側把手可拖曳排序</span>
                  </div>

                  {localList.map((card, idx) => {
                    const isSelected = selectedWordIds.has(card.id);
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setIsFlipped(false);
                          setViewMode("card");
                        }}
                        className={`p-3 bg-white rounded-xl border transition flex items-center justify-between cursor-pointer group shadow-2xs ${
                          draggedIdx === idx
                            ? "opacity-40 border-indigo-400 border-dashed"
                            : isSelected
                            ? "border-indigo-300 bg-indigo-50/20"
                            : "border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* 多選 Checkbox */}
                          <div
                            onClick={(e) => toggleSelectWord(e, card.id)}
                            className="p-1 text-slate-300 hover:text-indigo-600 transition"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </div>

                          {/* 拖曳把手 */}
                          <div 
                            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          {getStatusBadge(card.srs?.interval || 1)}
                          
                          <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                            {card.word}
                          </span>

                          <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                            {card.data.level || "7000單"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {selectedFolder !== "all" && selectedFolder !== "unassigned" && (
                            <button
                              type="button"
                              onClick={() => handleChangeFolder(card, "")}
                              className="px-2 py-1 text-[11px] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-medium transition flex items-center gap-1"
                              title="將此單字移出合輯"
                            >
                              <FolderOut className="h-3 w-3" />
                              <span className="hidden sm:inline">移出</span>
                            </button>
                          )}

                          <select
                            value={card.folder || ""}
                            onChange={(e) => handleChangeFolder(card, e.target.value)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">📁 未分類</option>
                            {allFolders.map((f) => (
                              <option key={f} value={f}>
                                📁 {f}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteWord(e, card.word)}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="從複習庫徹底刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <ChevronRight 
                            className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition cursor-pointer" 
                            onClick={() => {
                              setCurrentIndex(idx);
                              setIsFlipped(false);
                              setViewMode("card");
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            isFinished ? (
              <div className="text-center py-12 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">太棒了！此合輯複習已全數完成</h3>
                  <p className="text-xs text-slate-500">
                    系統已根據艾賓浩斯遺忘曲線為您重新排定下次複習週期。
                  </p>
                </div>
                <button
                  onClick={() => setViewMode("list")}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition text-sm shadow-md"
                >
                  返回清單
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>進度：{currentIndex + 1} / {localList.length}</span>
                  <div className="flex items-center gap-1">
                    <span>熟練度：</span>
                    {getStatusBadge(currentCard.srs?.interval || 1)}
                  </div>
                </div>

                <div className="text-center space-y-2 py-2">
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
                  {currentCard.data.phonetic && (
                    <p className="text-sm font-mono text-slate-400">{currentCard.data.phonetic}</p>
                  )}
                  <div className="flex justify-center gap-2 pt-1">
                    <span className="text-[11px] px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {currentCard.data.level}
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      間隔: {currentCard.srs.interval} 天 (連續 {currentCard.srs.repetition} 次)
                    </span>
                  </div>
                </div>

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
                    <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200/80">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                        <BookOpen className="h-3.5 w-3.5" /> 核心釋義
                      </span>
                      <div className="space-y-1.5">
                        {currentCard.data.meanings.map((m, idx) => (
                          <div key={idx}>
                            {formatMeaningDisplay(m)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {currentCard.data.mnemonics && (
                      <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold block text-amber-800 mb-0.5">💡 記憶技巧：</span>
                        {currentCard.data.mnemonics}
                      </div>
                    )}

                    {currentCard.data.examples && currentCard.data.examples[0] && (
                      <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 text-xs space-y-0.5">
                        <p className="font-medium text-slate-900">{currentCard.data.examples[0].en}</p>
                        <p className="text-slate-500">{currentCard.data.examples[0].zh}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* 評分按鈕 */}
        {viewMode === "card" && !isFinished && isFlipped && (
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