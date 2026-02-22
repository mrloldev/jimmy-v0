"use client";

import { useEffect, useRef, useState } from "react";
import { buildFullDocument, parseStructuredOutput } from "@/lib/parse-output";
import { consumeSSEStream } from "@/lib/stream-consumer";

interface JimmyStreamingMessageProps {
  stream: ReadableStream<Uint8Array>;
  onComplete: (
    finalText: string,
    stats?: Record<string, unknown> | null,
  ) => void;
  onPreviewReady?: (url: string) => void;
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
}

export function JimmyStreamingMessage({
  stream,
  onComplete,
  onPreviewReady,
  onChunk,
  onError,
}: JimmyStreamingMessageProps) {
  const [displayText, setDisplayText] = useState("");
  const startedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stream || startedRef.current) return;
    startedRef.current = true;

    consumeSSEStream(stream, (chunk) => {
      setDisplayText((prev) => prev + chunk);
      onChunk?.(chunk);
    })
      .then(({ text, stats }) => {
        onComplete(text, stats);
        const { react, head, css } = parseStructuredOutput(text);
        if (react) {
          try {
            const fullHtml = buildFullDocument(
              react,
              head || undefined,
              undefined,
              css || undefined,
            );
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current);
            }
            const blob = new Blob([fullHtml], {
              type: "text/html;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            onPreviewReady?.(url);
          } catch (e) {
            console.error("Failed to build preview:", e);
          }
        }
      })
      .catch((err) => {
        onError?.(err instanceof Error ? err : new Error(String(err)));
        onComplete("", null);
      });

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [stream, onComplete, onPreviewReady, onChunk, onError]);

  return (
    <div className="mb-4 whitespace-pre-wrap break-words font-mono text-gray-700 text-sm leading-relaxed dark:text-gray-200">
      {displayText || (
        <span className="text-muted-foreground">Generating...</span>
      )}
    </div>
  );
}
