# Jimmy

**AI for Developers** — Generate and preview UIs with natural language. Built with [ChatJimmy](https://chatjimmy.ai) and Llama.

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

## Overview

Jimmy is an AI-powered UI generator that turns natural language descriptions into React components. It uses ChatJimmy with Llama for generation and supports streaming, live preview, and dark/light themes.

## Features

| Feature | Description |
|---------|-------------|
| **AI Component Generation** | Convert natural language prompts into React components |
| **Real-time Streaming** | Watch code generation happen live |
| **Live Preview** | Split-screen layout with instant component preview |
| **Dark/Light Theme** | Full theme support with system preference detection |
| **Image Attachments** | Attach images to prompts for context |
| **Voice Input** | Microphone support for voice-based prompts |

## Getting Started

### Prerequisites

- Node.js 22.x or later
- PostgreSQL database (local or hosted)
- ChatJimmy bot ID from [chatjimmy.ai](https://chatjimmy.ai)

### Installation

```bash
git clone https://github.com/mrloldev/jimmy-v0.git
cd jimmy-v0

bun install
# or: pnpm install

cp .env.example .env.local
```

### Environment

Create `.env.local`:

```bash
POSTGRES_URL=postgresql://user:password@localhost:5432/jimmy
CHATJIMMY_BOT_ID=your_bot_id
```

### Run

```bash
bun run db:migrate
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with Turbopack |
| `bun run build` | Run migrations and build |
| `bun run start` | Start production server |
| `bun run db:migrate` | Apply database migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check:fix` | Lint and format |
| `bun run typecheck` | TypeScript check |

## Tech Stack

- **Next.js 16** — App Router, Turbopack
- **React 19** — Concurrent rendering
- **ChatJimmy + Llama** — AI generation
- **PostgreSQL + Drizzle** — Database
- **Tailwind CSS 4** — Styling
- **Biome** — Linting and formatting

## License

MIT
