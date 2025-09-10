# AI Elements Chat Application

A modern chat application built with Next.js and AI Elements, featuring Langfuse integration for observability and prompt management.

## Features

- **AI SDK**: Uses [AI SDK](https://ai-sdk.dev) to build AI-powered products
- **AI Elements**: Uses [AI Elements](https://ai-sdk.dev/elements/overview) to build AI chatbots
- **MCP Tools**: Uses [Langfuse Docs's MCP](https://langfuse.com/docs/docs-mcp) tools
- **Langfuse Integration**: Uses [Prompt Management](https://langfuse.com/docs/prompt-management) and [Observability](https://langfuse.com/docs/tracing)

## Prerequisites

- Node.js 22+ 
- Langfuse stack ([Cloud](https://cloud.langfuse.com/) or [Self-Hosted](https://langfuse.com/docs/deployment/self-host))
- Langfuse API key
- OpenAI API key

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```bash
cp env.example .env.local
```

Add the environment variables to the `.env.local` file.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API Usage

The application provides a chat API endpoint at `/api/chat` that accepts streaming responses with AI-generated content, including reasoning and sources when available.