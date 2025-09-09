import { langfuseSpanProcessor } from "@/instrumentation";
import { openai } from "@ai-sdk/openai";
import { LangfuseClient } from "@langfuse/client";
import {
  getActiveTraceId,
  observe,
  startActiveObservation,
  updateActiveObservation,
  updateActiveTrace,
} from "@langfuse/tracing";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { trace } from "@opentelemetry/api";
import {
  convertToModelMessages,
  experimental_createMCPClient,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { after } from "next/server";

// Using the client to get `prompt` using Languse's 
// Prompt Management: https://langfuse.com/docs/prompt-management 
const langfuseClient = new LangfuseClient({
  baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});

// Link the prompt to the trace of this request
const tracedGetPrompt = observe(
  langfuseClient.prompt.get.bind(langfuseClient.prompt),
  { name: "get-langfuse-prompt" },
);

export async function handler(req: Request) {
  const {
    messages,
    chatId,
    userId,
  }: {
    messages: UIMessage[];
    chatId: string;
    userId: string;
  } = await req.json();

  // The prompt text is stored along with a json config that looks like this:
  // ```
  // {
  //   "model": "gpt-5",
  //   "reasoningSummary": "low",
  //   "textVerbosity": "low",
  //   "reasoningEffort": "low"
  // }
  // ```
  const prompt = await tracedGetPrompt("langfuse-expert");
  const promptConfig = prompt.config as {
    model: string;
    reasoningSummary: "low" | "medium" | "high" | "detailed";
    textVerbosity: "low" | "medium" | "high";
    reasoningEffort: "low" | "medium" | "high";
  };

  // Extract the last message from the user and set it 
  // as Langfuse's active observation and trace input so that
  // you can see the user's message easily in the Langfuse UI
  const inputText = messages[messages.length - 1].parts.find(
    (part) => part.type === "text",
  )?.text;

  updateActiveObservation({
    input: inputText,
  });

  updateActiveTrace({
    name: "chat-trace",
    sessionId: chatId,
    userId,
    input: inputText,
  });

  // Create a MCP client to use Langfuse's tools
  // and trace the client initialization calls with `startActiveObservation`
  const langfuseDocsMCPClient = await startActiveObservation(
    "create-mcp-client",
    async () => {
      const url = new URL("https://langfuse.com/api/mcp");
      return experimental_createMCPClient({
        transport: new StreamableHTTPClientTransport(url, {
          sessionId: `qa-chatbot-${crypto.randomUUID()}`,
        }),
      });
    },
  );

  const tools = await langfuseDocsMCPClient.tools();

  const result = streamText({
    model: openai(String(promptConfig.model)),
    // This automatically exports AI SDK's traces to the OLTP provider, 
    // in this case Langfuse
    experimental_telemetry: {
      isEnabled: true,
    },
    providerOptions: {
      openai: {
        reasoningSummary: promptConfig.reasoningSummary,
        textVerbosity: promptConfig.textVerbosity,
        reasoningEffort: promptConfig.reasoningEffort,
      },
    },
    tools,
    messages: convertToModelMessages(messages),
    system: prompt.prompt,
    stopWhen: stepCountIs(10),
    onFinish: async (result) => {
      // We close the MCP client to release resources
      await langfuseDocsMCPClient.close();

      // Update the output in Langfuse for the UI to display
      updateActiveObservation({
        output: result.content,
      });
      updateActiveTrace({
        output: result.content,
      });

      // End span manually after stream has finished
      trace.getActiveSpan()?.end();
    },
    onError: async (error) => {
      // We close the MCP client to release resources
      await langfuseDocsMCPClient.close();

      // Update the output in Langfuse for the UI to display
      updateActiveObservation({
        output: error,
        level: "ERROR"
      });
      updateActiveTrace({
        output: error,
      });

      // End span manually after stream has finished
      trace.getActiveSpan()?.end();
    },
  });

  // Important in serverless environments: schedule flush after request is finished
  after(async () => await langfuseSpanProcessor.forceFlush());

  // Send the traceId back to the frontend so that users can
  // use the feedback widget in the frontend to give feedback on
  // the response and attach that to the trace in Langfuse
  return result.toUIMessageStreamResponse({
    generateMessageId: () => getActiveTraceId() ?? "",
    sendSources: true,
    sendReasoning: true,
  });
}

// Wrap handler with Langfuse's `observe` to trace the handler
export const POST = observe(handler, {
  name: "handle-chat-message",
  endOnExit: false, // end observation _after_ stream has finished
});
