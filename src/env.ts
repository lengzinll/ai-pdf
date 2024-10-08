export const env = {
  api_key: Bun.env.API_KEY || "",
};

if (!env.api_key) {
  throw new Error("Please set your OpenAI API key in the .env file");
}