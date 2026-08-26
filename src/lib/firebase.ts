import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User, 
  Auth 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  Firestore 
} from "firebase/firestore";
import { WordAnalysis, SavedWordCard, SRSRecord } from "./schema";

const STORAGE_KEY = "user_firebase_config";

export function getStoredFirebaseConfig(): FirebaseOptions | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseOptions;
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config: FirebaseOptions): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function removeFirebaseConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// 取得或動態初始化 Firebase App
export function getFirebaseInstance(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  let app: FirebaseApp;
  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

// Google 登入
export async function signInWithGoogle(): Promise<User> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("請先在設定中填入 Firebase 配置！");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(instance.auth, provider);
  return result.user;
}

// 登出
export async function signOutUser(): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) return;
  await fbSignOut(instance.auth);
}

// 監聽登入狀態變化
export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  const instance = getFirebaseInstance();
  if (!instance) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(instance.auth, callback);
}

// 初始 SRS 預設值
export function createDefaultSRS(): SRSRecord {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    interval: 1,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: tomorrow.toISOString(),
  };
}

// 建立安全的 Document ID 防呆函式（將斜線與非法字元轉為底線，避免產生奇數區段）
function getSafeWordId(word: string): string {
  if (!word) return "unknown_word";
  return word
    .trim()
    .toLowerCase()
    .replace(/[/\\#?.]/g, "_") // 把斜線、點、問號等轉為底線
    .replace(/\s+/g, "_");     // 把空白轉為底線
}

// 收藏單字卡
export async function saveWordCard(user: User, analysis: WordAnalysis): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const rawWord = analysis.word || analysis.originalWord || "unknown";
  const wordId = getSafeWordId(rawWord);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);

  // 檢查是否已存在，若已存在則保留原有的 SRS 進度
  const existingDoc = await getDoc(docRef);
  let srs = createDefaultSRS();
  let savedAt = new Date().toISOString();

  if (existingDoc.exists()) {
    const prev = existingDoc.data() as SavedWordCard;
    if (prev.srs) srs = prev.srs;
    if (prev.savedAt) savedAt = prev.savedAt;
  }

  const card: SavedWordCard = {
    id: wordId,
    word: rawWord.trim(),
    data: analysis,
    savedAt,
    srs,
    tags: [analysis.level || "7000單"],
  };

  await setDoc(docRef, card);
}

// 取消收藏單字卡
export async function removeWordCard(user: User, word: string): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  await deleteDoc(docRef);
}

// 檢查單字是否已被收藏
export async function checkWordSaved(user: User, word: string): Promise<boolean> {
  const instance = getFirebaseInstance();
  if (!instance) return false;

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

// 取得使用者所有收藏的單字卡清單
export async function fetchUserVocabularies(user: User): Promise<SavedWordCard[]> {
  const instance = getFirebaseInstance();
  if (!instance) return [];

  const colRef = collection(instance.db, "users", user.uid, "vocabularies");
  const q = query(colRef, orderBy("savedAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as SavedWordCard);
}

// 更新單一單字卡的 SRS 進度
export async function updateWordSRS(
  user: User,
  word: string,
  updatedSRS: SRSRecord
): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  await setDoc(docRef, { srs: updatedSRS }, { merge: true });
}