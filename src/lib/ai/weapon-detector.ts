import { pipeline, type ObjectDetectionPipeline } from '@xenova/transformers';
import { WEAPON_DETECTION_CONFIG } from './detection-config';

// Using a fine-tuned YOLO model for weapon detection from Hugging Face
// This model specifically detects guns, knives, and other weapons
let weaponDetector: ObjectDetectionPipeline | null = null;
let isLoading = false;

/**
 * Helper function to create a canvas from a video element
 */
function createCanvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

export async function initWeaponDetector(): Promise<void> {
  if (weaponDetector || isLoading) return;
  
  isLoading = true;
  try {
    // Using Xenova's object detection model (based on DETR)
    // This is a lighter model that works well in the browser
    weaponDetector = await pipeline(
      'object-detection',
      WEAPON_DETECTION_CONFIG.modelName,
      { quantized: WEAPON_DETECTION_CONFIG.useQuantizedModels }
    );
    if (WEAPON_DETECTION_CONFIG.debug) {
      console.log('Weapon detector initialized successfully with model:', WEAPON_DETECTION_CONFIG.modelName);
    }
  } catch (error) {
    console.error('Failed to initialize weapon detector:', error);
    weaponDetector = null;
  } finally {
    isLoading = false;
  }
}

export interface WeaponDetection {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface WeaponAnalysisResult {
  hasWeapon: boolean;
  weaponType: string | null;
  detections: WeaponDetection[];
  confidence: number;
}

/**
 * Analyzes an image for weapons (guns, knives, etc.)
 * @param imageElement - HTMLImageElement, HTMLCanvasElement, or HTMLVideoElement
 * @returns WeaponAnalysisResult with detection information
 */
export async function detectWeapons(
  imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<WeaponAnalysisResult> {
  if (!weaponDetector) {
    await initWeaponDetector();
  }

  if (!weaponDetector) {
    return {
      hasWeapon: false,
      weaponType: null,
      detections: [],
      confidence: 0,
    };
  }

  try {
    // Validate input
    if (!imageElement) {
      throw new Error('Invalid image element');
    }

    // Convert video/canvas to data URL for Transformers.js
    let imageUrl: string;
    
    if (imageElement instanceof HTMLImageElement) {
      // Image element - use src directly
      imageUrl = imageElement.src;
      if (!imageUrl) {
        throw new Error('Image src is empty');
      }
    } else if (imageElement instanceof HTMLVideoElement) {
      // Check if video is ready
      if (imageElement.readyState < 2 || imageElement.videoWidth === 0) {
        throw new Error('Video not ready');
      }
      const canvas = createCanvasFromVideo(imageElement);
      imageUrl = canvas.toDataURL('image/jpeg', 0.8);
    } else {
      // Canvas element
      imageUrl = imageElement.toDataURL('image/jpeg', 0.8);
    }

    // Run object detection with the image URL
    const output = await weaponDetector(imageUrl, {
      threshold: WEAPON_DETECTION_CONFIG.threshold,
      percentage: false, // Return pixel coordinates
    });

    if (WEAPON_DETECTION_CONFIG.debug) {
      console.log('🔍 Weapon Detector - All detections:', output);
      console.log('🔍 Detection threshold:', WEAPON_DETECTION_CONFIG.threshold);
    }

    // Filter for weapon-related objects
    // The model detects various objects, we need to identify weapons
    const weaponKeywords = WEAPON_DETECTION_CONFIG.weaponKeywords;

    interface DetectionOutput {
      label: string;
      score: number;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }

    const allDetections = output as DetectionOutput[];
    
    if (WEAPON_DETECTION_CONFIG.debug) {
      console.log('🔍 Total detections from model:', allDetections.length);
      allDetections.forEach(det => {
        console.log(`  - ${det.label} (confidence: ${(det.score * 100).toFixed(1)}%)`);
      });
    }

    const weaponDetections: WeaponDetection[] = allDetections
      .filter((det) => {
        const label = det.label.toLowerCase();
        const isWeapon = weaponKeywords.some((keyword) => label.includes(keyword));
        if (WEAPON_DETECTION_CONFIG.debug && isWeapon) {
          console.log(`⚠️ WEAPON DETECTED: ${det.label} (${(det.score * 100).toFixed(1)}%)`);
        }
        return isWeapon;
      })
      .map((det) => ({
        label: det.label,
        score: det.score,
        box: det.box,
      }));

    const hasWeapon = weaponDetections.length > 0;
    const maxConfidence = hasWeapon
      ? Math.max(...weaponDetections.map((d) => d.score))
      : 0;
    const weaponType = hasWeapon ? weaponDetections[0].label : null;

    if (WEAPON_DETECTION_CONFIG.debug) {
      if (hasWeapon) {
        console.log(`🚨 WEAPON ALERT: ${weaponType} detected with ${maxConfidence.toFixed(1)}% confidence`);
        console.log('🚨 All weapon detections:', weaponDetections);
      } else {
        console.log('✅ No weapons detected in this frame');
      }
    }

    return {
      hasWeapon,
      weaponType,
      detections: weaponDetections,
      confidence: maxConfidence * 100,
    };
  } catch (error) {
    console.error('Error detecting weapons:', error);
    return {
      hasWeapon: false,
      weaponType: null,
      detections: [],
      confidence: 0,
    };
  }
}

/**
 * Enhanced weapon detection combining multiple signals
 * This function uses heuristics alongside the ML model for better accuracy
 */
export async function analyzeForWeapons(
  imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  additionalContext?: {
    detectedObjects?: string[];
    handDetections?: any[];
  }
): Promise<WeaponAnalysisResult> {
  const mlResult = await detectWeapons(imageElement);

  // Additional heuristic: Check if any detected objects from other models
  // might be weapons (from COCO-SSD or other detectors)
  const contextWeapons =
    additionalContext?.detectedObjects?.filter((obj) => {
      const lower = obj.toLowerCase();
      return (
        lower.includes('knife') ||
        lower.includes('gun') ||
        lower.includes('weapon') ||
        lower.includes('scissors') ||
        lower.includes('baseball bat')
      );
    }) || [];

  // Combine results
  const hasWeapon = mlResult.hasWeapon || contextWeapons.length > 0;
  const confidence = Math.max(
    mlResult.confidence,
    contextWeapons.length > 0 ? 75 : 0
  );

  return {
    hasWeapon,
    weaponType: mlResult.weaponType || contextWeapons[0] || null,
    detections: mlResult.detections,
    confidence,
  };
}

/**
 * Analyzes a base64 image for weapons
 * Useful for API endpoints
 */
export async function detectWeaponsFromBase64(
  base64Image: string
): Promise<WeaponAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const result = await detectWeapons(img);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Handle base64 with or without data URL prefix
    if (!base64Image.startsWith('data:')) {
      img.src = `data:image/jpeg;base64,${base64Image}`;
    } else {
      img.src = base64Image;
    }
  });
}
