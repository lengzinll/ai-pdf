import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { env } from "./env";
import textToSpeach from "@google-cloud/text-to-speech";

const apiKey = env.api_key;

export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey,
  verbose: false,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: "embedding-001", // 768 dimensions
});

/**
 * Transforms the provided text into speech using Google Cloud's Text-to-Speech API.
 * @param {string} text - The text you want to transform into speech.
 * @returns {Promise<string>} - The path of the generated audio file.
 */
export async function textToSpeachWithGoogle(
  text: string
): Promise<string | Uint8Array> {
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "src/key.json";
    const client = new textToSpeach.TextToSpeechClient();
    const [response] = await client.synthesizeSpeech({
      audioConfig: {
        audioEncoding: "MP3",
      },
      input: { text },
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL", name: "en-US-Wavenet-D" },
    });

    if (!response.audioContent) {
      throw new Error("No audio content returned from Google Cloud");
    }
    return response.audioContent;

  } catch (error: any) {
    console.error("Error:", error);
    return error.toString();
  }
}
