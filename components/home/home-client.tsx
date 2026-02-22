"use client";

import { nanoid } from "nanoid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  clearPromptFromStorage,
  createImageAttachment,
  createImageAttachmentFromStored,
  type ImageAttachment,
  loadPromptFromStorage,
  PromptInput,
  PromptInputImageButton,
  PromptInputImagePreview,
  PromptInputMicButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  savePromptToStorage,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { PreviewPanel } from "@/components/chat/preview-panel";
import { AppHeader } from "@/components/shared/app-header";
import { ModelSwitcher } from "@/components/shared/model-switcher";
import { ResizableLayout } from "@/components/shared/resizable-layout";
import { useModel } from "@/contexts/model-context";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { SUGGESTIONS } from "@/lib/suggestions";

// Component that uses useSearchParams - needs to be wrapped in Suspense
function SearchParamsHandler({ onReset }: { onReset: () => void }) {
  const searchParams = useSearchParams();

  // Reset UI when reset parameter is present
  useEffect(() => {
    const reset = searchParams.get("reset");
    if (reset === "true") {
      onReset();

      // Remove the reset parameter from URL without triggering navigation
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("reset");
      window.history.replaceState({}, "", newUrl.pathname);
    }
  }, [searchParams, onReset]);

  return null;
}

