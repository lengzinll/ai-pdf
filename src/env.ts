export const env = {
  redis: Bun.env.REDIS_URL || "",
  api_key: Bun.env.API_KEY || "",
  base_url: Bun.env.BASE_URL || "",
};
