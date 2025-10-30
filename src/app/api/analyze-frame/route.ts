import { NextResponse } from 'next/server';
import { detectWeaponsFromBase64 } from '@/lib/ai/weapon-detector';

export async function POST(req: Request) {
  try {
    const { imageData } = await req.json();
    if (!imageData) return NextResponse.json({ error: 'Missing imageData' }, { status: 400 });
    
    // Use open-source weapon detection instead of Gemini
    const weaponResult = await detectWeaponsFromBase64(imageData);
    
    // Format result to match expected interface
    const result = {
      analysis: weaponResult.hasWeapon 
        ? `⚠️ WEAPON DETECTED: ${weaponResult.weaponType} (confidence: ${weaponResult.confidence.toFixed(1)}%)`
        : 'No weapons detected',
      detectedObjects: weaponResult.detections.map(d => d.label),
      hasPerson: false, // This should be detected by COCO-SSD in the client
      hasVehicle: false, // This should be detected by COCO-SSD in the client
      hasPackage: false, // This should be detected by COCO-SSD in the client
      hasWeapon: weaponResult.hasWeapon,
      hasSuspiciousActivity: weaponResult.hasWeapon,
      confidence: weaponResult.confidence,
      detections: weaponResult.detections.map(d => ({
        label: d.label,
        bbox: {
          x: d.box.xmin,
          y: d.box.ymin,
          width: d.box.xmax - d.box.xmin,
          height: d.box.ymax - d.box.ymin,
        },
        confidence: d.score,
      })),
    };
    
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('analyze-frame error', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