export function HomeClient() {
  const { model, useCoT } = useModel();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{
      type: "user" | "assistant";
      content: string;
      isStreaming?: boolean;
      stream?: ReadableStream<Uint8Array> | null;
      stats?: Record<string, unknown> | null;
      plan?: string;
    }>
  >([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState<{
    id: string;
    demo?: string;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReset = () => {
    // Reset all chat-related state
    setShowChatInterface(false);
    setChatHistory([]);
    setCurrentChatId(null);
    setCurrentChat(null);
    setMessage("");
    setAttachments([]);
    setIsLoading(false);
    setIsFullscreen(false);
    setRefreshKey((prev) => prev + 1);

    // Clear any stored data
    clearPromptFromStorage();

    // Focus textarea after reset
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Auto-focus the textarea on page load and restore from sessionStorage
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    // Restore prompt data from sessionStorage
    const storedData = loadPromptFromStorage();
    if (storedData) {
      setMessage(storedData.message);
      if (storedData.attachments.length > 0) {
        const restoredAttachments = storedData.attachments.map(
          createImageAttachmentFromStored,
        );
        setAttachments(restoredAttachments);
      }
    }
  }, []);

  // Save prompt data to sessionStorage whenever message or attachments change
  useEffect(() => {
    if (message.trim() || attachments.length > 0) {
      savePromptToStorage(message, attachments);
    } else {
      // Clear sessionStorage if both message and attachments are empty
      clearPromptFromStorage();
    }
  }, [message, attachments]);

  // Image attachment handlers
  const handleImageFiles = async (files: File[]) => {
    try {
      const newAttachments = await Promise.all(
        files.map((file) => createImageAttachment(file)),
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Error processing image files:", error);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleDragOver = () => {
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = () => {
    setIsDragOver(false);
  };

  const getErrorMessage = async (response: Response) => {
    let errorMessage =
      "Sorry, there was an error processing your message. Please try again.";
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (response.status === 429) {
        errorMessage =
          "You have exceeded your maximum number of messages for the day. Please try again later.";
      }
    } catch (parseError) {
      console.error("Error parsing error response:", parseError);
      if (response.status === 429) {
        errorMessage =
          "You have exceeded your maximum number of messages for the day. Please try again later.";
      }
    }
    return errorMessage;
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || isLoading) {
      return;
    }

    const userMessage = message.trim();
    const currentAttachments = [...attachments];

    // Clear sessionStorage immediately upon submission
    clearPromptFromStorage();

    setMessage("");
    setAttachments([]);

    const newId = nanoid();
    setCurrentChatId(newId);
    setCurrentChat({ id: newId });
    setShowChatInterface(true);
    window.history.pushState(null, "", `/chats/${newId}`);
    setChatHistory([
      {
        type: "user",
        content: userMessage,
      },
    ]);
    setIsLoading(true);

    try {
      let plan: string | undefined;
      if (useCoT) {
        const planRes = await fetchWithRetry("/api/chat/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
          retries: 2,
          retryDelay: 1000,
          timeout: 15000,
        });
        if (!planRes.ok) {
          const err = await getErrorMessage(planRes);
          throw new Error(err);
        }
        const planData = await planRes.json();
        plan = planData.plan ?? "";
        setChatHistory((prev) => [
          ...prev,
          { type: "assistant", content: "", plan },
        ]);
      }

      const chatBody: Record<string, unknown> = {
        message: userMessage,
        chatId: newId,
        streaming: true,
        model,
        attachments: currentAttachments.map((att) => ({ url: att.dataUrl })),
      };
      if (plan) {
        chatBody.plan = plan;
      }

      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
        retries: 2,
        retryDelay: 1000,
        timeout: 60000,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      setIsLoading(false);

      setChatHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === "assistant" && last.plan && !last.stream) {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: true, stream: response.body },
          ];
        }
        return [
          ...prev,
          {
            type: "assistant",
            content: "",
            isStreaming: true,
            stream: response.body,
          },
        ];
      });
    } catch (error) {
      console.error("Error creating chat:", error);
      setIsLoading(false);

      // Use the specific error message if available, otherwise fall back to generic message
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, there was an error processing your message. Please try again.";

      setChatHistory((prev) => [
        ...prev,
        {
          type: "assistant",
          content: errorMessage,
        },
      ]);
    }
  };

  const handleStreamingComplete = async (
    finalContent: string,
    stats?: Record<string, unknown> | null,
  ) => {
    setIsLoading(false);
    const { parseStructuredOutput } = await import("@/lib/parse-output");
    const { userResponse } = parseStructuredOutput(finalContent);
    const displayContent = userResponse || finalContent;

    setChatHistory((prev) => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      if (lastIndex >= 0 && updated[lastIndex].isStreaming) {
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: displayContent,
          isStreaming: false,
          stream: undefined,
          stats: stats ?? undefined,
        };
      }
      return updated;
    });
  };

  const handlePreviewReady = (dataUrl: string) => {
    setCurrentChat((prev) =>
      prev ? { ...prev, demo: dataUrl } : { id: nanoid(), demo: dataUrl },
    );
    setRefreshKey((k) => k + 1);
  };

  const handleChatSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || isLoading) {
      return;
    }

    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);

    setChatHistory((prev) => [...prev, { type: "user", content: userMessage }]);

    try {
      let plan: string | undefined;
      if (useCoT) {
        const planRes = await fetch("/api/chat/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });
        if (!planRes.ok) {
          const err = await getErrorMessage(planRes);
          throw new Error(err);
        }
        const planData = await planRes.json();
        plan = planData.plan ?? "";
        setChatHistory((prev) => [
          ...prev,
          { type: "assistant", content: "", plan },
        ]);
      }

      const chatBody: Record<string, unknown> = {
        message: userMessage,
        chatId: currentChatId ?? undefined,
        streaming: true,
        model,
      };
      if (plan) {
        chatBody.plan = plan;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      setIsLoading(false);

      setChatHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === "assistant" && last.plan && !last.stream) {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: true, stream: response.body },
          ];
        }
        return [
          ...prev,
          {
            type: "assistant",
            content: "",
            isStreaming: true,
            stream: response.body,
          },
        ];
      });
    } catch (error) {
      console.error("Error:", error);

      // Use the specific error message if available, otherwise fall back to generic message
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, there was an error processing your message. Please try again.";

      setChatHistory((prev) => [
        ...prev,
        {
          type: "assistant",
          content: errorMessage,
        },
      ]);
      setIsLoading(false);
    }
  };

  if (showChatInterface) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-black">
        {/* Handle search params with Suspense boundary */}
        <Suspense fallback={null}>
          <SearchParamsHandler onReset={handleReset} />
        </Suspense>

        <AppHeader />

        <ResizableLayout
          className="h-[calc(100vh-64px)]"
          leftPanel={
            <div className="flex h-full flex-col bg-gradient-to-b from-muted/40 via-background to-muted/30 dark:from-muted/20 dark:via-background dark:to-muted/15">
              <ChatMessages
                chatHistory={chatHistory}
                isLoading={isLoading}
                onStreamingComplete={handleStreamingComplete}
                onPreviewReady={handlePreviewReady}
                onStreamingStarted={() => setIsLoading(false)}
              />

              <ChatInput
                message={message}
                setMessage={setMessage}
                onSubmit={handleChatSendMessage}
                isLoading={isLoading}
                showSuggestions={false}
              />
            </div>
          }
          rightPanel={
            <PreviewPanel
              currentChat={currentChat}
              isFullscreen={isFullscreen}
              setIsFullscreen={setIsFullscreen}
              refreshKey={refreshKey}
              setRefreshKey={setRefreshKey}
            />
          }
        />

        {/* Hidden streaming component for initial response */}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-black">
      {/* Handle search params with Suspense boundary */}
      <Suspense fallback={null}>
        <SearchParamsHandler onReset={handleReset} />
      </Suspense>

      <AppHeader />

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-bold text-4xl text-gray-900 dark:text-white">
              What can we build together?
            </h2>
          </div>

          {/* Prompt Input */}
          <div className="mx-auto max-w-2xl">
            <PromptInput
              onSubmit={handleSendMessage}
              className="relative w-full"
              onImageDrop={handleImageFiles}
              isDragOver={isDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <PromptInputImagePreview
                attachments={attachments}
                onRemove={handleRemoveAttachment}
              />
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => setMessage(e.target.value)}
                value={message}
                placeholder="Describe what you want to build..."
                className="min-h-20 text-base"
                disabled={isLoading}
              />
              <PromptInputToolbar>
                <PromptInputTools>
                  <ModelSwitcher />
                </PromptInputTools>
                <PromptInputTools>
                  <PromptInputImageButton
                    onImageSelect={handleImageFiles}
                    disabled={isLoading}
                  />
                  <PromptInputMicButton
                    onTranscript={(transcript) => {
                      setMessage(
                        (prev) => prev + (prev ? " " : "") + transcript,
                      );
                    }}
                    onError={(error) => {
                      console.error("Speech recognition error:", error);
                    }}
                    disabled={isLoading}
                  />
                  <PromptInputSubmit
                    disabled={!message.trim() || isLoading}
                    status={isLoading ? "streaming" : "ready"}
                  />
                </PromptInputTools>
              </PromptInputToolbar>
            </PromptInput>
          </div>

          {/* Suggestions */}
          <div className="mx-auto mt-4 max-w-2xl">
            <Suggestions>
              {SUGGESTIONS.map((s) => (
                <Suggestion
                  key={s.label}
                  label={s.label}
                  prompt={s.prompt}
                  onClick={(prompt) => {
                    setMessage(prompt);
                    setTimeout(() => {
                      const form = textareaRef.current?.form;
                      if (form) {
                        form.requestSubmit();
                      }
                    }, 0);
                  }}
                />
              ))}
            </Suggestions>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-muted-foreground text-sm">
            <p>
              Powered by{" "}
              <Link
                href="https://chatjimmy.ai"
                className="text-foreground hover:underline"
              >
                ChatJimmy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
