import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BodyType, FitnessGoal, FoodAnalysis, Language } from "../types";

const getAI = (isPremium = false) => {
  const apiKey = (isPremium ? process.env.API_KEY : process.env.GEMINI_API_KEY) || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("API key not found. Please ensure GEMINI_API_KEY is set.");
  }
  return new GoogleGenAI({ apiKey });
};

const handleAIError = (error: any) => {
  if (error?.message?.includes("403") || error?.status === "PERMISSION_DENIED") {
    throw new Error("API Permission Denied. If you are using premium features, please ensure you have selected a valid API key with billing enabled.");
  }
  throw error;
};

export const analyzeFoodImage = async (base64Image: string): Promise<FoodAnalysis> => {
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const prompt = "Analyze this food image and provide nutritional information. Return the data in JSON format.";
    
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            calories: { type: Type.STRING },
            nutrients: {
              type: Type.OBJECT,
              properties: {
                protein: { type: Type.STRING },
                carbs: { type: Type.STRING },
                fats: { type: Type.STRING },
                vitamins: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["protein", "carbs", "fats", "vitamins"]
            },
            description: { type: Type.STRING }
          },
          required: ["name", "calories", "nutrients", "description"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    return handleAIError(error);
  }
};

export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const prompt = "Extract all English text from this image. Only return the extracted text, nothing else.";
    
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
          ]
        }
      ]
    });

    return response.text || "";
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const ai = getAI();
    const model = "gemini-2.5-flash-preview-tts";
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Read this text clearly for pronunciation practice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || "";
  } catch (error) {
    return handleAIError(error);
  }
};

export const calculateRequirements = async (weight: number, bodyType: BodyType, goal: FitnessGoal) => {
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const prompt = `Calculate daily nutritional and water requirements for a person with:
      Weight: ${weight}kg
      Body Type: ${bodyType}
      Fitness Goal: ${goal}
      Return the data in JSON format.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            water: { type: Type.STRING },
            calcium: { type: Type.STRING },
            protein: { type: Type.STRING },
            calories: { type: Type.STRING },
            other: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["water", "calcium", "protein", "calories", "other"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    return handleAIError(error);
  }
};

export const translateContent = async (text: string, targetLanguage: Language): Promise<string> => {
  if (targetLanguage === 'English') return text;
  
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const prompt = `Translate the following text into ${targetLanguage}. Keep the tone professional and health-oriented. Only return the translated text.\n\nText: ${text}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    return response.text || text;
  } catch (error) {
    return handleAIError(error);
  }
};

export const getWorkoutPlan = async (bodyType: BodyType, goal: FitnessGoal) => {
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const prompt = `Provide a personalized daily workout schedule for someone with body type ${bodyType} and goal ${goal}. Include specific exercises and a suggested time map. Return as Markdown.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    return response.text || "No workout plan generated.";
  } catch (error) {
    return handleAIError(error);
  }
};

export const chatWithAI = async (parts: { text?: string, inlineData?: { mimeType: string, data: string } }[], history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[]) => {
  try {
    const ai = getAI();
    const model = "gemini-flash-latest";
    const systemInstruction = "You are a helpful, multilingual AI health and fitness assistant. You MUST respond ONLY in the language the user uses in their last message. If the user speaks in Bengali, respond ONLY in Bengali. If in Hindi, respond ONLY in Hindi. If in English, respond ONLY in English. DO NOT mix languages in a single response. Provide accurate, encouraging, and natural-sounding advice. Keep your responses BRIEF and CONCISE. If the user provides an image of a problem, analyze it and provide a solution, including relevant YouTube video links or tutorial links using Google Search. CRITICAL: If someone asks who owns this app, you MUST say 'the owner of the app.suyaballsaad'. If someone hears the AI in a chat (or mentions hearing you), you MUST respond with 'air'.";

    const response = await ai.models.generateContent({
      model,
      contents: [...history, { role: 'user', parts }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateImage = async (prompt: string, base64Image?: string): Promise<string> => {
  try {
    const ai = getAI(true);
    const model = "gemini-3-pro-image-preview";
    const parts: any[] = [{ text: prompt }];
    
    if (base64Image) {
      parts.unshift({
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: "image/jpeg"
        }
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return "";
  } catch (error) {
    return handleAIError(error);
  }
};
