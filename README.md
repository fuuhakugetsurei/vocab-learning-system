# 📚 Vocab Learner (單字深度學習系統)

<p align="center">
  <strong>基於 AI 與間隔重複理論（SRS）的現代化全方位英語深度學習系統</strong><br>
  <em>An AI-powered, SRS-driven deep vocabulary learning system designed for high efficiency.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16+-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5+-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28?style=flat-square&logo=firebase" alt="Firebase" />
</p>

---

## 🌟 核心特色 / Key Features

### 🇹🇼 繁體中文
* 🔍 **雙向深度解析**：支援英文單字、片語（以逗號分隔或直接包含空格）、中文概念反查與拼字自動糾錯。
* 📁 **.txt 批量匯入**：支援一鍵匯入.txt單字清單檔案，秒級自動轉換切分並解析。
* ⚡ **ECDICT 本地字典加速**：內建本地離線字典，點擊任一單字即可瞬間彈出音標、大考分級與核心釋義。
* 🧠 **結構化主次語意分離**：自動標記詞性，核心第一主語意粗體醒目呈現，次要與領域標籤（如 "[計]"）淡化輔助，視覺不超載。
* 🔥 **SRS 艾賓浩斯遺忘曲線複習**：採用 SM-2 演算法自動排定複習週期，支援手動拖曳排序（Drag & Drop）與自訂合輯（資料夾）管理。
* 📖 **大考 7000 單字庫刷題**：完整收錄 Level 1 至 Level 6 大考中心單字庫，支援紅/黃/綠熟練度燈號管理與翻卡刷題。
* ☁️ **全端雲端同步**：支援 Google 登入，雲端字庫、自訂合輯與複習排程無縫跨裝置同步。
* ✉️ **GitHub Actions 自動提醒**：每日清晨定時檢查全站到期單字，透過 Gmail 寄送複習提醒郵件。

---

### 🇺🇸 English
* 🔍 **Bidirectional Deep Analysis**: Supports English words, phrases (comma-separated or with spaces), Chinese concept reverse lookups, and typo auto-corrections.
* 📁 **Batch .txt Import**: One-click import for.txt word lists, instantly formatted and analyzed.
* ⚡ **Instant Local Dictionary**: Embedded offline ECDICT lookup for instant phonetics, CEEC levels, and primary definitions upon clicking any word.
* 🧠 **Structured Meaning Separation**: Highlights core primary meanings with distinct POS tags while subordinating domain/secondary definitions for maximum retention.
* 🔥 **SM-2 Spaced Repetition (SRS)**: Ebbinghaus curve scheduling with native drag-and-drop sorting and custom study folders/decks.
* 📖 **CEEC 7000 Vocabulary Deck**: Fully loaded with Levels 1–6 vocabulary, mastery traffic lights (Red/Yellow/Green), and flashcard drills.
* ☁️ **Cloud Synchronization**: Seamless Google Auth integration for real-time Firestore synchronization across devices.
* ✉️ **Automated Email Reminders**: Scheduled daily GitHub Actions workflow checking due cards and dispatching review notifications via Gmail.

---

## 🛠️ 技術棧 / Tech Stack

* **Framework**: Next.js (App Router, Turbopack)
* **Language**: TypeScript
* **Styling**: Tailwind CSS, Lucide Icons[cite: 1]
* **Database & Auth**: Firebase Authentication, Cloud Firestore
* **Validation**: Zod[cite: 1]
* **Automation**: GitHub Actions, Nodemailer

---

## 🚀 快速開始與本地部署 / Quick Start & Deployment

### 1. 複製專案 / Clone Repository

```bash
git clone [https://github.com/your-username/vocab-learner.git](https://github.com/your-username/vocab-learner.git)
cd vocab-learner
npm install

```

### 2. 環境變數設定 / Environment Variables

在專案根目錄建立 `.env.local` 檔案，填入你的 Firebase 配置：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:...

```

### 3. 本地啟動 / Run Locally

```bash
npm run dev

```

打開瀏覽器訪問 `http://localhost:3000` 即可開始使用。

---

## 🔑 AI API Key 獲取指引 / API Key Setup Guide

本系統支援使用者於右上角「⚙️ 設定」中自行切換多種 AI 提供商：

### 1. Google Gemini (推薦 / Recommended)

* 前往 [Google AI Studio](https://aistudio.google.com/)。
* 點選 **Get API key** 並建立新的金鑰。
* 推薦模型：`gemini-1.5-flash` 或 `gemini-2.0-flash`。

### 2. Groq (超高速推論 / Ultra Fast)

* 前往 [Groq Console](https://console.groq.com/keys)。
* 建立 API Key 並貼入設定面板。
* 推薦模型：`llama-3.3-70b-versatile`。

### 3. OpenRouter (多模型聚合 / Multi-Provider)

* 前往 [OpenRouter Keys](https://www.google.com/search?q=https://openrouter.ai/keys)。
* 建立金鑰並可用於呼叫 DeepSeek、Claude、OpenAI 等模型。

---

## ⚙️ Firestore 安全性規則 / Firestore Security Rules

若要啟用雲端同步與個人字庫保護，請在 Firebase Console 的 Firestore Rules 貼入以下規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

```

---

## 📧 每日複習通知排程 / Daily Reminder Workflow

若欲啟用 GitHub Actions 每日定時發信提醒，請於 GitHub Repository 的 **Settings -> Secrets and variables -> Actions** 中設定以下 Secrets：

| Secret 變數名 | 說明 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 服務帳戶私鑰 (JSON 字串) |
| `GMAIL_USER` | 發信使用的 Gmail 地址 |
| `GMAIL_APP_PASSWORD` | Google 帳號「應用程式密碼 (App Password)」 |

---

## 📄 授權條款 / License

MIT License © 2026. Built with focus and precision.


