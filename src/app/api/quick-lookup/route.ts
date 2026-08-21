import { NextRequest, NextResponse } from 'next/server';
import { lookupCEECLevel } from '@/lib/ceec-dict';
import { lookupLocalDict } from '@/lib/local-dict';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawWord = searchParams.get('word')?.trim().toLowerCase() || '';

  if (!rawWord) {
    return NextResponse.json({ error: '請提供單字' }, { status: 400 });
  }

  // 移除前後標點符號
  const cleanWord = rawWord.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
  const localData = lookupLocalDict(cleanWord);
  const ceecLevelNum = lookupCEECLevel(cleanWord);

  if (!localData) {
    return NextResponse.json({
      found: false,
      word: cleanWord,
      level: ceecLevelNum ? `Level ${ceecLevelNum}` : '7000單外',
    });
  }

  return NextResponse.json({
    found: true,
    word: cleanWord,
    phonetic: localData.phonetic,
    translation: localData.translation,
    level: ceecLevelNum ? `Level ${ceecLevelNum}` : '7000單外',
  });
}