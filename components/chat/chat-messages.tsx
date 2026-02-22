import { ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { JimmyStreamingMessage } from "@/components/chat/jimmy-streaming-message";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageRenderer } from "@/components/message-renderer";
import { MessageStats } from "@/components/chat/message-stats";

export interface ChatMessage {
  type: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  stream?: ReadableStream<Uint8Array> | null;
  stats?: Record<string, unknown> | null;
  plan?: string;
}

interface ChatMessagesProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  onStreamingComplete: (
    finalContent: string,
    stats?: Record<string, unknown> | null,
  ) => void;
  onPreviewReady?: (dataUrl: string) => void;
  onStreamingStarted?: () => void;
}

export function ChatMessages({
  chatHistory,
  isLoading,
  onStreamingComplete,
  onPreviewReady,
  onStreamingStarted,
}: ChatMessagesProps) {
  const streamingStartedRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      streamingStartedRef.current = false;
    }
  }, [isLoading]);

  if (chatHistory.length === 0) {
    return (
      <Conversation>
        <ConversationContent>
          <div />
        </ConversationContent>
      </Conversation>
    );
  }

  return (
    <Conversation>
      <ConversationContent>
        {chatHistory.map((msg, index) => (
          <Message from={msg.type} key={`message-${index}-${msg.type}`}>
            <MessageContent className="flex flex-col gap-2">
              {msg.plan && (
                <Collapsible defaultOpen={false} className="w-full">
                  <CollapsibleTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-90" />
                    Plan
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/30 p-3 text-xs whitespace-pre-wrap font-sans">
                      {msg.plan}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {msg.isStreaming && msg.stream ? (
                <JimmyStreamingMessage
                  stream={msg.stream}
                  onComplete={onStreamingComplete}
                  onPreviewReady={onPreviewReady}
                  onChunk={() => {
                    if (onStreamingStarted && !streamingStartedRef.current) {
                      streamingStartedRef.current = true;
                      onStreamingStarted();
                    }
                  }}
                  onError={(error) => console.error("Streaming error:", error)}
                />
              ) : msg.content ? (
                <MessageRenderer
                  content={msg.content}
                  role={msg.type}
                  messageId={`msg-${index}`}
                />
              ) : null}
              {msg.type === "assistant" && msg.stats && !msg.isStreaming && (
                <MessageStats stats={msg.stats} />
              )}
            </MessageContent>
          </Message>
        ))}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader size={16} className="text-gray-500 dark:text-gray-400" />
          </div>
        )}
      </ConversationContent>
    </Conversation>
  );
}
