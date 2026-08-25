import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// 1. 讀取環境變數 (由 GitHub Actions Secret 或本機 .env 注入)
const FIREBASE_CONFIG_RAW = process.env.FIREBASE_CONFIG;
const USER_ID = process.env.USER_ID; // 使用者的 Firebase UID
const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;

if (!FIREBASE_CONFIG_RAW || !USER_ID) {
  console.error("❌ 缺少必要環境變數：FIREBASE_CONFIG 或 USER_ID");
  process.exit(1);
}

const firebaseConfig = JSON.parse(FIREBASE_CONFIG_RAW);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAndNotify() {
  console.log(`🔍 正在檢查使用者 [${USER_ID}] 的到期單字...`);
  const colRef = collection(db, "users", USER_ID, "vocabularies");
  const snapshot = await getDocs(colRef);

  const now = Date.now();
  const dueWords = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const nextDate = data.srs?.nextReviewDate ? new Date(data.srs.nextReviewDate).getTime() : 0;
    if (nextDate <= now) {
      dueWords.push({
        word: data.word,
        meaning: data.data?.meanings?.[0]?.primary || "暫無釋義",
      });
    }
  });

  console.log(`📊 檢查完成：共有 ${dueWords.length} 個單字到達複習時間。`);

  if (dueWords.length === 0) {
    console.log("✨ 今日無待複習單字，無需發送通知。");
    return;
  }

  // 2. 組裝通知訊息
  const sampleWords = dueWords.slice(0, 5).map((w) => `• ${w.word}: ${w.meaning}`).join("\n");
  const moreText = dueWords.length > 5 ? `\n...以及其他 ${dueWords.length - 5} 個單字` : "";
  
  const message = `\n🔔 【艾賓浩斯複習提醒】\n你今天有 ${dueWords.length} 個單字已到達記憶遺忘臨界點！\n\n${sampleWords}${moreText}\n\n👉 趕快開啟系統進行 SM-2 抽卡複習吧！`;

  // 3. 發送 LINE Notify
  if (LINE_NOTIFY_TOKEN) {
    await sendLineNotify(LINE_NOTIFY_TOKEN, message);
  }
}

async function sendLineNotify(token, message) {
  const params = new URLSearchParams();
  params.append("message", message);

  const res = await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (res.ok) {
    console.log("✅ LINE 通知發送成功！");
  } else {
    const text = await res.text();
    console.error("❌ LINE 通知發送失敗:", text);
  }
}

checkAndNotify().catch((err) => {
  console.error("執行異常:", err);
  process.exit(1);
});