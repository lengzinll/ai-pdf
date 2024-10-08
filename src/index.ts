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
import { embeddings, llm } from "./ai";

const app = new Elysia().use(cors());
app.use(swagger());
app.use(staticPlugin());

const TEMPLATE = `You are an assistant for question-answering tasks. Use only the following pieces of retrieved context and chat history to answer the question. If you don't know the answer, just reply kindly that you don't know:
==============================
Context: {context}
==============================
Current conversation: {chat_history}

user: {question}
assistant:`;

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

    console.log(messages)

    try {
      const doc = await prisma.source.findFirst();
      if (!doc) return { message: "Don't have doc please add doc !" };

      const formattedPreviousMessages = messages.slice(0, -1);
      const currentMessageContent = messages[messages.length - 1].content;

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await textSplitter.createDocuments([
        JSON.stringify(doc.content),
      ]);

      const vectorStore = new MemoryVectorStore(embeddings);
      await vectorStore.addDocuments(docs);
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
          chat_history: formattedPreviousMessages.join("\n"),
          question: currentMessageContent,
        });
        for await (const chunk of stream) {
          yield chunk.content;
        }
        return;
      }

      const response = await chain.invoke({
        chat_history: formattedPreviousMessages.join("\n"),
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
    }),
  }
);

app.listen(3000);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
