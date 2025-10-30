import { useEffect, useRef, useState } from 'react';

// TF.js local analyzer implementing object detection + pose detection + heuristics
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as posedetection from '@tensorflow-models/pose-detection';
import type { Pose } from '@tensorflow-models/pose-detection';
import { detectWeapons, initWeaponDetector } from '@/lib/ai/weapon-detector';

export type Detection = {
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
};

type Analysis = {
  detections: Detection[];
  alertLevel: 'none' | 'low' | 'medium' | 'high';
  summary?: string;
};

type AnalyzerOptions = {
  enabled?: boolean;
  fps?: number;
  minScore?: number;
  historyLength?: number; // frames to keep for smoothing
};

export function useVideoAnalyzer(options?: AnalyzerOptions) {
  const { enabled = true, fps = 1, minScore = 0.4, historyLength = 3 } = options || {};
  const intervalRef = useRef<number | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Analysis | null>(null);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const runningRef = useRef(false);

  // models
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const poseRef = useRef<posedetection.PoseDetector | null>(null);
  const initializedRef = useRef(false);

  // temporal smoothing history (most recent first)
  const historyRef = useRef<Array<{ detections: Detection[]; summary?: Analysis }>>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try { if (poseRef.current && typeof (poseRef.current as any).dispose === 'function') (poseRef.current as any).dispose(); } catch (e) {}
      modelRef.current = null;
    };
  }, []);

  const initModels = async () => {
    if (initializedRef.current) return;
    setLoadingModels(true);
    try {
      // Import config to check what's enabled
      const { VIDEO_ANALYZER_CONFIG: config } = await import('@/lib/ai/detection-config');
      
      await tf.ready();
      // prefer webgl for performance when available
      try { await tf.setBackend('webgl'); } catch (e) {}

      // load coco-ssd with lite mobilenet for better perf on browsers
  // coco-ssd load() doesn't accept options in this package; use default load
  modelRef.current = await cocoSsd.load();

      // MoveNet via pose-detection (SinglePose.Lightning is fast) - only if enabled
      if (config.enablePoseDetection) {
        try {
          poseRef.current = await posedetection.createDetector(
            posedetection.SupportedModels.MoveNet,
            { modelType: 'SinglePose.Lightning' }
          );
        } catch (e) {
          console.warn('Pose detector failed to initialize, continuing without pose detection', e);
          poseRef.current = null;
        }
      } else {
        poseRef.current = null;
      }

      // Initialize weapon detector (open-source model) - only if enabled
      if (config.enableWeaponDetection) {
        try {
          await initWeaponDetector();
          console.log('Weapon detector initialized');
        } catch (e) {
          console.warn('Weapon detector failed to initialize, continuing without weapon detection', e);
        }
      }

      // Warm up models with a tiny tensor to compile shaders
      try {
        if (modelRef.current) {
          const t = tf.zeros([1, 256, 256, 3]);
          // @ts-ignore
          if ((modelRef.current as any).executeAsync) await (modelRef.current as any).executeAsync(t).catch(() => {});
          t.dispose();
        }
      } catch (e) {}

      initializedRef.current = true;
    } catch (e) {
      console.error('Failed to load TF models', e);
    } finally {
      setLoadingModels(false);
    }
  };

  const analyzeFrameOnce = async (videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): Promise<Analysis | null> => {
    if (!enabled) return null;
    if (!initializedRef.current) await initModels();
    if (!modelRef.current) return null;

    // Import config once at the beginning
    const { VIDEO_ANALYZER_CONFIG: config } = await import('@/lib/ai/detection-config');

  const ctx = (canvasEl.getContext as any)('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const w = videoEl.videoWidth || 320;
    const h = videoEl.videoHeight || 240;
    canvasEl.width = w;
    canvasEl.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);

    // run object detector on video element
    let predictions: any[] = [];
    try { predictions = await modelRef.current.detect(videoEl as any); } catch (e) { predictions = []; }

    const mapped: Detection[] = (predictions || [])
      .filter(p => (p.score || 0) >= minScore)
      .map((p: any) => ({
        label: String(p.class || '').toLowerCase(),
        bbox: { x: p.bbox[0] / w, y: p.bbox[1] / h, width: p.bbox[2] / w, height: p.bbox[3] / h },
        confidence: p.score || 0
      }));

    // Pose detection (non-fatal)
    let poses: Pose[] = [];
    if (poseRef.current) {
      try { poses = await (poseRef.current as any).estimatePoses(videoEl as any); } catch (e) { poses = []; }
    }

    // Simple heuristics per-frame
    const personBoxes = mapped.filter(m => m.label === 'person');

    // bleeding heuristic: sample pixels inside each person box at a grid step
    const bleedingForBoxes: boolean[] = [];
    if (config.enableBleedingDetection) {
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        for (const d of personBoxes) {
          const x0 = Math.max(0, Math.floor(d.bbox.x * w));
          const y0 = Math.max(0, Math.floor(d.bbox.y * h));
          const x1 = Math.min(w, x0 + Math.floor(d.bbox.width * w));
          const y1 = Math.min(h, y0 + Math.floor(d.bbox.height * h));
          let redCount = 0;
          let total = 0;
          const step = Math.max(4, Math.floor(Math.min(8, Math.max(1, Math.floor((x1 - x0) / 20)))));
          for (let yy = y0; yy < y1; yy += step) {
            for (let xx = x0; xx < x1; xx += step) {
              const idx = (yy * w + xx) * 4;
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              if (r > 140 && r > g + 30 && r > b + 30) redCount++;
              total++;
            }
          }
          bleedingForBoxes.push(total > 0 && (redCount / total) > 0.12);
        }
      } catch (e) {}
    }

    // Fallen heuristic per pose: compute aspect ratio of keypoints bbox
    const fallenForPoses: boolean[] = [];
    if (config.enablePoseDetection) {
      try {
        for (const pose of poses) {
          const keypoints = pose.keypoints || [];
          const ys = keypoints.map((k: any) => k.y || 0);
          const xs = keypoints.map((k: any) => k.x || 0);
          if (ys.length && xs.length) {
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const ph = Math.max(1, maxY - minY);
            const pw = Math.max(1, maxX - minX);
            const aspect = ph / pw;
            fallenForPoses.push(aspect < 0.6);
          }
        }
      } catch (e) {}
    }

    // Enhanced weapon detection using open-source ML model
    let weaponDetected = false;
    
    // Only run weapon detection if enabled and video has valid dimensions
    if (config.enableWeaponDetection && w > 0 && h > 0 && videoEl.readyState >= 2) {
      try {
        const weaponResult = await detectWeapons(videoEl);
        weaponDetected = weaponResult.hasWeapon;
        
        // Add weapon detections to our mapped array
        if (weaponResult.hasWeapon && weaponResult.detections.length > 0) {
          for (const weaponDet of weaponResult.detections) {
            mapped.push({
              label: weaponDet.label.toLowerCase(),
              bbox: {
                x: weaponDet.box.xmin / w,
                y: weaponDet.box.ymin / h,
                width: (weaponDet.box.xmax - weaponDet.box.xmin) / w,
                height: (weaponDet.box.ymax - weaponDet.box.ymin) / h,
              },
              confidence: weaponDet.score,
            });
          }
        }
      } catch (e) {
        // Silently fall back to keyword-based detection
        const weaponKeywords = ['knife', 'gun', 'pistol', 'rifle', 'revolver', 'weapon', 'firearm', 'blade', 'sword', 'machete', 'axe'];
        weaponDetected = mapped.some(m => weaponKeywords.some(k => m.label.includes(k)) && m.confidence > 0.45);
      }
    } else {
      // Video not ready, use keyword-based detection only
      const weaponKeywords = ['knife', 'gun', 'pistol', 'rifle', 'revolver', 'weapon', 'firearm', 'blade', 'sword', 'machete', 'axe'];
      weaponDetected = mapped.some(m => weaponKeywords.some(k => m.label.includes(k)) && m.confidence > 0.45);
    }

    const summaryParts: string[] = [];
    if (weaponDetected) summaryParts.push('⚠️ WEAPON DETECTED');
    if (personBoxes.length) summaryParts.push(`${personBoxes.length} person(s)`);
    if (fallenForPoses.some(Boolean)) summaryParts.push('possible fallen/unconscious');
    if (bleedingForBoxes.some(Boolean)) summaryParts.push('possible bleeding');

    const frameAnalysis: Analysis = {
      detections: mapped,
      alertLevel: 'none',
      summary: summaryParts.length ? summaryParts.join('; ') : 'no danger detected'
    };

    return frameAnalysis;
  };

  const computeAlertFromHistory = (history: typeof historyRef.current): Analysis => {
    let maxPersons = 0;
    let weaponFrames = 0;
    let fallenFrames = 0;
    let bleedingFrames = 0;
    for (const entry of history) {
      const dets = entry.detections || [];
      const personCount = dets.filter(d => d.label === 'person').length;
      maxPersons = Math.max(maxPersons, personCount);
      if (dets.some(d => ['knife','gun','pistol','rifle','revolver','weapon'].some(k => d.label.includes(k)) && d.confidence > 0.55)) weaponFrames++;
      const s = (entry.summary as any)?.summary || (entry.summary as any) || '';
      if (typeof s === 'string' && s.includes('fallen')) fallenFrames++;
      if (typeof s === 'string' && s.includes('bleeding')) bleedingFrames++;
    }

    let alertLevel: Analysis['alertLevel'] = 'none';
    if (maxPersons >= 12) alertLevel = 'high';
    else if (maxPersons >= 6) alertLevel = 'medium';

    if (weaponFrames >= Math.max(1, Math.floor(history.length / 4))) alertLevel = 'high';
    if (bleedingFrames >= Math.max(1, Math.floor(history.length / 4))) alertLevel = 'high';
    if (fallenFrames >= Math.max(1, Math.floor(history.length / 4))) alertLevel = alertLevel === 'high' ? 'high' : 'medium';

    const parts: string[] = [];
    if (weaponFrames) parts.push('⚠️ WEAPON DETECTED');
    if (maxPersons) parts.push(`${maxPersons} person(s)`);
    if (fallenFrames) parts.push('possible fallen/unconscious');
    if (bleedingFrames) parts.push('possible bleeding');

    return { detections: history[0]?.detections || [], alertLevel, summary: parts.length ? parts.join('; ') : 'no danger detected' };
  };

  const start = (videoEl: HTMLVideoElement | null, canvasEl: HTMLCanvasElement | null) => {
    if (!enabled || !videoEl || !canvasEl) return;
    if (runningRef.current) return;
    runningRef.current = true;

    const tick = async () => {
      try {
        const frame = await analyzeFrameOnce(videoEl, canvasEl);
        if (!frame) return;

        historyRef.current.unshift({ detections: frame.detections, summary: frame });
        if (historyRef.current.length > historyLength) historyRef.current.length = historyLength;

        const aggregate = computeAlertFromHistory(historyRef.current);

        setDetections(frame.detections);
        setLastResult(aggregate);
        setLastAnalysis(`${aggregate.alertLevel}:${aggregate.summary}`);
      } catch (e) {
        console.error('Analyzer tick failed', e);
      }
    };

    initModels().catch(() => {});

    tick();
    const id = window.setInterval(tick, Math.max(500, Math.floor(1000 / Math.max(1, fps))));
    intervalRef.current = id;
  };

  const stop = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
    historyRef.current = [];
    setDetections([]);
    setLastAnalysis(null);
  };

  return { start, stop, detections, lastAnalysis, lastResult, loadingModels } as const;
}
