export type ProviderType = "gemini" | "groq" | "openrouter" | "openai-compatible";

export interface ProviderConfigItem {
  apiKey: string;
  modelId: string;
  baseUrl?: string;
}

// 支援每個供應商獨立儲存設定
export type AllProvidersConfig = Record<ProviderType, ProviderConfigItem>;

export interface CustomApiConfig {
  activeProvider: ProviderType;
  configs: AllProvidersConfig;
}

export interface ProviderGuide {
  name: string;
  defaultBaseUrl?: string;
  defaultModel: string;
  keyGuide: {
    title: string;
    url: string;
    steps: string[];
  };
  modelGuide: {
    title: string;
    url: string;
    recommended: string[];
  };
}

export const PROVIDER_GUIDES: Record<ProviderType, ProviderGuide> = {
  gemini: {
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyGuide: {
      title: "Google AI Studio 取得 API Key",
      url: "https://aistudio.google.com/app/apikey",
      steps: [
        "前往 Google AI Studio 網站並使用 Google 帳號登入。",
        "點擊「Create API Key」（建立 API 金鑰）。",
        "選擇現有 Google Cloud 專案或建立新專案。",
        "複製產生的 API Key（通常以 AIzaSy... 開頭）並貼至下方欄位。",
      ],
    },
    modelGuide: {
      title: "Gemini 模型 ID 查詢",
      url: "https://ai.google.dev/gemini-api/docs/models/gemini",
      recommended: ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    },
  },
  groq: {
    name: "Groq (超高速推論)",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyGuide: {
      title: "Groq Console 取得 API Key",
      url: "https://console.groq.com/keys",
      steps: [
        "註冊並登入 Groq Console。",
        "在側邊欄點擊「API Keys」。",
        "點擊「Create API Key」，輸入名稱後確認。",
        "複製產生的 Key（以 gsk_... 開頭，僅顯示一次）。",
      ],
    },
    modelGuide: {
      title: "Groq 支援模型清單",
      url: "https://console.groq.com/docs/models",
      recommended: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    },
  },
  openrouter: {
    name: "OpenRouter (免費/聚合模型)",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    keyGuide: {
      title: "OpenRouter API Key 取得方式",
      url: "https://openrouter.ai/keys",
      steps: [
        "前往 OpenRouter 官網並登入帳號。",
        "進入 Keys 頁面，點擊「Create Key」。",
        "填入 Key 名稱後點擊 Create，複製產生的 Key（以 sk-or-... 開頭）。",
        "OpenRouter 提供大量帶有 :free 標籤的完全免費模型！",
      ],
    },
    modelGuide: {
      title: "OpenRouter 免費模型清單",
      url: "https://openrouter.ai/models?max_price=0",
      recommended: [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "deepseek/deepseek-r1:free"
      ],
    },
  },
  "openai-compatible": {
    name: "OpenAI 相容協議 (自訂/本地 Ollama)",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyGuide: {
      title: "Base URL 與 API Key 說明",
      url: "https://platform.openai.com/api-keys",
      steps: [
        "【Base URL】：提供者伺服器進入點（如 OpenAI 為 https://api.openai.com/v1；本地 Ollama 為 http://localhost:11434/v1）。",
        "【API Key】：於該服務後台建立的授權金鑰（本地 Ollama 可隨意填寫如 'ollama'）。",
      ],
    },
    modelGuide: {
      title: "自訂模型 ID",
      url: "",
      recommended: ["gpt-4o-mini", "deepseek-chat", "qwen2.5:7b"],
    },
  },
};

export const INITIAL_CONFIG: CustomApiConfig = {
  activeProvider: "gemini",
  configs: {
    gemini: { apiKey: "", modelId: PROVIDER_GUIDES.gemini.defaultModel },
    groq: { apiKey: "", modelId: PROVIDER_GUIDES.groq.defaultModel, baseUrl: PROVIDER_GUIDES.groq.defaultBaseUrl },
    openrouter: { apiKey: "", modelId: PROVIDER_GUIDES.openrouter.defaultModel, baseUrl: PROVIDER_GUIDES.openrouter.defaultBaseUrl },
    "openai-compatible": { apiKey: "", modelId: PROVIDER_GUIDES["openai-compatible"].defaultModel, baseUrl: PROVIDER_GUIDES["openai-compatible"].defaultBaseUrl },
  },
};