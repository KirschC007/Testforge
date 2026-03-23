// Minimal LLM test — does invokeLLM work at all?
import { invokeLLM } from "./server/_core/llm";

console.log("Testing LLM connection...");
const t0 = Date.now();
try {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a JSON generator. Output ONLY valid JSON." },
      { role: "user", content: 'Return this exact JSON: {"status": "ok", "count": 3}' },
    ],
    response_format: { type: "json_object" },
    thinkingBudget: 0,
    maxTokens: 100,
  });
  const elapsed = Date.now() - t0;
  console.log(`LLM responded in ${elapsed}ms`);
  console.log("Content:", response.choices[0].message.content);
} catch (err: any) {
  const elapsed = Date.now() - t0;
  console.error(`LLM FAILED after ${elapsed}ms:`, err.message);
  if (err.response) {
    console.error("HTTP Status:", err.response.status);
    console.error("Response body:", JSON.stringify(err.response.data));
  }
}
