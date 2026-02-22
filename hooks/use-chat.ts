import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { useModel } from "@/contexts/model-context";
import { useStreaming } from "@/contexts/streaming-context";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import type { Chat, ChatMessage } from "@/types/chat";

/**
 * Parses error response and returns appropriate error message.
 */
async function parseErrorResponse(response: Response): Promise<string> {
  const defaultMessage =
    "Sorry, there was an error processing your message. Please try again.";
  const rateLimitMessage =
    "You have exceeded your maximum number of messages for the day. Please try again later.";

  try {
    const errorData = await response.json();
    if (errorData.message) {
      return errorData.message;
    }
    if (response.status === 429) {
      return rateLimitMessage;
    }
  } catch {
    if (response.status === 429) {
      return rateLimitMessage;
    }
  }
  return defaultMessage;
}

/**
 * Custom hook for managing chat state and interactions.
 *
 * Handles:
 * - Fetching and caching chat data via SWR
 * - Sending messages with streaming support
 * - Managing chat history and streaming states
 * - Handoff from homepage streaming context
 *
 * @param chatId - The unique identifier of the chat
 * @returns Chat state and handler functions
 */
export function useChat(chatId: string) {
  const router = useRouter();
  const { model, useCoT } = useModel();
  const { handoff, clearHandoff } = useStreaming();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Use SWR to fetch chat data
  const { data: currentChat, isLoading: isLoadingChat } = useSWR<Chat>(
    chatId ? `/api/chats/${chatId}` : null,
    {
      onError: (error) => {
        console.error("Error loading chat:", error);
        // Redirect to home if chat not found
        router.push("/");
      },
      onSuccess: (chat) => {
        // Update chat history with existing messages when chat loads
        // But skip if we have a handoff (streaming from homepage) to avoid duplicates
        if (
          chat.messages &&
          chatHistory.length === 0 &&
          !(handoff.chatId === chatId && handoff.stream)
        ) {
          setChatHistory(
            chat.messages.map((msg) => ({
              type: msg.role,
              content:
                typeof msg.experimental_content === "string"
                  ? msg.experimental_content
                  : msg.content,
            })),
          );
        }
      },
    },
  );

  // Handle streaming from context (when redirected from homepage)
  useEffect(() => {
    if (handoff.chatId === chatId && handoff.stream && handoff.userMessage) {
      const userMessage = handoff.userMessage;

      // Add the user message to chat history
      setChatHistory((prev) => [
        ...prev,
        {
          type: "user",
          content: userMessage,
        },
      ]);

      // Start streaming the assistant response
      setIsStreaming(true);
      setChatHistory((prev) => [
        ...prev,
        {
          type: "assistant",
          content: "",
          isStreaming: true,
          stream: handoff.stream,
        },
      ]);

      // Clear the handoff immediately to prevent re-runs
      clearHandoff();
    }
  }, [chatId, handoff, clearHandoff]);

  const handleSendMessage = useCallback(
    async (
      e: React.FormEvent<HTMLFormElement>,
      attachments?: Array<{ url: string }>,
    ) => {
      e.preventDefault();
      if (!message.trim() || isLoading || !chatId) {
        return;
      }

      const userMessage = message.trim();
      setMessage("");
      setIsLoading(true);
      setChatHistory((prev) => [
        ...prev,
        { type: "user", content: userMessage },
      ]);

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
            throw new Error(await parseErrorResponse(planRes));
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
          chatId,
          streaming: true,
          model,
          ...(attachments && attachments.length > 0 && { attachments }),
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
          throw new Error(await parseErrorResponse(response));
        }

        if (!response.body) {
          throw new Error("No response body for streaming");
        }

        setIsStreaming(true);
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
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Sorry, there was an error processing your message. Please try again.";
        setChatHistory((prev) => [
          ...prev,
          { type: "assistant", content: errorMessage },
        ]);
        setIsLoading(false);
      }
    },
    [message, isLoading, chatId, model, useCoT],
  );

  const handleStreamingComplete = useCallback(
    async (finalContent: string, stats?: Record<string, unknown> | null) => {
      try {
        setIsStreaming(false);
        setIsLoading(false);
        const { parseStructuredOutput } = await import("@/lib/parse-output");
        const { userResponse } = parseStructuredOutput(finalContent || "");
        const displayContent = userResponse || finalContent || "";
        setChatHistory((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex]?.isStreaming) {
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
      } catch (error) {
        console.error("Error in handleStreamingComplete:", error);
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [],
  );

  const handlePreviewReady = useCallback(
    (reactCode: string) => {
      mutate(
        `/api/chats/${chatId}`,
        (prev: Chat | undefined) =>
          prev ? { ...prev, reactCode } : { id: chatId, reactCode },
        false,
      );
    },
    [chatId],
  );

  return {
    message,
    setMessage,
    currentChat,
    isLoading,
    setIsLoading,
    isStreaming,
    chatHistory,
    isLoadingChat,
    handleSendMessage,
    handleStreamingComplete,
    handlePreviewReady,
  };
}
