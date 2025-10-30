# Weapon Detection Configuration

This project uses **open-source AI models** for weapon detection, eliminating the need for paid API services like Google Gemini.

## How It Works

### 1. **Client-Side Detection (Browser)**
The main weapon detection runs directly in the user's browser using:
- **Transformers.js** - A JavaScript library that runs Hugging Face models in the browser
- **DETR (DEtection TRansformer)** - A state-of-the-art object detection model from Facebook AI
- **TensorFlow.js** - For general object detection (COCO-SSD) and pose estimation

### 2. **Models Used**

#### Primary Weapon Detector
- **Model**: `Xenova/detr-resnet-50` (via Transformers.js)
- **Type**: Object Detection Transformer
- **Detects**: Guns, knives, and other weapons
- **Runs**: Entirely in the browser (no server required)
- **Size**: ~100MB (downloaded and cached automatically)

#### Supporting Models
- **COCO-SSD**: Detects people, vehicles, packages, and common objects
- **MoveNet**: Pose detection for fallen/unconscious detection
- **Custom heuristics**: Bleeding detection via color analysis

### 3. **Detection Flow**

```
Video Frame
    ↓
┌─────────────────────────────────────┐
│  COCO-SSD (TensorFlow.js)          │
│  - People, vehicles, objects       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  DETR Weapon Detector              │
│  - Guns, knives, weapons           │
│  (Transformers.js)                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  MoveNet Pose Detection            │
│  - Fallen/unconscious detection    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Custom Heuristics                 │
│  - Bleeding detection (color)      │
└─────────────────────────────────────┘
    ↓
Combined Analysis Result
```

## Configuration

### Weapon Detection Threshold
Edit `/src/lib/ai/weapon-detector.ts`:

```typescript
const output = await weaponDetector(imageElement as any, {
  threshold: 0.3, // Lower = more sensitive (0.1-0.9)
  percentage: false,
});
```

### Analysis Frequency
Edit `/src/lib/useVideoAnalyzer.ts`:

```typescript
export function useVideoAnalyzer(options?: AnalyzerOptions) {
  const { 
    enabled = true, 
    fps = 1,           // Analyze 1 frame per second
    minScore = 0.4,    // Minimum confidence for detections
    historyLength = 3  // Frames to keep for smoothing
  } = options || {};
```

## Performance Considerations

### Model Loading
- Models are loaded asynchronously on first use
- Models are cached by the browser (IndexedDB)
- First load: ~30 seconds (downloads models)
- Subsequent loads: ~2-5 seconds (from cache)

### Processing Speed
- **COCO-SSD**: ~50-100ms per frame
- **Weapon Detector**: ~200-500ms per frame
- **Pose Detection**: ~100-200ms per frame
- **Total**: ~500-1000ms per analysis (1 FPS recommended)

### Browser Compatibility
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ⚠️ Safari (slower, WebGL limitations)
- ❌ IE (not supported)

## Improving Accuracy

### 1. Better Lighting
Ensure cameras have good lighting conditions for better detection.

### 2. Camera Angle
Position cameras to show subjects at appropriate angles (not too far, not too close).

### 3. Adjust Thresholds
- **Lower threshold**: More detections, more false positives
- **Higher threshold**: Fewer detections, fewer false positives

### 4. Custom Training (Advanced)
You can fine-tune the DETR model on your own weapon dataset:
1. Collect labeled images of weapons
2. Fine-tune `facebook/detr-resnet-50` on Hugging Face
3. Export to ONNX format
4. Replace model in `weapon-detector.ts`

## Alternative Models

If you need better weapon detection, consider these alternatives:

### Option 1: YOLOv8 (via Transformers.js)
```typescript
weaponDetector = await pipeline(
  'object-detection',
  'Xenova/yolov8n', // Fast and accurate
  { quantized: true }
);
```

### Option 2: Custom Fine-tuned Model
Train your own model on a weapon detection dataset:
- Dataset: https://universe.roboflow.com/weapons-detection/
- Fine-tune on Hugging Face or locally
- Export to ONNX format
- Use with Transformers.js

## No API Keys Required! 🎉

Unlike Gemini or other cloud-based AI services:
- ✅ No API costs
- ✅ No rate limits
- ✅ Works offline (after first load)
- ✅ Privacy-friendly (all processing in browser)
- ✅ No server required for detection

## Troubleshooting

### Models Not Loading
1. Check browser console for errors
2. Ensure internet connection for first load
3. Clear browser cache and reload
4. Try a different browser (Chrome recommended)

### Low Detection Accuracy
1. Lower the threshold in `weapon-detector.ts`
2. Improve lighting conditions
3. Ensure subjects are clearly visible
4. Consider using a different model (see alternatives above)

### Slow Performance
1. Reduce analysis FPS (e.g., 0.5 FPS)
2. Use a smaller model (e.g., `detr-resnet-50` → `yolov8n`)
3. Enable GPU acceleration in browser
4. Close other tabs/applications

## License

The models used are open-source and free for commercial use:
- DETR: Apache 2.0 License
- TensorFlow.js Models: Apache 2.0 License
- Transformers.js: MIT License
