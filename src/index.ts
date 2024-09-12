import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import cors from "@elysiajs/cors";
import { api } from "./config";
import { unlink } from "node:fs/promises";
import { contentToPdf, isURL, scrapeBody } from "./helper";
import { addPDFSchema, chatSchema } from "./schema";
import prisma from "./libs/db";
import { logger } from "@bogeychan/elysia-logger";
import { v4 as uuidv4 } from 'uuid';

async function getPDFFromDB() {
  const source = await prisma.source.findFirst();
  if (!source) return null;
  return source;
}

const app = new Elysia({}).use(cors());
app.use(swagger());
app.use(
  logger({
    level: "info",
  })
);
app.use(staticPlugin());

app.get("/", async ({ request }) => {
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
    const name = uuidv4() + ".pdf";
    const path = "./public/" + name;
    if (content) {
      if (isURL(content)) {
        // user past url
        const scrapContent = await scrapeBody(content);
        if (scrapContent) content = scrapContent;
      }
      await contentToPdf(content, path);
    } else {
      if (!file) {
        return Response.json({ message: "No file provided" }, { status: 400 });
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      Bun.write(path, buffer);
    }
    const url = new URL(path, appURL).toString();
    const response = await api({
      method: "POST",
      path: "/sources/add-url",
      body: { url },
    });
    const data = await response.json();
    // remove old one
    const old = await getPDFFromDB();
    if (old) {
      console.log(old.name);
      await unlink("./public/" + old.name).catch((e) => {
        console.log(e.message);
      });
      const deleteBody = {
        sources: [old.sourceId],
      };
      const removePdf = api({
        method: "POST",
        path: "sources/delete",
        body: deleteBody,
      });
      const removeFromDB = prisma.source.deleteMany();
      await Promise.all([removePdf, removeFromDB]);
    }
    await prisma.source.create({
      data: {
        sourceId: data.sourceId || "no-sourceId",
        url,
        name,
      },
    });
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
      return Response.json({ message: "No Source found" }, { status: 404 });

    const data = {
      sourceId: pdf.sourceId,
      stream: query.stream || false,
      messages,
    };

    try {
      const res = await api({
        method: "POST",
        path: "/chats/message",
        body: data,
      })

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
    } catch (error) {
      return Response.json({  messages: error }, { status: 400 })
    }
  },
  {
    body: chatSchema,
    query: t.Object({
      stream: t.Optional(t.Boolean()),
    }),
  }
);
app.listen(3000);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
