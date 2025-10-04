declare module '@tensorflow-models/coco-ssd' {
  export type DetectedObject = { bbox: [number, number, number, number]; class: string; score: number };
  export type ObjectDetection = {
    detect: (input: any) => Promise<DetectedObject[]>;
  };
  export function load(): Promise<ObjectDetection>;
  const coco: { load: typeof load };
  export default coco;
}

declare module '@tensorflow-models/pose-detection' {
  export const SupportedModels: any;
  export type Keypoint = { x: number; y: number; score?: number; name?: string };
  export type Pose = { keypoints: Keypoint[] };
  export type PoseDetector = {
    estimatePoses: (input: any) => Promise<Pose[]>;
    dispose?: () => void;
  };
  export function createDetector(model: any, options?: any): Promise<PoseDetector>;
  const pd: any;
  export default pd;
}
