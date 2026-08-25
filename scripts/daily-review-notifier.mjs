import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
const USER_ID = process.env.USER_ID; // Firebase UID
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;

if (!SERVICE_ACCOUNT_RAW || !USER_ID || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("❌ 缺少必要環境變數：FIREBASE_SERVICE_ACCOUNT, USER_ID, GMAIL_USER 或 GMAIL_APP_PASSWORD");
  process.exit(1);
}

const serviceAccount = JSON.parse(SERVICE_ACCOUNT_RAW);

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function checkAndNotify() {
  console.log(`🔍 正在使用 Admin SDK 檢查使用者 [${USER_ID}] 的到期單字...`);
  const colRef = db.collection("users").doc(USER_ID).collection("vocabularies");
  const snapshot = await colRef.get();

  const now = Date.now();
  const dueWords = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const nextDate = data.srs?.nextReviewDate ? new Date(data.srs.nextReviewDate).getTime() : 0;
    if (nextDate <= now) {
      dueWords.push({
        word: data.word,
        phonetic: data.data?.phonetic || "",
        meaning: data.data?.meanings?.[0]?.primary || "暫無釋義",
        pos: data.data?.meanings?.[0]?.pos || "釋義",
      });
    }
  });

  console.log(`📊 檢查完成：共有 ${dueWords.length} 個單字到達複習時間。`);

  if (dueWords.length === 0) {
    console.log("✨ 今日無待複習單字，無需發送郵件。");
    return;
  }

  await sendEmail(dueWords);
}

async function sendEmail(words) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  const wordItemsHtml = words
    .slice(0, 10)
    .map(
      (w) => `
      <li style="margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">
        <strong style="color: #2563eb; font-size: 16px;">${w.word}</strong>
        <span style="color: #64748b; font-size: 13px; font-family: monospace;">${w.phonetic ? `/${w.phonetic}/` : ""}</span>
        <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${w.pos}</span>
        <div style="color: #1e293b; font-size: 14px; margin-top: 4px; font-weight: 500;">${w.meaning}</div>
      </li>`
    )
    .join("");

  const moreText =
    words.length > 10
      ? `<p style="color: #64748b; font-size: 13px; text-align: center;">...以及其他 ${words.length - 10} 個單字</p>`
      : "";

  const mailOptions = {
    from: `"單字深度學習助手" <${GMAIL_USER}>`,
    to: TO_EMAIL,
    subject: `🔔 今日單字複習提醒：你有 ${words.length} 個單字到達遺忘臨界點！`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">📚 艾賓浩斯間隔重複提醒</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          根據 SM-2 演算法排程，你今天有 <strong style="color: #d97706; font-size: 16px;">${words.length}</strong> 個單字到達遺忘臨界點，快花 3 分鐘複習加深印象吧！
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <ul style="list-style-type: none; padding-left: 0; margin: 0;">
            ${wordItemsHtml}
          </ul>
          ${moreText}
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">
          及時複習是克服遺忘曲線最有效的方法 ⚡
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Gmail 複習提醒發送成功！ID:", info.messageId);
}

checkAndNotify().catch((err) => {
  console.error("執行異常:", err);
  process.exit(1);
});