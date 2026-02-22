"use client";

import {
  Code,
  Maximize,
  Minimize,
  Monitor,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { ReactRenderer } from "@/components/chat/react-renderer";
import { Button } from "@/components/ui/button";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  demo?: string;
  reactCode?: string;
  url?: string;
}

interface PreviewPanelProps {
  currentChat: Chat | null;
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;
  refreshKey: number;
  setRefreshKey: (key: number | ((prev: number) => number)) => void;
}

async function getReactCode(chatId: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(`/api/chats/${chatId}/react`, {
      retries: 2,
      retryDelay: 1000,
      timeout: 10000,
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.reactCode || null;
  } catch (error) {
    console.warn("Failed to fetch React code:", error);
    return null;
  }
}

export function PreviewPanel({
  currentChat,
  isFullscreen,
  setIsFullscreen,
  refreshKey,
  setRefreshKey,
}: PreviewPanelProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [reactCode, setReactCode] = useState<string>("");
  const prevChatIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentChatId = currentChat?.id;
    if (prevChatIdRef.current !== currentChatId) {
      setShareUrl(null);
      setShowCode(false);
      prevChatIdRef.current = currentChatId;
    }
  });

  const handleToggleCode = useCallback(async () => {
    if (showCode) {
      setShowCode(false);
      return;
    }

    const chatId = currentChat?.id;
    if (!chatId) {
      return;
    }

    if (currentChat?.reactCode) {
      setReactCode(currentChat.reactCode);
      setShowCode(true);
      return;
    }

    const code = await getReactCode(chatId);
    if (code) {
      setReactCode(code);
      setShowCode(true);
    }
  }, [currentChat?.id, currentChat?.reactCode, showCode]);

  const handleShare = useCallback(async () => {
    const chatId = currentChat?.id;
    if (!chatId) {
      return;
    }

    const reactCode = currentChat?.reactCode || (await getReactCode(chatId));
    if (!reactCode) {
      alert("No React code available to share");
      return;
    }

    setIsSharing(true);
    try {
      const { buildFullDocument } = await import("@/lib/parse-output");
      const html = buildFullDocument(reactCode);

      const res = await fetchWithRetry("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, html }),
        retries: 2,
        retryDelay: 1000,
        timeout: 15000,
      });

      if (!res.ok) {
        throw new Error(`Share request failed: ${res.status}`);
      }

      const data = await res.json();
      if (data?.url) {
        setShareUrl(data.url);
        try {
          await navigator.clipboard.writeText(data.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (clipboardError) {
          console.warn("Failed to copy to clipboard:", clipboardError);
          setShareUrl(data.url);
        }
      } else {
        throw new Error("No URL returned from share API");
      }
    } catch (e) {
      console.error("Share failed:", e);
      const errorMessage =
        e instanceof Error ? e.message : "Failed to share. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSharing(false);
    }
  }, [currentChat?.id, currentChat?.reactCode]);

  const showShareUrl = !!shareUrl;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg transition-all duration-300",
        isFullscreen
          ? "fixed inset-4 z-50 rounded-2xl bg-white dark:bg-black"
          : "flex-1",
      )}
    >
      <WebPreview defaultUrl={currentChat?.demo || ""}>
        <WebPreviewNavigation className="border-border/50 bg-muted/30">
          <WebPreviewNavigationButton
            onClick={() => setRefreshKey((prev) => prev + 1)}
            tooltip="Refresh preview"
            disabled={!currentChat?.reactCode}
          >
            <RefreshCw className="h-4 w-4" />
          </WebPreviewNavigationButton>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showShareUrl ? (
              <>
                <span className="truncate rounded-md bg-background/80 px-3 py-1.5 font-mono text-muted-foreground text-xs">
                  {shareUrl}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={async () => {
                    if (shareUrl) {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </>
            ) : (
              <WebPreviewUrl
                readOnly
                placeholder={
                  currentChat?.reactCode
                    ? "Click Share to get link"
                    : "Your app will appear here..."
                }
                value=""
                className="flex-1"
              />
            )}
          </div>
          <WebPreviewNavigationButton
            onClick={handleToggleCode}
            tooltip={showCode ? "View preview" : "View code"}
            disabled={!currentChat?.reactCode}
          >
            {showCode ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <Code className="h-4 w-4" />
            )}
          </WebPreviewNavigationButton>
          <WebPreviewNavigationButton
            onClick={handleShare}
            tooltip="Share and copy link"
            disabled={!currentChat?.reactCode || isSharing}
          >
            <Share2 className={cn("h-4 w-4", isSharing && "animate-pulse")} />
          </WebPreviewNavigationButton>
          <WebPreviewNavigationButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            disabled={!currentChat?.reactCode}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        {currentChat?.reactCode ? (
          showCode ? (
            <div className="flex flex-1 overflow-auto bg-background p-4">
              <div className="mx-auto w-full max-w-4xl">
                {reactCode ? (
                  <CodeBlock code={reactCode} language="jsx" showLineNumbers>
                    <CodeBlockCopyButton />
                  </CodeBlock>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">Loading code...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ReactRenderer
              key={refreshKey}
              reactCode={currentChat.reactCode}
              className="min-h-0 bg-base-200/50"
            />
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-muted/20 to-muted/5">
            <div className="rounded-2xl border border-border/60 border-dashed bg-background/50 p-8 text-center">
              <Monitor className="mx-auto mb-4 h-14 w-14 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No preview yet</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Start a conversation to generate your app
              </p>
            </div>
          </div>
        )}
      </WebPreview>
    </div>
  );
}
