"use client";

import { useEffect, useRef, useState } from "react";

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
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">
  <style>
    body { min-height: 100vh; -webkit-font-smoothing: antialiased; font-family: 'DM Sans', system-ui, sans-serif; }
    input, button, select, textarea { font: inherit; }
    input:focus, button:focus { outline: none; }
  </style>
  <title>Preview</title>
</head>
<body data-theme="cupcake" class="min-h-screen bg-base-200">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const lucide = typeof window !== "undefined" && window.lucide ? window.lucide : { createIcons: function() {} };
    const LucideIcon = ({ name, icon, size, className, ...props }) => React.createElement("i", { "data-lucide": name || icon, className, ...props });
    ${reactCode}
  </script>
  <script>
    if (typeof window !== "undefined" && window.lucide) {
      window.lucide.createIcons();
    }
  </script>
</body>
</html>`;

      doc.open();
      doc.write(htmlContent);
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
