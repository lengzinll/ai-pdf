import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { env } from "./env";

const apiKey = env.api_key

export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey,
  verbose: false,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: "embedding-001", // 768 dimensions
});
