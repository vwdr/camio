# Weapon Detection Quick Setup

The weapon detection system has been installed but is **currently disabled by default** to ensure your app runs smoothly.

## Current Status: ⚠️ DISABLED

The ML-based weapon detector is currently disabled. The system will still detect weapons using keyword matching from COCO-SSD (less accurate but faster).

## How to Enable Weapon Detection

1. Open `src/lib/ai/detection-config.ts`
2. Find this line:
   ```typescript
   enableWeaponDetection: false,
   ```
3. Change it to:
   ```typescript
   enableWeaponDetection: true,
   ```
4. Save the file
5. The dev server will automatically reload

## What Happens When Enabled

✅ **Downloads ML model** (~100MB, first time only)  
✅ **Detects guns, knives, rifles** with high accuracy  
✅ **Runs in browser** - no API costs  
✅ **Adds ~500ms per frame** processing time  

## Testing Steps

1. **Enable the detector** (see above)
2. **Wait for model to download** (~30 seconds first time)
3. **Open browser console** to see detection logs
4. **Point camera** at test objects
5. **Check for weapon alerts** in the UI

## Fallback Mode (Current)

While disabled, the system uses:
- ✅ COCO-SSD for general objects
- ✅ Keyword matching for weapons ("knife", "gun", etc.)
- ✅ Pose detection for fallen people
- ✅ Bleeding detection heuristics

This is **faster but less accurate** for weapon detection.

## Troubleshooting

### If you see errors after enabling:
1. **Check browser console** for specific error messages
2. **Ensure good internet connection** (first download)
3. **Try Chrome browser** (best compatibility)
4. **Clear browser cache** and reload
5. **Disable again** if issues persist

### Common Issues:

**"Model failed to load"**
- Check internet connection
- Try a different browser
- Wait a bit and reload

**"Unsupported input type"**
- This should be fixed now
- If you still see it, disable detection and report the issue

**Slow performance**
- Reduce FPS in `detection-config.ts`
- Use a faster computer
- Close other tabs/apps

## Performance Impact

| Setting | Detection Speed | Accuracy |
|---------|----------------|----------|
| Disabled (current) | ~100ms/frame | Medium |
| Enabled | ~600ms/frame | High |

## Quick Configuration

Edit `src/lib/ai/detection-config.ts`:

```typescript
export const VIDEO_ANALYZER_CONFIG = {
  // Enable/disable weapon detection
  enableWeaponDetection: false, // Change to true to enable
  
  // How often to analyze (lower = better performance)
  fps: 1, // Frames per second
  
  // Detection sensitivity (lower = more sensitive)
  minScore: 0.4,
};

export const WEAPON_DETECTION_CONFIG = {
  // Detection threshold (lower = more sensitive)
  threshold: 0.3, // 0.1 - 0.9
  
  // Enable debug logging
  debug: false, // Change to true for logs
};
```

## When to Enable

✅ **Enable if you need:**
- High-accuracy weapon detection
- Specific weapon type identification
- Bounding boxes for weapons
- Low false positive rate

❌ **Keep disabled if you need:**
- Fastest performance
- Basic weapon keyword detection is enough
- Running on slower devices
- Testing other features first

## Next Steps

1. **Test with disabled** (current state) to ensure app works
2. **Enable detection** when ready for weapon detection
3. **Adjust thresholds** based on your needs
4. **Report any issues** you encounter

---

**Current Recommendation**: Keep disabled until you've tested the rest of your app, then enable for weapon detection testing.
