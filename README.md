# PM·AI — Cursor for Product Managers

> Turn raw user feedback into prioritized feature specs in seconds.

![PM·AI Demo](https://img.shields.io/badge/status-live-22c55e?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-f97316?style=flat-square) ![Vercel](https://img.shields.io/badge/deployed-Vercel-black?style=flat-square&logo=vercel)

**[→ Live Demo](https://pm-lbkz02yy1-arkham2424s-projects.vercel.app/)**

---

## What is this?

Inspired by Y Combinator's Spring 2026 Request for Startups: **"Cursor for Product Managers"**.

Cursor and Claude Code are great at helping engineers build software once it's clear *what* needs to be built. But figuring out *what* to build is the hard part — and nobody has built AI tooling for that yet.

PM·AI is a first step at solving that. You paste in raw user feedback (interview notes, app reviews, support tickets, survey responses) and the app:

1. **Clusters** feedback into key themes using AI
2. **Scores** each theme by frequency × severity to give a priority ranking
3. **Generates** a full product spec for any theme — including success metrics, user stories, UI changes, data model changes, and atomic dev tasks ready to paste into Cursor or Claude Code

---

## Demo

### Step 1 — Paste feedback or upload a file
Drop in raw, messy user feedback. No formatting needed.

### Step 2 — AI identifies themes
Clusters the feedback into 4–6 prioritized themes, scored by how frequent and painful each problem is.

### Step 3 — Generate a full spec
Click any theme to get a complete PRD: problem statement, success metrics, user stories, UI changes, data model changes, and a dev task breakdown.

### Step 4 — Copy to your coding agent
Export the spec as Markdown and paste it straight into Cursor or Claude Code.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Inline CSS with custom animations |
| AI | OpenRouter (free tier) |
| Deployment | Vercel (free tier) |
| Auth | None — stateless, no database needed |

---

## Why OpenRouter?

- Access to dozens of free LLMs with a single API key
- OpenAI-compatible API — easy to swap models with one line change
- No credit card required to get started
- Swap models instantly by changing one line in `route.ts`

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

1. Go to **[openrouter.ai](https://openrouter.ai)** → Sign up → **Keys** in the sidebar → **Create Key**
2. Create a file called `.env.local` in the **root of the project** (same level as `package.json`)
3. Add this line inside it:

```
OPENROUTER_API_KEY=sk-or-your-key-here
```

> `.env.local` is already in `.gitignore` — it will never be accidentally committed. Every developer cloning this repo needs to create their own.

```bash
# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and paste in some user feedback to test it.

---

## Project Structure

```
pm-ai/
├── app/
│   ├── page.tsx              # Main UI — upload, analysis, spec view
│   ├── layout.tsx            # Root layout
│   └── api/
│       └── analyze/
│           └── route.ts      # AI API route (keeps key server-side)
├── .env.local                # Your API key (never committed)
└── package.json
```

---

## Swapping Models

The model is one line in `app/api/analyze/route.ts`:

```typescript
model: "meta-llama/llama-3.3-8b-instruct:free",
```

Go to [openrouter.ai/models](https://openrouter.ai/models) → filter by **Free** → copy any model string and paste it here.

---

## How the AI Pipeline Works

```
User Feedback (raw text)
        ↓
AI — Theme Extraction
  → Clusters feedback into 4-6 themes
  → Scores each by frequency (1-10) and severity (1-10)
  → Returns priority_score = frequency × severity / 10
        ↓
Ranked Theme List (UI)
        ↓
AI — Spec Generation (on click)
  → Problem statement
  → Success metrics
  → User stories
  → UI changes
  → Data model changes
  → Dev tasks with time estimates
        ↓
Exportable Markdown PRD
```

---

## Inspiration

This project was built in response to [Y Combinator's Spring 2026 Requests for Startups](https://www.ycombinator.com/rfs), specifically the **"Cursor for Product Managers"** idea by Andrew Miklas:

> *"Imagine a tool where you upload customer interviews and product usage data, ask 'what should we build next?', and get the outline of a new feature complete with an explanation based on customer feedback as to why this is a change worth making."*

PM·AI is a working prototype of exactly that.

---

## Future Ideas

- [ ] Upload from URL (scrape App Store reviews, G2, Reddit)
- [ ] Notion export integration
- [ ] Linear / Jira task creation
- [ ] Product context input (so the AI understands your specific product)
- [ ] Save and compare analyses over time
- [ ] Team sharing via URL

---

## License

MIT
