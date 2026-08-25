import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 緩存 7000 單資料
let cachedCeecData: Array<{
  word: string;
  level: number;
  phonetic?: string;
  translation?: string;
  pos?: string;
}> | null = null;

function loadCeecData() {
  if (!cachedCeecData) {
    try {
      const filePath = path.join(process.cwd(), "src/data/ceec-vocab.json");
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        cachedCeecData = JSON.parse(raw);
      }
    } catch (err) {
      console.error("讀取 ceec-vocab.json 失敗:", err);
      cachedCeecData = [];
    }
  }
  return cachedCeecData || [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const levelParam = searchParams.get("level");
  const wordParam = searchParams.get("word");

  // 1. 如果是請求指定 Level 的 7000 單清單
  if (levelParam) {
    const level = parseInt(levelParam, 10);
    const allWords = loadCeecData();
    const filtered = allWords.filter((item) => Number(item.level) === level);
    return NextResponse.json(filtered);
  }

  // 2. 原本的單字快查邏輯 (word)
  if (wordParam) {
    const cleanWord = wordParam.trim().toLowerCase();
    const allWords = loadCeecData();
    const found = allWords.find((w) => w.word.toLowerCase() === cleanWord);

    if (found) {
      return NextResponse.json({
        found: true,
        word: found.word,
        phonetic: found.phonetic || "",
        translation: found.translation || "",
        level: `Level ${found.level}`,
      });
    }

    return NextResponse.json({ found: false, word: cleanWord });
  }

  return NextResponse.json({ error: "Missing level or word query" }, { status: 400 });
}