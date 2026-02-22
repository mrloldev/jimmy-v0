"use client";

import { useEffect, useRef, useState } from "react";
import { consumeSSEStream } from "@/lib/stream-consumer";

interface JimmyStreamingMessageProps {
  stream: ReadableStream<Uint8Array>;
  onComplete: (
    finalText: string,
    stats?: Record<string, unknown> | null,
  ) => void;
  onPreviewReady?: (url: string, html?: string) => void;
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
  chatId?: string;
}

export function JimmyStreamingMessage({
  stream,
  onComplete,
  onChunk,
  onError,
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
  }, [stream, onComplete, onChunk, onError]);

  return (
    <div className="mb-4 whitespace-pre-wrap break-words font-mono text-gray-700 text-sm leading-relaxed dark:text-gray-200">
      {displayText || (
        <span className="text-muted-foreground">Generating...</span>
      )}
    </div>
  );
}
