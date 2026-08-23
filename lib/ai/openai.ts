/**
 * Thin OpenAI HTTP client. Kept provider-agnostic at the call sites — the
 * rest of the app talks to classifyFood / generateAIBattleReport /
 * generateFoodArtwork, so swapping providers means editing this file only.
 */

const OPENAI_BASE = "https://api.openai.com/v1";

export function textModelName(): string {
  return process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
}

export function imageModelName(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
}

export function hasTextAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function openaiFetch(path: string, body: unknown, timeoutMs = 30_000) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OPENAI_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Never leak secrets into error messages shown in the UI: if any
      // configured env value (e.g. a key pasted into the wrong variable)
      // appears in the response, redact it.
      const redacted = [process.env.OPENAI_API_KEY, key]
        .filter((s): s is string => Boolean(s && s.length > 8))
        .reduce((msg, secret) => msg.split(secret).join("[redacted]"), text)
        .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[redacted]");
      throw new Error(
        `OpenAI ${path} failed (${res.status}): ${redacted.slice(0, 300)}`,
      );
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** JSON-schema-constrained chat call. Returns the parsed JSON object. */
export async function openaiChatJson(args: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<unknown> {
  const data = await openaiFetch(
    "/chat/completions",
    {
      model: textModelName(),
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: args.schemaName, strict: true, schema: args.schema },
      },
    },
    args.timeoutMs ?? 20_000,
  );
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI returned no content");
  return JSON.parse(content);
}

/** Plain text chat call. */
export async function openaiChatText(args: {
  system: string;
  user: string;
  timeoutMs?: number;
}): Promise<string> {
  const data = await openaiFetch(
    "/chat/completions",
    {
      model: textModelName(),
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    },
    args.timeoutMs ?? 20_000,
  );
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned no content");
  }
  return content.trim();
}

/** Generate one square character image; returns PNG bytes. */
export async function openaiGenerateImage(
  prompt: string,
): Promise<{ bytes: Buffer; model: string }> {
  const model = imageModelName();
  const data = await openaiFetch(
    "/images/generations",
    {
      model,
      prompt,
      size: "1024x1024",
      background: "transparent",
      output_format: "png",
      n: 1,
    },
    120_000,
  );
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new Error("OpenAI returned no image data");
  return { bytes: Buffer.from(b64, "base64"), model };
}
