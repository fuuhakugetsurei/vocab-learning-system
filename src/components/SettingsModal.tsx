"use client";

import { useState, useEffect } from "react";
import { 
  CustomApiConfig, 
  ProviderType, 
  PROVIDER_GUIDES,
  INITIAL_CONFIG 
} from "@/lib/api-config";
import { 
  getStoredFirebaseConfig, 
  saveFirebaseConfig, 
  removeFirebaseConfig 
} from "@/lib/firebase";
import { 
  X, 
  Key, 
  ExternalLink, 
  HelpCircle, 
  Check, 
  Server, 
  Cpu, 
  Database 
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: Props) {
  // 分頁狀態
  const [activeTab, setActiveTab] = useState<"api" | "firebase">("api");

  // 原有 AI API 設定狀態
  const [activeProvider, setActiveProvider] = useState<ProviderType>("gemini");
  const [configMap, setConfigMap] = useState<CustomApiConfig["configs"]>(INITIAL_CONFIG.configs);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Firebase 設定狀態
  const [firebaseConfigStr, setFirebaseConfigStr] = useState("");
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    if (isOpen) {
      // 載入 API 設定
      const saved = localStorage.getItem("vocab_api_config_v2");
      if (saved) {
        try {
          const parsed: CustomApiConfig = JSON.parse(saved);
          setActiveProvider(parsed.activeProvider || "gemini");
          setConfigMap({
            ...INITIAL_CONFIG.configs,
            ...parsed.configs,
          });
        } catch (e) {
          console.error("載入設定失敗", e);
        }
      }

      // 載入 Firebase 設定
      const fbConfig = getStoredFirebaseConfig();
      if (fbConfig) {
        setFirebaseConfigStr(JSON.stringify(fbConfig, null, 2));
      } else {
        setFirebaseConfigStr("");
      }
      setFirebaseError("");
      setSavedSuccess(false);
    }
  }, [isOpen]);

  const currentItem = configMap[activeProvider] || INITIAL_CONFIG.configs[activeProvider];
  const currentGuide = PROVIDER_GUIDES[activeProvider];

  const handleUpdateItem = (field: "apiKey" | "modelId" | "baseUrl", value: string) => {
    setConfigMap((prev) => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        [field]: value,
      },
    }));
  };

  // 寬容解析使用者輸入的 Firebase 設定（支援 JS 物件、帶變數宣告、單引號、無引號 key 等）
  const parseFirebaseInput = (input: string) => {
    let clean = input.trim();
    // 1. 去除前面的變數宣告 (如 const firebaseConfig = 或 export default)
    clean = clean.replace(/^(const|let|var)\s+[\w$]+\s*=\s*/, "").replace(/^export\s+default\s+/, "");
    // 2. 去除結尾分號
    clean = clean.replace(/;\s*$/, "");

    // 3. 嘗試標準 JSON 解析
    try {
      return JSON.parse(clean);
    } catch {
      // 4. 若失敗，將沒引號的 JS Key (如 apiKey:) 與單引號轉成標準 JSON 格式
      const jsonFormatted = clean
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // 給 key 補上雙引號
        .replace(/'/g, '"')                                  // 單引號轉雙引號
        .replace(/,\s*([}\]])/g, "$1");                      // 移除結尾多餘逗號

      return JSON.parse(jsonFormatted);
    }
  };

  const handleSave = () => {
    // 1. 驗證並儲存 Firebase 設定
    if (firebaseConfigStr.trim()) {
      try {
        const parsed = parseFirebaseInput(firebaseConfigStr);
        if (!parsed.apiKey || !parsed.projectId) {
          setFirebaseError("Firebase 設定缺少 apiKey 或 projectId 欄位");
          setActiveTab("firebase");
          return;
        }
        saveFirebaseConfig(parsed);
      } catch {
        setFirebaseError("無法解析 Firebase 設定，請確認格式是否正確！");
        setActiveTab("firebase");
        return;
      }
    } else {
      removeFirebaseConfig();
    }

    // 2. 儲存 AI API 設定
    const fullConfig: CustomApiConfig = {
      activeProvider,
      configs: configMap,
    };
    localStorage.setItem("vocab_api_config_v2", JSON.stringify(fullConfig));

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSaved();
      onClose();
    }, 600);
  };

  const handleClear = () => {
    if (activeTab === "api") {
      localStorage.removeItem("vocab_api_config_v2");
      setActiveProvider("gemini");
      setConfigMap(INITIAL_CONFIG.configs);
      onSaved();
      alert("已重設所有 API 金鑰設定！");
    } else {
      removeFirebaseConfig();
      setFirebaseConfigStr("");
      setFirebaseError("");
      alert("已清除 Firebase 配置！");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">系統與雲端字庫設定</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 分頁 Tab */}
        <div className="flex px-6 pt-4 gap-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("api")}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "api"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Cpu className="h-4 w-4" /> AI 模型設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("firebase")}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "firebase"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Database className="h-4 w-4" /> Firebase 雲端字庫
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-700 flex-1 overflow-y-auto">
          {activeTab === "api" ? (
            <>
              {/* 1. 選擇供應商 */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-900 block">目前使用供應商</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["gemini", "groq", "openrouter", "openai-compatible"] as ProviderType[]).map((p) => {
                    const hasKey = !!configMap[p]?.apiKey;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActiveProvider(p)}
                        className={`p-3 rounded-xl border text-left font-medium transition flex flex-col justify-between ${
                          activeProvider === p
                            ? "border-blue-600 bg-blue-50/60 text-blue-900 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                        }`}
                      >
                        <span>{PROVIDER_GUIDES[p].name}</span>
                        <span className="text-[10px] mt-1 text-slate-400">
                          {hasKey ? "🟢 已儲存 Key" : "⚪ 未設定 Key"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Base URL */}
              {(activeProvider === "openai-compatible" || activeProvider === "openrouter" || activeProvider === "groq") && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-slate-500" /> Base URL (API 端點)
                  </label>
                  <input
                    type="text"
                    value={currentItem.baseUrl || ""}
                    onChange={(e) => handleUpdateItem("baseUrl", e.target.value)}
                    placeholder={currentGuide.defaultBaseUrl || "https://api.openai.com/v1"}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  />
                </div>
              )}

              {/* 3. API Key */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-slate-500" /> {currentGuide.name} API 金鑰
                </label>
                <input
                  type="password"
                  value={currentItem.apiKey || ""}
                  onChange={(e) => handleUpdateItem("apiKey", e.target.value)}
                  placeholder={`請填入 ${currentGuide.name} 專屬 Key`}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              {/* 4. Model ID */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-slate-500" /> 模型 ID (Model ID)
                </label>
                <input
                  type="text"
                  value={currentItem.modelId || ""}
                  onChange={(e) => handleUpdateItem("modelId", e.target.value)}
                  placeholder={`預設: ${currentGuide.defaultModel}`}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
                {/* 推薦模型快捷點擊 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-slate-400">推薦：</span>
                  {currentGuide.modelGuide.recommended.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleUpdateItem("modelId", m)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition font-mono"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. 說明與引導區塊 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <HelpCircle className="h-4 w-4 text-blue-600" /> {currentGuide.name} 取得步驟
                  </span>
                  {currentGuide.keyGuide.url && (
                    <a
                      href={currentGuide.keyGuide.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      前往官網取得 Key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <ul className="list-decimal list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
                  {currentGuide.keyGuide.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            /* Firebase 設定區塊 */
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
                <p className="font-semibold mb-1">💡 如何取得 Firebase 設定？</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                  <li>在 Firebase 控制台建立專案並開啟 Authentication (Google) 與 Firestore</li>
                  <li>至「專案設定」新增 Web 應用程式，直接複製整段程式碼貼至下方即可</li>
                  <li>所有設定僅存於你的本機瀏覽器，資料直連你自己的 Firebase 專案</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-900 block">
                  Firebase Web SDK 配置
                </label>
                <textarea
                  rows={8}
                  value={firebaseConfigStr}
                  onChange={(e) => {
                    setFirebaseConfigStr(e.target.value);
                    setFirebaseError("");
                  }}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "...",\n  storageBucket: "...",\n  messagingSenderId: "...",\n  appId: "..."\n};`}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
                {firebaseError && (
                  <p className="text-xs text-rose-600 font-medium">{firebaseError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-600 hover:text-red-700 hover:underline"
          >
            {activeTab === "api" ? "清除全部金鑰" : "清除 Firebase 配置"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              {savedSuccess ? (
                <>
                  <Check className="h-4 w-4" /> 全部已儲存
                </>
              ) : (
                "儲存設定"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}