# PM·AI — Cursor for Product Managers

> Turn raw user feedback into prioritized feature specs in seconds.

![Status](https://img.shields.io/badge/status-live-22c55e?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-f97316?style=flat-square) ![Vercel](https://img.shields.io/badge/deployed-Vercel-black?style=flat-square&logo=vercel) ![Cost](https://img.shields.io/badge/cost-%240%2Fmonth-22c55e?style=flat-square)

**[→ Live Demo](https://pm-ai-eight.vercel.app/)**

---

## What is this?

Inspired by Y Combinator's Spring 2026 Request for Startups: **"Cursor for Product Managers"**.

Cursor and Claude Code are great at helping engineers build software once it's clear *what* needs to be built. But figuring out *what* to build is the hard part — and nobody has built AI tooling for that yet.

PM·AI solves that. Paste in raw user feedback (interview notes, app reviews, support tickets, survey responses) and the app:

1. **Clusters** feedback into key themes using AI
2. **Scores** each theme by frequency × severity to give a priority ranking
3. **Generates** a full product spec — success metrics, user stories, UI changes, data model changes, and atomic dev tasks ready to paste into Cursor or Claude Code

---

## Features

- 📋 **AI Theme Analysis** — clusters raw feedback into 4–6 prioritized themes
- 🎯 **Product Context** — add your product description for more specific, relevant specs
- 📊 **Priority Scoring** — frequency × severity matrix with Critical / High / Medium labels
- 🔀 **Drag to Reorder** — override AI priority with your own judgment by dragging cards
- 📄 **Spec Generator** — one-click full PRD with dev task breakdown
- 💾 **Print / Save PDF** — export any spec as a clean PDF
- 📋 **Copy as Markdown** — paste directly into Cursor, Claude Code, Notion, or Linear
- 🕓 **History** — last 10 analyses saved locally in your browser
- 🎭 **Live Demo** — pre-loaded Notion feedback so visitors see real output instantly
- 📈 **Analytics** — Vercel Analytics to track real usage
- 🖼️ **OG Image** — rich link previews when shared on LinkedIn or Twitter

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Inline CSS + custom animations |
| Fonts | Playfair Display + JetBrains Mono |
| AI | OpenRouter (free tier) |
| Drag & Drop | @dnd-kit/core |
| Analytics | Vercel Analytics |
| Deployment | Vercel (free tier) |
| Database | None — stateless, localStorage for history |

---

## Why OpenRouter?

- Access to dozens of free LLMs with a single API key
- OpenAI-compatible API — swap models with one line change
- No credit card required to get started

**Recommended free models** (change one line in `route.ts`):

| Model | Notes |
|-------|-------|
| `meta-llama/llama-3.3-8b-instruct:free` | Best for structured JSON output |
| `google/gemini-2.0-flash-thinking-exp:free` | Strongest reasoning |
| `mistralai/mistral-7b-instruct:free` | Fast and lightweight |

---

## Running Locally

### Prerequisites
- Node.js 18+
- A free OpenRouter API key at [openrouter.ai](https://openrouter.ai)

### Setup

```bash
# Clone the repo
git clone https://github.com/arkham2424/pm-ai.git
cd pm-ai

# Install dependencies
npm install
```

### ⚠️ Required: Create your environment file

This app needs a free OpenRouter API key to run. Without it, all analysis requests will fail.

1. Go to **[openrouter.ai](https://openrouter.ai)** → Sign up → **Keys** → Create Key
2. Create a file called `.env.local` in the **root of the project** (same level as `package.json`)
3. Add this line inside it:

```
OPENROUTER_API_KEY=sk-or-your-key-here
```

> `.env.local` is already in `.gitignore` — it will never be committed. Every developer cloning this repo needs to create their own.

```bash
# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click **View Demo** to see it in action instantly without needing any feedback data.

---

## Project Structure

```
pm-ai/
├── app/
│   ├── page.tsx              # Main UI — upload, analysis, spec view
│   ├── layout.tsx            # Root layout + OG meta tags + Analytics
│   └── api/
│       └── analyze/
│           └── route.ts      # AI API route (keeps key server-side)
├── public/
│   └── og.png                # OG image for link previews
├── .env.local                # Your API key (never committed)
└── package.json
```

---

## How the AI Pipeline Works

```
User Feedback (raw text) + Product Context (optional)
        ↓
AI — Theme Extraction
  → Clusters feedback into 4-6 themes
  → Scores each by frequency (1-10) and severity (1-10)
  → Returns priority_score = frequency × severity / 10
        ↓
Ranked Theme List (draggable — reorder by your own judgment)
        ↓
AI — Spec Generation (on click)
  → Problem statement + why now
  → Success metrics
  → User stories
  → UI changes
  → Data model changes
  → Dev tasks with time estimates
        ↓
Export: Markdown (Cursor/Claude Code) or PDF
```

---

## Inspiration

Built in response to [Y Combinator's Spring 2026 Requests for Startups](https://www.ycombinator.com/rfs), specifically the **"Cursor for Product Managers"** idea by Andrew Miklas:

> *"Imagine a tool where you upload customer interviews and product usage data, ask 'what should we build next?', and get the outline of a new feature complete with an explanation based on customer feedback as to why this is a change worth making."*

PM·AI is a working prototype of exactly that.

---

## Roadmap

- [ ] Upload from URL (scrape App Store, G2, Reddit reviews)
- [ ] Notion / Linear export integration
- [ ] Product context memory across sessions
- [ ] Compare analyses side by side
- [ ] Team sharing via URL

---

## License

MIT