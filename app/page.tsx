"use client";

import { Action, Actions } from "@/components/ai-elements/actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { getPersistedNanoId } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  CopyIcon,
  RefreshCcwIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  XCircleIcon,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { LangfuseWeb } from "langfuse";

const langfuseWeb = new LangfuseWeb({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
});

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  // Generate a unique chat ID that persists for this chat session
  const chatId = useMemo(() => `chat_${crypto.randomUUID()}`, []);
  // Track user feedback for each message ID (1 = thumbs up, 0 = thumbs down, null = no feedback)
  const [userFeedback, setUserFeedback] = useState<Map<string, number | null>>(
    new Map()
  );

  // Generate a persistent user ID for this user (client-side only)
  const userId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getPersistedNanoId({
      key: "qa-chatbot-user-id",
      prefix: "u-",
    });
  }, []);

  const { messages, sendMessage, status, regenerate, error } = useChat({
    transport: new DefaultChatTransport({
      body: { chatId, userId },
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleFeedback = (
    messageId: string,
    value: number,
    comment?: string
  ) => {
    setUserFeedback((prev) => new Map([...prev, [messageId, value]]));

    langfuseWeb.score({
      traceId: messageId,
      id: `user-feedback-${messageId}`,
      name: "user-feedback",
      value: value,
      comment: comment,
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Langfuse Expert Chatbot</h1>
          <p className="text-lg text-gray-600 mb-4">A chatbot that uses Langfuse&apos;s Docs to provide insights and answers</p>
          <div className="border-t border-gray-200"></div>
        </div>

        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts.filter((part) => part.type === "source-url")
                    .length > 0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter((part) => part.type === "source-url")
                        .map((part, i) => (
                          <SourcesContent key={`${message.id}-${i}`}>
                            <Source
                              key={`${message.id}-${i}`}
                              href={part.url}
                              title={part.url}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role}>
                            <MessageContent>
                              <Response>{part.text}</Response>
                            </MessageContent>
                          </Message>
                          {message.role === "assistant" &&
                            i === message.parts.length - 1 &&
                            message.id === messages[messages.length - 1]?.id && (
                              <Actions>
                                <Action
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(
                                      part.text
                                    );
                                  }}
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() => handleFeedback(message.id, 1)}
                                  label="Good response"
                                  className={
                                    userFeedback.get(message.id) === 1
                                      ? "text-green-600 hover:text-green-700"
                                      : ""
                                  }
                                >
                                  <ThumbsUpIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() => handleFeedback(message.id, 0)}
                                  label="Poor response"
                                  className={
                                    userFeedback.get(message.id) === 0
                                      ? "text-red-600 hover:text-red-700"
                                      : ""
                                  }
                                >
                                  <ThumbsDownIcon className="size-3" />
                                </Action>
                              </Actions>
                            )}
                        </Fragment>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status === "streaming" &&
                            i === message.parts.length - 1 &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    case "dynamic-tool":
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader
                            type={`tool-${part.toolName}` as const}
                            state={part.state}
                          />
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput
                              errorText={part.errorText}
                              output={
                                <Response>{part.output as string}</Response>
                              }
                            />
                          </ToolContent>
                        </Tool>
                      );

                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
            {error && (
              <div className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <XCircleIcon className="size-4 text-red-600" />
                  <h3 className="font-medium text-red-800">Error</h3>
                </div>
                <p className="mt-1 text-sm text-red-700">
                  {"An error occurred while processing your request."}
                </p>
                <button
                  type="button"
                  onClick={() => regenerate()}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  Try again
                </button>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="p-1">
          <PromptInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
          />
          <PromptInputToolbar className="">
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
