import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI client (server-side key)
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
export const genAI = new GoogleGenerativeAI(apiKey);

// Function to analyze an image with Gemini
export async function analyzeImageWithGemini(imageData: string): Promise<{
  analysis: string;
  detectedObjects: string[];
  hasPerson: boolean;
  hasVehicle: boolean;
  hasPackage: boolean;
  hasWeapon: boolean;
  hasSuspiciousActivity: boolean;
  confidence: number;
}> {
  try {
    // For models that support multimodal input (both text and images)
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // Remove the data URL prefix to get just the base64 string
    const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const prompt = `Analyze this security camera image.

    Identify any people, vehicles, packages, weapons (guns, knives, firearms, blades, etc.), bleeding, or other suspicious/dangerous activity (robbery, person blacked out/unconscious, person bleeding, weapon visible, assault, fighting, etc.).

    **IMPORTANT for weapon detection:**
    - Look carefully for any firearms (guns, pistols, rifles, etc.)
    - Look for knives, blades, or other sharp weapons
    - Look for any objects being held in a threatening manner
    - Set hasWeapon to true if ANY weapon is detected
    - Include weapon type in detections array with high confidence

    For each detected object, return an entry with label and a bounding box in normalized coordinates (x, y, width, height) where x,y are top-left and values are between 0 and 1 relative to image dimensions. Also return an overall "suspicious" flag when behavior or context indicates immediate danger.

    Provide a strict JSON response only with this shape:
    {
      "analysis": string,
      "detections": [
        { "label": string, "bbox": { "x": number, "y": number, "width": number, "height": number }, "confidence": number }
      ],
      "hasPerson": boolean,
      "hasVehicle": boolean,
      "hasPackage": boolean,
      "hasWeapon": boolean,
      "hasSuspiciousActivity": boolean,
      "confidence": number (0-100)
    }

    Return only valid JSON and do not include additional commentary.`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ];

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;
  const responseText = await response.text();
    
    // Parse the JSON response
    try {
      // Extract JSON from the response (it might be wrapped in markdown code block)
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*?}/);
      const jsonStr = jsonMatch ? (jsonMatch[0].replace(/```json\n|```/g, '')) : responseText;
      const analysisResult = JSON.parse(jsonStr);

      const detections = Array.isArray(analysisResult.detections) ? analysisResult.detections : [];

      return {
        analysis: analysisResult.analysis || "Analysis unavailable",
        detectedObjects: detections.map((d: any) => d.label || '').filter(Boolean),
        hasPerson: !!analysisResult.hasPerson,
        hasVehicle: !!analysisResult.hasVehicle,
        hasPackage: !!analysisResult.hasPackage,
        hasWeapon: !!analysisResult.hasWeapon,
        hasSuspiciousActivity: !!analysisResult.hasSuspiciousActivity,
        confidence: analysisResult.confidence || 0,
        // include raw detections for client use
        detections: detections
      } as any;
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      return {
        analysis: "Failed to parse analysis result",
        detectedObjects: [],
        hasPerson: false,
        hasVehicle: false,
        hasPackage: false,
        hasWeapon: false,
        hasSuspiciousActivity: false,
        confidence: 0
      };
    }
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    return {
      analysis: "Failed to analyze image. Please try again.",
      detectedObjects: [],
      hasPerson: false,
      hasVehicle: false,
      hasPackage: false,
      hasWeapon: false,
      hasSuspiciousActivity: false,
      confidence: 0
    };
  }
}

// Function to analyze a video frame
export async function analyzeVideoFrame(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<{
  analysis: string;
  detectedObjects: string[];
  hasPerson: boolean;
  hasVehicle: boolean;
  hasPackage: boolean;
  hasWeapon: boolean;
  hasSuspiciousActivity: boolean;
  confidence: number;
}> {
  try {
    // Get canvas context
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }
    
    // Set canvas dimensions to match video
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 360;
    
    // Draw the current video frame to canvas
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // Get the image data as a base64 string
    const imageData = canvasElement.toDataURL('image/jpeg', 0.8);
    
    // Analyze the image data with Gemini
    const result = await analyzeImageWithGemini(imageData);
    return result;
  } catch (error) {
    console.error("Error in video frame analysis:", error);
    return {
      analysis: "Error processing video frame",
      detectedObjects: [],
      hasPerson: false,
      hasVehicle: false,
      hasPackage: false,
      hasWeapon: false,
      hasSuspiciousActivity: false,
      confidence: 0
    };
  }
}