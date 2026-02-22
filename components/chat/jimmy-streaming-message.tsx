"use client";

import { useEffect, useRef, useState } from "react";
import { parseStructuredOutput } from "@/lib/parse-output";
import { consumeSSEStream } from "@/lib/stream-consumer";

interface JimmyStreamingMessageProps {
  stream: ReadableStream<Uint8Array>;
  onComplete: (
    finalText: string,
    stats?: Record<string, unknown> | null,
  ) => void;
  onPreviewReady?: (reactCode: string) => void;
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
  chatId?: string;
}

export function JimmyStreamingMessage({
  stream,
  onComplete,
  onPreviewReady,
  onChunk,
  onError,
  chatId,
}: JimmyStreamingMessageProps) {
  const [displayText, setDisplayText] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!stream || startedRef.current) {
      return;
    }
    startedRef.current = true;

    let isCancelled = false;

    consumeSSEStream(stream, (chunk) => {
      if (!isCancelled) {
        setDisplayText((prev) => prev + chunk);
        onChunk?.(chunk);
      }
    })
      .then(({ text, stats }) => {
        if (isCancelled) {
          return;
        }
        onComplete(text, stats);

        const { react } = parseStructuredOutput(text);
        if (react && !isCancelled && onPreviewReady) {
          if (chatId) {
            (async () => {
              try {
                const response = await fetch(`/api/chats/${chatId}/react`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reactCode: react }),
                });

                if (response.ok && !isCancelled) {
                  onPreviewReady(react);
                } else if (!isCancelled) {
                  onPreviewReady(react);
                }
              } catch (error) {
                console.warn("Failed to save React code to database:", error);
                if (!isCancelled) {
                  onPreviewReady(react);
                }
              }
            })();
          } else {
            onPreviewReady(react);
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
          onComplete("", null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [stream, onComplete, onPreviewReady, onChunk, onError, chatId]);

  return (
    <div className="mb-4 whitespace-pre-wrap break-words font-mono text-gray-700 text-sm leading-relaxed dark:text-gray-200">
      {displayText || (
        <span className="text-muted-foreground">Generating...</span>
      )}
    </div>
  );
}
