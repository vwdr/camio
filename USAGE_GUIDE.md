/**
 * Quick Start Guide - Weapon Detection
 * 
 * This guide shows you how to use the weapon detection system in your Camio app.
 */

// ============================================
// 1. Using Weapon Detection in Components
// ============================================

import { detectWeapons, initWeaponDetector } from '@/lib/ai/weapon-detector';

// Example: Detect weapons from a video element
async function analyzeVideoFrame(videoElement: HTMLVideoElement) {
  // Initialize detector (only needed once)
  await initWeaponDetector();
  
  // Detect weapons in the current frame
  const result = await detectWeapons(videoElement);
  
  if (result.hasWeapon) {
    console.log('⚠️ WEAPON DETECTED!');
    console.log('Type:', result.weaponType);
    console.log('Confidence:', result.confidence + '%');
    console.log('Detections:', result.detections);
    
    // Trigger alert
    alert(`Weapon detected: ${result.weaponType} (${result.confidence.toFixed(1)}% confidence)`);
  } else {
    console.log('✓ No weapons detected');
  }
  
  return result;
}

// Example: Detect weapons from an image
async function analyzeImage(imageElement: HTMLImageElement) {
  const result = await detectWeapons(imageElement);
  return result;
}

// Example: Detect weapons from a canvas
async function analyzeCanvas(canvasElement: HTMLCanvasElement) {
  const result = await detectWeapons(canvasElement);
  return result;
}

// ============================================
// 2. Using with Video Analyzer Hook
// ============================================

import { useVideoAnalyzer } from '@/lib/useVideoAnalyzer';

function CameraComponent() {
  const { start, stop, detections, lastResult } = useVideoAnalyzer({
    enabled: true,
    fps: 1, // Analyze 1 frame per second
    minScore: 0.4,
  });

  // The weapon detection is already integrated!
  // It will automatically detect weapons and add them to detections
  
  // Check for weapons in results
  if (lastResult?.alertLevel === 'high') {
    // High alert - possibly weapon detected!
    console.log('🚨 HIGH ALERT:', lastResult.summary);
  }
  
  // Detections will include weapon objects
  const weaponDetections = detections.filter(d => 
    ['knife', 'gun', 'pistol', 'rifle', 'weapon'].some(w => d.label.includes(w))
  );
  
  if (weaponDetections.length > 0) {
    console.log('Weapons detected:', weaponDetections);
  }
}

// ============================================
// 3. Using the API Endpoint
// ============================================

async function analyzeImageViaAPI(base64Image: string) {
  const response = await fetch('/api/analyze-frame', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData: base64Image,
    }),
  });
  
  const data = await response.json();
  
  if (data.ok && data.result.hasWeapon) {
    console.log('⚠️ WEAPON DETECTED via API!');
    console.log('Analysis:', data.result.analysis);
    console.log('Confidence:', data.result.confidence);
  }
  
  return data;
}

// ============================================
// 4. Adjusting Detection Settings
// ============================================

// Edit src/lib/ai/detection-config.ts to adjust:
// - threshold: Lower = more sensitive (0.3 default)
// - modelName: Change to different model
// - weaponKeywords: Add/remove weapon types
// - fps: Change analysis frequency
// - minScore: Change minimum detection confidence

// ============================================
// 5. Complete Example: Camera Monitoring
// ============================================

import { useEffect, useRef, useState } from 'react';

export function WeaponMonitoringCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weaponAlert, setWeaponAlert] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const { start, stop, detections, lastResult } = useVideoAnalyzer({
    enabled: isMonitoring,
    fps: 1,
  });
  
  useEffect(() => {
    if (isMonitoring && videoRef.current && canvasRef.current) {
      start(videoRef.current, canvasRef.current);
    } else {
      stop();
    }
    
    return () => stop();
  }, [isMonitoring, start, stop]);
  
  useEffect(() => {
    // Check for weapon detections
    const hasWeapon = detections.some(d => 
      ['knife', 'gun', 'pistol', 'rifle', 'weapon'].some(w => d.label.includes(w))
    );
    
    if (hasWeapon) {
      const weaponDet = detections.find(d => 
        ['knife', 'gun', 'pistol', 'rifle', 'weapon'].some(w => d.label.includes(w))
      );
      setWeaponAlert(`⚠️ ${weaponDet?.label} detected! Confidence: ${(weaponDet?.confidence || 0) * 100}%`);
    } else {
      setWeaponAlert(null);
    }
  }, [detections]);
  
  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <button onClick={() => setIsMonitoring(!isMonitoring)}>
        {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
      </button>
      
      {weaponAlert && (
        <div style={{ background: 'red', color: 'white', padding: '20px' }}>
          {weaponAlert}
        </div>
      )}
      
      {lastResult && (
        <div>
          <p>Alert Level: {lastResult.alertLevel}</p>
          <p>Summary: {lastResult.summary}</p>
          <p>Detections: {detections.length}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// 6. Testing the System
// ============================================

// Test with sample images:
async function testWeaponDetection() {
  // Load test image
  const img = new Image();
  img.src = '/path/to/test-image.jpg';
  
  img.onload = async () => {
    await initWeaponDetector();
    const result = await detectWeapons(img);
    
    console.log('Test Results:');
    console.log('Has Weapon:', result.hasWeapon);
    console.log('Weapon Type:', result.weaponType);
    console.log('Confidence:', result.confidence);
    console.log('Detections:', result.detections);
  };
}

// ============================================
// 7. Troubleshooting
// ============================================

// If weapons are not detected:
// 1. Check lighting conditions
// 2. Lower threshold in detection-config.ts
// 3. Ensure objects are clearly visible
// 4. Check browser console for errors
// 5. Try different camera angle

// If too many false positives:
// 1. Increase threshold in detection-config.ts
// 2. Improve lighting
// 3. Adjust weaponKeywords to exclude certain items

// If performance is slow:
// 1. Reduce FPS in detection-config.ts
// 2. Use Chrome browser for best performance
// 3. Close other tabs/applications
// 4. Wait for models to load (first time only)

// ============================================
// 8. Model Information
// ============================================

/*
Current Model: Xenova/detr-resnet-50
- Size: ~100MB
- Speed: ~200-500ms per frame
- Accuracy: Good for general object detection
- Download: Automatic on first use
- Cache: Browser IndexedDB

Alternative Models:
1. Xenova/yolov8n (faster, 30MB)
2. Xenova/yolov8s (more accurate, 50MB)
3. Custom fine-tuned model (best accuracy)

To change model:
Edit src/lib/ai/detection-config.ts:
  modelName: 'Xenova/yolov8n'
*/

// ============================================
// 9. Integration with Existing Code
// ============================================

// The weapon detection is already integrated in:
// - src/lib/useVideoAnalyzer.ts (automatic detection)
// - src/app/api/analyze-frame/route.ts (API endpoint)
// - src/components/camera/*.tsx (camera components)

// Just use the existing components and they will
// automatically detect weapons!

// ============================================
// 10. Next Steps
// ============================================

/*
1. Start the development server:
   npm run dev

2. Open your camera stream page

3. The weapon detection will start automatically

4. Check browser console for logs

5. Adjust settings in detection-config.ts as needed

6. Test with different objects and lighting

7. Fine-tune thresholds for your use case
*/
