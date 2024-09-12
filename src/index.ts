import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import cors from "@elysiajs/cors";
import { api } from "./config";
import redis from "./redis";
import { unlinkSync } from "node:fs";
import { contentToPdf, scrapeBody } from "./helper";

type PDFType = {
  sourceId: string;
  url: string;
  name: string;
};

const addPDFSchema = t.Object({
  file: t.Optional(t.File()),
  content: t.Optional(t.String()),
});

const chatSchema = t.Object({
  messages: t.Array(
    t.Object({
      role: t.String({
        minLength: 1,
        default: "user",
      }),
      content: t.String({
        minLength: 1,
        default: "hello",
      }),
    })
  ),
});

async function getPDFFromDB() {
  const _pdf = await redis.get("pdf");
  const pdf: PDFType = _pdf ? JSON.parse(_pdf) : null;
  if (!pdf) return null;
  return pdf;
}

const app = new Elysia({ prefix: "/api/v1" }).use(cors());
app.use(swagger());
// app.use(
//   logger({
//     level: "error",
//   })
// );
app.use(
  staticPlugin({
    prefix: "/",
  })
);

app.get("/", async ({ request }) => {
  const appURL = request.url;
  return { message: "Hello Elysia with Bun" };
});
app.post(
  "/upload-pdf",
  async ({ body: { file, content }, request }) => {
    const appURL = request.url;
    if (!content && !file)
      return Response.json(
        { message: "No file provided or content provided" },
        { status: 400 }
      );
    const name = Math.round(Math.random()) + ".pdf";
    const path = "./public/" + name;
    if (content) {
      await contentToPdf(content, path);
    } else {
      if (!file) {
        return Response.json({ message: "No file provided" }, { status: 400 });
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      Bun.write(path, buffer);
    }

    const url = new URL(path, appURL).toString();
    // remove old one
    const old = await getPDFFromDB();
    if (old) {
      console.log(old.name);
      unlinkSync("./public/" + old.name);
      const deleteBody = {
        sources: [old.sourceId],
      };
      const removePdf = api({
        method: "POST",
        path: "sources/delete",
        body: deleteBody,
      });
      const removeRedis = redis.del("pdf");
      await Promise.all([removePdf, removeRedis]);
    }

    const response = await api({
      method: "POST",
      path: "/sources/add-url",
      body: { url },
    });
    const data = await response.json();
    if (!data.sourceId)
      return {
        message: data.message,
      };

    await redis.set(
      "pdf",
      JSON.stringify({
        sourceId: data.sourceId,
        url,
        name,
      })
    );
    return { name };
  },
  {
    body: addPDFSchema,
  }
);
app.post(
  "/chat",
  async function* ({ body, query }) {
    const { messages } = body;
    const pdf = await getPDFFromDB();
    if (!pdf)
      return Response.json({ message: "No PDF found" }, { status: 404 });

    const data = {
      sourceId: pdf.sourceId,
      stream: query.stream || false,
      messages,
    };

    const res = await api({
      method: "POST",
      path: "/chats/message",
      body: data,
    });

    if (res.ok && res.body) {
      if (query.stream) {
        const reader = res.body.getReader();
        let decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          yield chunk;
        }
      } else {
        const data = await res.json();
        return data;
      }
    }
  },
  {
    body: chatSchema,
    query: t.Object({
      stream: t.Optional(t.Boolean()),
    }),
  }
);

app.post(
  "/website-url",
  async ({ body }) => {
    const { url } = body;
    const content = await scrapeBody(url);
    if (content) {
      const name = Math.round(Math.random()) + ".pdf";
      const path = "./public/" + name;
      await contentToPdf(content, path);
      return { name };
    }

    return { message: "No content found" };
    
  },
  {
    body: t.Object({
      url: t.String({
        minLength: 1,
      }),
    }),
  }
);
app.listen(3000);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);


