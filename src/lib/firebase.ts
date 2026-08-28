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
  writeBatch,
  Firestore 
} from "firebase/firestore";
import { WordAnalysis, SavedWordCard, SRSRecord } from "./schema";

const defaultFirebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseInstance(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!defaultFirebaseConfig.apiKey || !defaultFirebaseConfig.projectId) {
    console.warn("⚠️ Firebase 環境變數未配置完整");
    return null;
  }

  const app: FirebaseApp = getApps().length === 0 ? initializeApp(defaultFirebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

export async function syncUserProfile(user: User): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) return;

  const userDocRef = doc(instance.db, "users", user.uid);
  await setDoc(
    userDocRef,
    {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      lastLoginAt: new Date().toISOString(),
      enableReminder: true,
    },
    { merge: true }
  );
}

export async function signInWithGoogle(): Promise<User> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未正確初始化，請檢查環境變數！");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(instance.auth, provider);
  await syncUserProfile(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) return;
  await fbSignOut(instance.auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  const instance = getFirebaseInstance();
  if (!instance) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(instance.auth, async (user) => {
    if (user) {
      await syncUserProfile(user);
    }
    callback(user);
  });
}

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

function getSafeWordId(word: string): string {
  if (!word) return "unknown_word";
  return word
    .trim()
    .toLowerCase()
    .replace(/[/\\#?.]/g, "_")
    .replace(/\s+/g, "_");
}

export async function saveWordCard(user: User, analysis: WordAnalysis): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const rawWord = analysis.word || analysis.originalWord || "unknown";
  const wordId = getSafeWordId(rawWord);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);

  const existingDoc = await getDoc(docRef);
  let srs = createDefaultSRS();
  let savedAt = new Date().toISOString();
  let folder = "";
  let order = 999999;

  if (existingDoc.exists()) {
    const prev = existingDoc.data() as SavedWordCard;
    if (prev.srs) srs = prev.srs;
    if (prev.savedAt) savedAt = prev.savedAt;
    if (prev.folder) folder = prev.folder;
    if (typeof prev.order === "number") order = prev.order;
  }

  const card: SavedWordCard = {
    id: wordId,
    word: rawWord.trim(),
    data: analysis,
    savedAt,
    srs,
    tags: [analysis.level || "7000單"],
    folder,
    order,
  };

  await setDoc(docRef, card, { merge: true });
}

export async function removeWordCard(user: User, word: string): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  await deleteDoc(docRef);
}

export async function checkWordSaved(user: User, word: string): Promise<boolean> {
  const instance = getFirebaseInstance();
  if (!instance) return false;

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

export async function fetchUserVocabularies(user: User): Promise<SavedWordCard[]> {
  const instance = getFirebaseInstance();
  if (!instance) return [];

  const colRef = collection(instance.db, "users", user.uid, "vocabularies");
  const q = query(colRef, orderBy("savedAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as SavedWordCard);
}

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

export async function updateWordFolder(
  user: User,
  word: string,
  folderName: string
): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const wordId = getSafeWordId(word);
  const docRef = doc(instance.db, "users", user.uid, "vocabularies", wordId);
  await setDoc(docRef, { folder: folderName }, { merge: true });
}

export async function updateWordsOrder(
  user: User,
  orderedCardIds: string[]
): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) throw new Error("Firebase 尚未初始化");

  const batch = writeBatch(instance.db);
  orderedCardIds.forEach((id, index) => {
    const docRef = doc(instance.db, "users", user.uid, "vocabularies", id);
    batch.update(docRef, { order: index });
  });

  await batch.commit();
}

export async function saveUserFolders(user: User, folders: string[]): Promise<void> {
  const instance = getFirebaseInstance();
  if (!instance) return;

  const userDocRef = doc(instance.db, "users", user.uid);
  await setDoc(userDocRef, { customFolders: folders }, { merge: true });
}

export async function fetchUserFolders(user: User): Promise<string[]> {
  const instance = getFirebaseInstance();
  if (!instance) return [];

  const userDocRef = doc(instance.db, "users", user.uid);
  const snap = await getDoc(userDocRef);
  if (snap.exists()) {
    const data = snap.data();
    return Array.isArray(data.customFolders) ? data.customFolders : [];
  }
  return [];
}