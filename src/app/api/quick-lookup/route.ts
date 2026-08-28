import { NextRequest, NextResponse } from "next/server";
import { lookupLocalDict } from "@/lib/local-dict";
import { lookupCEECLevel } from "@/lib/ceec-dict";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wordParam = searchParams.get("word");

    if (!wordParam) {
      return NextResponse.json({ error: "Missing word query" }, { status: 400 });
    }

    const cleanWord = wordParam.trim().toLowerCase();
    
    // 1. 查本地 ECDICT 字典 (取得音標與繁中釋義)
    const localData = lookupLocalDict(cleanWord);
    
    // 2. 查 CEEC 7000 單分級
    const ceecLevel = lookupCEECLevel(cleanWord);

    if (!localData || !localData.translation) {
      return NextResponse.json({
        found: false,
        word: cleanWord,
        level: ceecLevel || "7000單外",
      });
    }

    return NextResponse.json({
      found: true,
      word: cleanWord,
      phonetic: localData.phonetic || "",
      translation: localData.translation || "",
      level: ceecLevel || "7000單外",
    });
  } catch (err: unknown) {
    console.error("Quick lookup error:", err);
    return NextResponse.json({ found: false, word: "" }, { status: 500 });
  }
}