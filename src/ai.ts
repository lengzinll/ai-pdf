import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";

const apiKey = "AIzaSyCsS62jePwf8bSZFfEto69Fge1C9PxqgTA";

export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: "embedding-001", // 768 dimensions
});
