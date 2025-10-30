/**
 * Weapon Detection Configuration
 * 
 * Adjust these settings to fine-tune the weapon detection system.
 */

export const WEAPON_DETECTION_CONFIG = {
  /**
   * Detection threshold (0.0 - 1.0)
   * Lower values = more sensitive (more detections, more false positives)
   * Higher values = less sensitive (fewer detections, fewer false positives)
   * Recommended: 0.3 for general use, 0.4 for fewer false positives
   */
  threshold: 0.2, // Lowered for better weapon detection

  /**
   * Enable quantized models for faster performance
   * Recommended: true (faster, slightly less accurate)
   */
  useQuantizedModels: true,

  /**
   * Model to use for weapon detection
   * Options:
   * - 'Xenova/detr-resnet-50' (default, balanced)
   * - 'Xenova/yolov8n' (faster, requires good lighting)
   * - 'Xenova/yolov8s' (slower, more accurate)
   */
  modelName: 'Xenova/detr-resnet-50' as const,

  /**
   * Keywords to identify weapons from generic object detectors
   * These are used as fallback if the ML model fails
   */
  weaponKeywords: [
    'knife',
    'gun',
    'pistol',
    'rifle',
    'revolver',
    'weapon',
    'firearm',
    'blade',
    'sword',
    'machete',
    'axe',
    'baseball bat', // Can be used as weapon
  ],

  /**
   * Minimum confidence for fallback keyword detection (0.0 - 1.0)
   */
  keywordMinConfidence: 0.3, // Lowered for better detection

  /**
   * Enable console logging for debugging
   */
  debug: true, // Enabled for debugging weapon detection
};

/**
 * Video Analyzer Configuration
 */
export const VIDEO_ANALYZER_CONFIG = {
  /**
   * Frames per second to analyze
   * Lower values = better performance, less responsive
   * Higher values = worse performance, more responsive
   * Recommended: 1 FPS for continuous monitoring, 2-4 FPS for active surveillance
   */
  fps: 1,

  /**
   * Minimum detection score (0.0 - 1.0)
   * Objects with scores below this will be ignored
   */
  minScore: 0.4,

  /**
   * Number of frames to keep for temporal smoothing
   * Higher values = smoother results, slower to respond to changes
   * Lower values = more reactive, more jittery results
   */
  historyLength: 3,

  /**
   * Enable weapon detection
   * Set to false if you want to disable the ML-based weapon detector
   */
  enableWeaponDetection: true, // ENABLED for weapon detection

  /**
   * Enable pose detection (for fallen person detection)
   */
  enablePoseDetection: false, // Disabled to prevent false positives

  /**
   * Enable bleeding detection heuristic
   */
  enableBleedingDetection: false, // Disabled to prevent false positives

  /**
   * Enable console logging for debugging
   */
  debug: false,
};

/**
 * Alert Level Thresholds
 */
export const ALERT_THRESHOLDS = {
  /**
   * Number of people for high alert
   */
  highAlertPersonCount: 12,

  /**
   * Number of people for medium alert
   */
  mediumAlertPersonCount: 6,

  /**
   * Minimum fraction of frames with weapon detection to trigger high alert
   * E.g., 0.25 means 25% of frames must have weapons detected
   */
  weaponFrameThreshold: 0.25,

  /**
   * Minimum fraction of frames with bleeding detection to trigger high alert
   */
  bleedingFrameThreshold: 0.25,

  /**
   * Minimum fraction of frames with fallen person detection to trigger medium alert
   */
  fallenFrameThreshold: 0.25,
};

/**
 * Bleeding Detection Configuration
 */
export const BLEEDING_DETECTION_CONFIG = {
  /**
   * Minimum red color value (0-255)
   */
  minRedValue: 150,

  /**
   * Red must be this much greater than green
   */
  redGreenDifference: 50,

  /**
   * Red must be this much greater than blue
   */
  redBlueDifference: 50,

  /**
   * Minimum percentage of red pixels to flag as bleeding (0.0 - 1.0)
   */
  redPixelThreshold: 1,

  /**
   * Sampling step for performance (pixels to skip)
   * Higher values = faster but less accurate
   */
  samplingStep: 4,
};

/**
 * Fallen Person Detection Configuration
 */
export const FALLEN_DETECTION_CONFIG = {
  /**
   * Aspect ratio threshold for fallen detection
   * Person is considered fallen if height/width < this value
   * Lower values = more sensitive
   */
  aspectRatioThreshold: 0.6,
};
