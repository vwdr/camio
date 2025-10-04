import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || '';
export const openai = new OpenAI({ apiKey });

// Function to get contextual advice from OpenAI
export async function getContextualAdvice(
  situation: string, 
  query: string, 
  eventDetails?: string
) {
  try {
    // Construct the prompt with the situation and query
    const prompt = `
You are a security assistant for Camio, an intelligent video surveillance system.
 
Current situation: ${situation}

Event details: ${eventDetails || "No additional details available."}

User query: ${query}

Provide helpful, specific advice for this security situation. Be concise but thorough.
Include practical steps the user should take. If the situation is urgent or dangerous,
prioritize safety instructions. If you don't have enough information, suggest
what additional details would be helpful.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful AI assistant specialized in security and safety." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error getting contextual advice:", error);
    return "I'm unable to provide advice at the moment. Please try again later.";
  }
}