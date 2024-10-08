import { t } from "elysia";

export const addContentSchema = t.Object({
  content: t.Union([t.String(), t.File()]),
});

export const chatSchema = t.Object({
  messages: t.Array(
    t.Object({
      role: t.String({
        minLength: 1,
        default: "user",
      }),
      content: t.String({
        minLength: 1,
        default: "who are you",
      }),
    })
  ),
});
