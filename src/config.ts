import { env } from "./env";

export const config = {
  url: env.base_url,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": env.api_key,
  },
};

type Params = {
  method?: "POST" | "GET";
  path: string;
  body?: any;
  headers?: any;
};

export function api({ body, headers, method = "GET", path }: Params) {
  return fetch(config.url + path, {
    method,
    body: JSON.stringify(body),
    headers: { ...config.headers, ...headers },
  });
}
