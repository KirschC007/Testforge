import { invokeLLM } from "./server/_core/llm";
invokeLLM({ messages: [{ role: "user", content: "ping" }] })
  .then(r => console.log("OK:", r?.choices?.[0]?.message?.content?.slice(0, 50)))
  .catch(e => console.log("FAIL:", e.message));
