import { NextResponse } from 'next/server';
import { analyzeImageWithGemini } from '@/lib/ai/gemini';

export async function POST(req: Request) {
  try {
    const { imageData } = await req.json();
    if (!imageData) return NextResponse.json({ error: 'Missing imageData' }, { status: 400 });
    const result = await analyzeImageWithGemini(imageData);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('analyze-frame error', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
