# PM·AI — Cursor for Product Managers

> Turn raw user feedback into prioritized feature specs in seconds.

![PM·AI Demo](https://img.shields.io/badge/status-live-22c55e?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![Claude AI](https://img.shields.io/badge/Claude-Haiku-f97316?style=flat-square) ![Vercel](https://img.shields.io/badge/deployed-Vercel-black?style=flat-square&logo=vercel)

**[→ Live Demo](https://pm-lbkz02yy1-arkham2424s-projects.vercel.app/)**

---

## What is this?

Inspired by Y Combinator's Spring 2026 Request for Startups: **"Cursor for Product Managers"**.

Cursor and Claude Code are great at helping engineers build software once it's clear *what* needs to be built. But figuring out *what* to build is the hard part — and nobody has built AI tooling for that yet.

PM·AI is a first step at solving that. You paste in raw user feedback (interview notes, app reviews, support tickets, survey responses) and the app:

1. **Clusters** feedback into key themes using Claude AI
2. **Scores** each theme by frequency × severity to give a priority ranking
3. **Generates** a full product spec for any theme — including success metrics, user stories, UI changes, data model changes, and atomic dev tasks ready to paste into Cursor or Claude Code

---

## Demo

### Step 1 — Paste feedback or upload a file
Drop in raw, messy user feedback. No formatting needed.

### Step 2 — AI identifies themes
Claude Haiku clusters the feedback into 4–6 prioritized themes, scored by how frequent and painful each problem is.

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
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Deployment | Vercel (free tier) |
| Auth | None — stateless, no database needed |

---

## Why Claude Haiku?

- Cheapest Anthropic model (~$0.00025 per 1K tokens)
- Fast enough for real-time analysis
- One full feedback analysis costs less than $0.01
- Smart enough for structured JSON output

---

## Running Locally

### Prerequisites
- Node.js 18+
- An Anthropic API key (free credits at [console.anthropic.com](https://console.anthropic.com))

### Setup

```bash
# Clone the repo
git clone https://github.com/arkham2424/pm-ai.git
cd pm-ai

# Install dependencies
npm install

# Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local

# Run locally
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
│           └── route.ts      # Claude API route (keeps key server-side)
├── .env.local                # Your API key (never committed)
└── package.json
```

---

## How the AI Pipeline Works

```
User Feedback (raw text)
        ↓
Claude Haiku — Theme Extraction
  → Clusters feedback into 4-6 themes
  → Scores each by frequency (1-10) and severity (1-10)
  → Returns priority_score = frequency × severity / 10
        ↓
Ranked Theme List (UI)
        ↓
Claude Haiku — Spec Generation (on click)
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
- [ ] Product context input (so Claude understands your specific product)
- [ ] Save and compare analyses over time
- [ ] Team sharing via URL

---

## License

MIT
