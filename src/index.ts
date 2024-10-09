import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import cors from "@elysiajs/cors";
import { addContentSchema, chatSchema } from "./schema";
import prisma from "./db";
import { logger } from "@bogeychan/elysia-logger";
import { PromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RunnableSequence } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { embeddings, llm, textToSpeachWithGoogle } from "./ai";

const app = new Elysia();
app.use(cors());
app.use(swagger());
app.use(staticPlugin());

const TEMPLATE = `
You are an assistant for answer this question: {question}?.
from this context: {context}.
**NOTE: Please Answer By Follow this instructions carefully**:
  - You must response language same as the question language
  - Don't say "provide text ..." in your answer. you should say "our company ..." instead
  - If you don't know just reply a kindly general knowledge.
==============================
Current Conversation: {chat_history}
`;

app.get("/", async ({ request }) => {
  return { message: "Hello Elysia with Bun" };
});
app.post(
  "/add-content",
  async ({ body: { content } }) => {
    const data = {
      content: content as string,
    };

    if (typeof content !== "string") {
      const file = content as File;
      data.content = await file.text();
    }

    await Promise.all([
      prisma.source.deleteMany(),
      prisma.source.create({ data }),
    ]);

    return { message: "Content add success" };
  },
  {
    body: addContentSchema,
  }
);
app.post(
  "/chat",
  async function* ({ body, query }) {
    const { messages } = body;

    try {
      const doc = await prisma.source.findFirst();
      if (!doc) return { message: "Don't have doc please add doc !" };

      const previousMessages = messages.slice(0, -1);
      const currentMessageContent = messages[messages.length - 1].content;

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
      });
      const docs = await textSplitter.createDocuments([
        JSON.stringify(doc.content),
      ]);

      const vectorStore = new MemoryVectorStore(embeddings);
      await vectorStore.addDocuments(docs).catch((err) => console.error(err));
      let retriever = vectorStore.asRetriever();
      const prompt = PromptTemplate.fromTemplate(TEMPLATE);
      const chain = RunnableSequence.from([
        {
          question: (input) => input.question,
          chat_history: (input) => input.chat_history,
          context: async () => {
            const vectorQuery = await retriever.invoke(currentMessageContent);
            return vectorQuery.map((doc) => doc.pageContent).join("\n");
          },
        },
        prompt,
        llm,
      ]);

      if (query.stream) {
        const stream = await chain.stream({
          chat_history: previousMessages.join("\n"),
          question: currentMessageContent,
        });
        for await (const chunk of stream) {
          yield chunk.content;
        }
        return;
      }

      const response = await chain.invoke({
        chat_history: previousMessages.join("\n"),
        question: currentMessageContent,
      });

      return {
        content: response.content,
      };
    } catch (error) {
      return Response.json({ messages: error }, { status: 400 });
    }
  },
  {
    body: chatSchema,
    query: t.Object({
      stream: t.Optional(t.Boolean()),
      inKhmer: t.Boolean({
        default: false,
      }),
    }),
  }
);

app.post(
  "/text-to-speech",
  async ({ body }) => {
    const { text } = body;
    const response = await textToSpeachWithGoogle(text).catch((error) => {
      console.error("Error:", error);
      return Response.json({ messages: error }, { status: 400 });
    })
    return response;
  },
  {
    body: t.Object({
      text: t.String({
        minLength: 1,
        maxLength: 10000,
      }),
    }),
  }
);

app.listen(3000);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
