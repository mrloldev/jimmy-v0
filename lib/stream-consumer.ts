const STATS_KEYS = [
  "total_tokens",
  "eval_count",
  "eval_duration",
  "total_duration",
  "total_time",
  "decode_rate",
  "prefill_tokens",
  "decode_tokens",
] as const;

function evalDurationToSeconds(ns: number): number {
  if (ns > 1e9) return ns / 1e9;
  if (ns > 1e6) return ns / 1e6;
  return ns / 1000;
}

function extractStatsFromPayload(
  obj: Record<string, unknown>,
): Record<string, unknown> | null {
  const stats: Record<string, unknown> = {};
  let hasAny = false;
  for (const key of STATS_KEYS) {
    const v = obj[key];
    if (v !== undefined && v !== null && typeof v === "number") {
      stats[key] = v;
      hasAny = true;
    }
  }
  const count = stats.eval_count as number | undefined;
  const duration = stats.eval_duration as number | undefined;
  if (
    !stats.decode_rate &&
    typeof count === "number" &&
    typeof duration === "number"
  ) {
    const sec = evalDurationToSeconds(duration);
    if (sec > 0) {
      stats.decode_rate = count / sec;
      hasAny = true;
    }
  }
  return hasAny ? stats : null;
}

export async function consumeSSEStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<{ text: string; stats: Record<string, unknown> | null }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let rawMode: boolean | null = null;
  let sseStats: Record<string, unknown> | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      if (rawMode === null && buffer.length >= 9) {
        if (buffer.includes("data: ")) {
          rawMode = false;
        } else if (
          buffer.startsWith("===RESPONSE===") ||
          buffer.startsWith("===HTML===") ||
          buffer.startsWith("===JS===")
        ) {
          rawMode = true;
        }
      }

      if (rawMode === null) {
        continue;
      }

      if (rawMode) {
        fullText += chunk;
        onChunk(chunk);
        buffer = "";
        continue;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]" || data === "null") {
            continue;
          }

          let text = "";
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed === "object" && parsed !== null) {
              const extracted = extractStatsFromPayload(parsed);
              if (extracted) {
                sseStats = { ...(sseStats ?? {}), ...extracted };
              }
            }
            if (typeof parsed === "string") {
              text = parsed;
            } else if (parsed?.content) {
              text = parsed.content;
            } else if (parsed?.delta) {
              text = parsed.delta;
            } else if (parsed?.message?.content) {
              text = parsed.message.content;
            } else if (parsed?.text) {
              text = parsed.text;
            }
          } catch {
            text = data;
          }

          if (text) {
            fullText += text;
            onChunk(text);
          }
        }
      }
    }

    if (rawMode === true || (rawMode === null && buffer.trim().length > 0)) {
      fullText += buffer;
      if (buffer) {
        onChunk(buffer);
      }
    } else if (rawMode === false && buffer.startsWith("data: ")) {
      const data = buffer.slice(6);
      let text = "";
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === "object" && parsed !== null) {
          const extracted = extractStatsFromPayload(parsed);
          if (extracted) {
            sseStats = { ...(sseStats ?? {}), ...extracted };
          }
        }
        if (typeof parsed === "string") {
          text = parsed;
        } else if (parsed?.content) {
          text = parsed.content;
        } else if (parsed?.delta) {
          text = parsed.delta;
        } else if (parsed?.message?.content) {
          text = parsed.message.content;
        } else if (parsed?.text) {
          text = parsed.text;
        }
      } catch {
        text = data;
      }
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
  } finally {
    reader.releaseLock();
  }

  let stats: Record<string, unknown> | null = sseStats;
  const statsStart = fullText.indexOf("<|stats|>");
  const statsEnd = fullText.indexOf("<|/stats|>");

  if (statsStart !== -1 && statsEnd > statsStart) {
    const statsJson = fullText.slice(statsStart + 9, statsEnd).trim();
    try {
      const parsed = JSON.parse(statsJson) as Record<string, unknown>;
      stats = { ...(stats ?? {}), ...parsed };
    } catch {
      // keep sseStats if we had any
    }
    fullText = fullText.slice(0, statsStart).trim();
  }

  if (typeof console !== "undefined" && fullText) {
    console.log("[LM full output]", fullText);
  }
  return { text: fullText, stats };
}

export type StreamResult = {
  text: string;
  stats: Record<string, unknown> | null;
};
