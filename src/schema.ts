import { t } from "elysia";

export const addPDFSchema = t.Object({
  file: t.Optional(t.File()),
  content: t.Optional(t.String()),
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
        default: "what the doc say",
      }),
    })
  ),
});
