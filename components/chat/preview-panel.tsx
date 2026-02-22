"use client";

import { Maximize, Minimize, Monitor, RefreshCw, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  demo?: string;
  url?: string;
}

interface PreviewPanelProps {
  currentChat: Chat | null;
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;
  refreshKey: number;
  setRefreshKey: (key: number | ((prev: number) => number)) => void;
}

async function getHtmlFromPreviewUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:text/html")) {
    const match = url.match(/^data:text\/html;charset=utf-8,(.+)$/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  if (url.startsWith("blob:")) {
    try {
      const res = await fetch(url);
      return await res.text();
    } catch {
      return null;
    }
  }
  return null;
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

  useEffect(() => {
    setShareUrl(null);
  }, [currentChat?.demo]);

  const handleShare = useCallback(async () => {
    const demo = currentChat?.demo;
    const chatId = currentChat?.id;
    if (!demo || !chatId) return;

    const html = await getHtmlFromPreviewUrl(demo);
    if (!html) return;

    setIsSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, html }),
      });
      const data = await res.json();
      if (data.url) {
        setShareUrl(data.url);
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error("Share failed:", e);
    } finally {
      setIsSharing(false);
    }
  }, [currentChat?.demo, currentChat?.id]);

  const showShareUrl = !!shareUrl;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg transition-all duration-300",
        isFullscreen ? "fixed inset-4 z-50 rounded-2xl bg-white dark:bg-black" : "flex-1",
      )}
    >
      <WebPreview defaultUrl={currentChat?.demo || ""}>
        <WebPreviewNavigation className="border-border/50 bg-muted/30">
          <WebPreviewNavigationButton
            onClick={() => setRefreshKey((prev) => prev + 1)}
            tooltip="Refresh preview"
            disabled={!currentChat?.demo}
          >
            <RefreshCw className="h-4 w-4" />
          </WebPreviewNavigationButton>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showShareUrl ? (
              <>
                <span className="truncate rounded-md bg-background/80 px-3 py-1.5 font-mono text-xs text-muted-foreground">
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
                  currentChat?.demo
                    ? "Click Share to get link"
                    : "Your app will appear here..."
                }
                value={currentChat?.demo ? "" : ""}
                className="flex-1"
              />
            )}
          </div>
          <WebPreviewNavigationButton
            onClick={handleShare}
            tooltip="Share and copy link"
            disabled={!currentChat?.demo || !currentChat?.id || isSharing}
          >
            <Share2 className={cn("h-4 w-4", isSharing && "animate-pulse")} />
          </WebPreviewNavigationButton>
          <WebPreviewNavigationButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            disabled={!currentChat?.demo}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        {currentChat?.demo ? (
          <WebPreviewBody
            key={refreshKey}
            src={currentChat.demo}
            className="min-h-0 bg-base-200/50"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-muted/20 to-muted/5">
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-8 text-center">
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
