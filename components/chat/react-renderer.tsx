"use client";

import { useEffect, useRef, useState } from "react";
import { buildFullDocument } from "@/lib/parse-output";

interface ReactRendererProps {
  reactCode: string;
  className?: string;
}

export function ReactRenderer({ reactCode, className }: ReactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(iframeRef.current && reactCode)) {
      return;
    }

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) {
      return;
    }

    try {
      const fullHtml = buildFullDocument(reactCode);

      doc.open();
      doc.write(fullHtml);
      doc.close();
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to render React component",
      );
      console.error("React render error:", err);
    }
  }, [reactCode]);

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <p className="font-medium text-destructive">Render Error</p>
          <p className="mt-2 text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className={className}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
      title="React Preview"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}
