"use client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useCallback, useEffect } from "react";

const SYSTEM_PROMPT_ANALYZE = `You are a senior product manager AI. You will receive user feedback.

Return a JSON array of 4-6 objects with:
- id: string (slug)
- theme: string (short name)
- problem: string (1 sentence core user problem)
- frequency: number (1-10)
- severity: number (1-10)
- quotes: string[] (2-3 short representative quotes)
- priority_score: number (frequency * severity / 10, 1 decimal)

Return ONLY valid JSON array, no markdown, no explanation.`;

const SYSTEM_PROMPT_SPEC_SOFTWARE = `You are a senior product manager and tech lead.

You will receive a theme, problem, and optional product context.

Return a JSON object with:
- title: string
- product_type: string (e.g. "SaaS app", "Mobile app", "Web app")
- problem_statement: string
- why_now: string
- success_metrics: string[]
- user_stories: string[]
- ui_changes: string[]
- data_model_changes: string[]
- dev_tasks: {id: string, title: string, description: string, estimate_hours: number}[]

Return ONLY valid JSON, no markdown.`;

const SYSTEM_PROMPT_SPEC_OTHER = `You are a senior product manager and strategist.

You will receive a theme, problem, and optional product context.

Based on the product context, decide what kind of product this is (physical product, service, e-commerce, restaurant, etc.) and adapt the spec accordingly.

Return a JSON object with:
- title: string
- product_type: string (e.g. "Physical product", "Service", "E-commerce", "Restaurant", "Retail")
- problem_statement: string
- why_now: string
- success_metrics: string[]
- user_stories: string[]
- recommended_changes: string[] (improvements suited to this product type — NOT software UI/data model)
- action_items: {id: string, title: string, description: string, estimate_hours: number}[] (concrete next steps; adjust effort units if not software)

Return ONLY valid JSON, no markdown.`;

interface Cluster {
  id: string;
  theme: string;
  problem: string;
  frequency: number;
  severity: number;
  quotes: string[];
  priority_score: number;
}

interface Spec {
  title: string;
  product_type: string;
  problem_statement: string;
  why_now: string;
  success_metrics: string[];
  user_stories: string[];
  // software mode
  ui_changes?: string[];
  data_model_changes?: string[];
  dev_tasks?: { id: string; title: string; description: string; estimate_hours: number }[];
  // other mode
  recommended_changes?: string[];
  action_items?: { id: string; title: string; description: string; estimate_hours: number }[];
}

const normalizeTask = (t: unknown, i: number) => {
  if (typeof t === "string") return { id: String(i), title: t, description: "", estimate_hours: 0 };
  if (typeof t === "object" && t !== null) {
    const task = t as Record<string, unknown>;
    return {
      id: String(task.id ?? i),
      title: String(task.title ?? task.name ?? "Task"),
      description: String(task.description ?? task.details ?? ""),
      estimate_hours: Number(task.estimate_hours ?? task.hours ?? task.time ?? 0),
    };
  }
  return { id: String(i), title: "Task", description: "", estimate_hours: 0 };
};

const callClaude = async (systemPrompt: string, userMessage: string) => {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userMessage }),
  });
  const { text } = await res.json();
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  const toArray = (val: unknown) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return Object.values(val as Record<string, unknown>);
  };

  parsed.success_metrics = toArray(parsed.success_metrics);
  parsed.user_stories = toArray(parsed.user_stories);
  parsed.ui_changes = toArray(parsed.ui_changes);
  parsed.data_model_changes = toArray(parsed.data_model_changes);
  parsed.dev_tasks = toArray(parsed.dev_tasks).map(normalizeTask);
  parsed.recommended_changes = toArray(parsed.recommended_changes);
  parsed.action_items = toArray(parsed.action_items).map(normalizeTask);

  return parsed;
};

const downloadPDF = (spec: Spec, mode: "software" | "other") => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const bottomSections = mode === "software" ? `
    <div class="two-col">
      <div class="section">
        <div class="section-label">UI Changes</div>
        ${spec.ui_changes?.map(u => `<div class="item"><span class="bullet">—</span><span>${u}</span></div>`).join("") ?? ""}
      </div>
      <div class="section">
        <div class="section-label">Data Model Changes</div>
        ${spec.data_model_changes?.map(d => `<div class="item"><span class="bullet">—</span><span>${d}</span></div>`).join("") ?? ""}
      </div>
    </div>
    <div class="section">
      <div class="section-label">Dev Tasks</div>
      ${spec.dev_tasks?.map((t, i) => `
        <div class="task">
          <div class="task-num">${String(i + 1).padStart(2, "0")}</div>
          <div><div class="task-title">${t.title}</div><div class="task-desc">${t.description}</div></div>
          <div class="task-hours">~${t.estimate_hours}h</div>
        </div>`).join("") ?? ""}
    </div>
  ` : `
    <div class="section">
      <div class="section-label">Recommended Changes</div>
      ${spec.recommended_changes?.map(r => `<div class="item"><span class="bullet">—</span><span>${r}</span></div>`).join("") ?? ""}
    </div>
    <div class="section">
      <div class="section-label">Action Items</div>
      ${spec.action_items?.map((t, i) => `
        <div class="task">
          <div class="task-num">${String(i + 1).padStart(2, "0")}</div>
          <div><div class="task-title">${t.title}</div><div class="task-desc">${t.description}</div></div>
          <div class="task-hours">~${t.estimate_hours}h</div>
        </div>`).join("") ?? ""}
    </div>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${spec.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'JetBrains Mono', monospace; background: white; color: #0a0a0a; padding: 48px; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 3px solid #0a0a0a; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 900; }
        .date { font-size: 10px; letter-spacing: 2px; color: #666; text-transform: uppercase; }
        .title { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 900; letter-spacing: -1px; margin-bottom: 8px; line-height: 1.1; }
        .product-type { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 20px; }
        .section { border-top: 1px solid #ddd; padding: 20px 0; page-break-inside: avoid; }
        .section-label { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #999; margin-bottom: 12px; }
        .problem { font-size: 14px; line-height: 1.8; color: #2a2a2a; }
        .pull-quote { border-left: 3px solid #0a0a0a; padding: 10px 16px; margin: 16px 0; font-family: 'Playfair Display', serif; font-size: 14px; font-style: italic; color: #444; line-height: 1.6; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .item { display: flex; gap: 12px; margin-bottom: 10px; font-size: 12px; line-height: 1.7; color: #2a2a2a; }
        .bullet { color: #999; flex-shrink: 0; }
        .task { display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eee; }
        .task-num { font-size: 10px; color: #999; padding-top: 2px; }
        .task-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
        .task-desc { font-size: 11px; color: #555; line-height: 1.6; }
        .task-hours { font-size: 10px; color: #999; white-space: nowrap; padding-top: 2px; }
        .footer { border-top: 1px solid #ddd; padding-top: 16px; margin-top: 32px; font-size: 10px; color: #999; letter-spacing: 1px; display: flex; justify-content: space-between; }
        @media print { body { padding: 32px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">PM·AI</div>
        <div class="date">Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>
      <div style="margin-bottom: 28px;">
        <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 8px;">Product Spec</div>
        <div class="title">${spec.title}</div>
        ${spec.product_type ? `<div class="product-type">${spec.product_type}</div>` : ""}
      </div>
      <div class="section">
        <div class="section-label">Problem Statement</div>
        <p class="problem">${spec.problem_statement}</p>
        <div class="pull-quote">${spec.why_now}</div>
      </div>
      <div class="two-col">
        <div class="section">
          <div class="section-label">Success Metrics</div>
          ${spec.success_metrics?.map(m => `<div class="item"><span class="bullet">◆</span><span>${m}</span></div>`).join("")}
        </div>
        <div class="section">
          <div class="section-label">User Stories</div>
          ${spec.user_stories?.map(s => `<div class="item"><span class="bullet">→</span><span>${s}</span></div>`).join("")}
        </div>
      </div>
      ${bottomSections}
      <div class="footer">
        <span>PM·AI — Cursor for Product Managers</span>
        <span>pm-ai-eight.vercel.app</span>
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

const priorityColor = (score: number) => score >= 7 ? "#c0392b" : score >= 5 ? "#d35400" : "#27ae60";
const priorityLabel = (score: number) => score >= 7 ? "CRITICAL" : score >= 5 ? "HIGH" : "MEDIUM";

function SortableCluster({ c, i, onSelect }: { c: Cluster; i: number; onSelect: (c: Cluster) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="cluster-row" onClick={() => onSelect(c)}>
        <div {...listeners} onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "grab", userSelect: "none", padding: "4px" }} title="Drag to reorder">
          <div className="cluster-num" style={{ pointerEvents: "none" }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ color: "var(--ink3)", fontSize: 16, lineHeight: 1 }}>⠿</div>
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: -0.5 }}>{c.theme}</h3>
          <p style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 12 }}>{c.problem}</p>
          <div className="two-col" style={{ gap: 16, marginBottom: 12 }}>
            <div>
              <div className="bar-label"><span>Frequency</span><span>{c.frequency}/10</span></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${c.frequency * 10}%` }} /></div>
            </div>
            <div>
              <div className="bar-label"><span>Severity</span><span>{c.severity}/10</span></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${c.severity * 10}%` }} /></div>
            </div>
          </div>
          <div>{c.quotes?.slice(0, 2).map((q, qi) => <span key={qi} className="quote-chip">"{q}"</span>)}</div>
          <p style={{ marginTop: 12, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink3)" }}>Click to generate spec · drag to reorder →</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="cluster-score" style={{ color: priorityColor(c.priority_score) }}>{c.priority_score}</div>
          <div className="priority-tag" style={{ color: priorityColor(c.priority_score) }}>{priorityLabel(c.priority_score)}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<Cluster | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<{ id: string; date: string; context: string; clusters: Cluster[] }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [productContext, setProductContext] = useState("");
  const [productMode, setProductMode] = useState<"software" | "other">("software");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pm-ai-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch { }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setClusters((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const NOTION_DEMO_CLUSTERS: Cluster[] = [
    { id: "offline-mode", theme: "Offline Mode", problem: "Users lose work and can't access content without an internet connection.", frequency: 9, severity: 9, quotes: ["I lost 2 hours of work because WiFi dropped", "Can't use Notion on the plane at all"], priority_score: 8.1 },
    { id: "mobile-performance", theme: "Mobile Performance", problem: "The mobile app is too slow and crashes on large workspaces.", frequency: 9, severity: 8, quotes: ["Mobile app takes 10 seconds to load a page", "Crashes every time I open a big database"], priority_score: 7.2 },
    { id: "realtime-collab", theme: "Real-time Collaboration", problem: "Live cursors and edits conflict, causing data loss in team editing sessions.", frequency: 7, severity: 8, quotes: ["My teammate's edits keep overwriting mine", "No way to see who's editing what in real time"], priority_score: 5.6 },
    { id: "search-quality", theme: "Search Quality", problem: "Search fails to find content inside databases and linked pages.", frequency: 8, severity: 7, quotes: ["Search never finds what I'm looking for", "Can't search inside tables at all"], priority_score: 5.6 },
  ];

  const sampleData = `The onboarding took way too long, I nearly gave up\nCan't figure out how to invite my team members\nSearch is completely broken, can't find anything\nLove the product but the mobile app crashes constantly\nWish there was a dark mode option\nThe dashboard is too cluttered, hard to find what I need\nNotifications are overwhelming, I turn them all off\nTeam collaboration features are missing\nCan't export my data to CSV\nThe loading speed is very slow on large datasets\nI need better filtering options in the reports\nWould love Slack integration\nMobile experience is terrible compared to desktop\nInviting teammates is confusing\nSearch doesn't find recent items\nApp crashes when uploading large files\nNeed bulk actions for managing items\nThe pricing page is confusing\nOnboarding emails are too frequent\nWish I could customize my dashboard layout`;

  const runPipeline = async (text: string) => {
    setError(null);
    setClusters([]);
    setSpec(null);
    try {
      setStage("analyzing");
      const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 10);
      const feedbackBlock = lines.slice(0, 60).join("\n");
      const context = productContext.trim() ? `Product context: ${productContext.trim()}\n\n` : "";
      const result: Cluster[] = await callClaude(SYSTEM_PROMPT_ANALYZE, `${context}Here is user feedback:\n\n${feedbackBlock}\n\nIdentify 4-6 key themes.`);
      const sorted = result.sort((a, b) => b.priority_score - a.priority_score);
      setClusters(sorted);
      const newEntry = { id: Date.now().toString(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), context: productContext.trim() || "No context provided", clusters: sorted };
      const updated = [newEntry, ...history].slice(0, 10);
      setHistory(updated);
      localStorage.setItem("pm-ai-history", JSON.stringify(updated));
      setStage("done");
    } catch (e: unknown) {
      setError("Analysis failed: " + (e instanceof Error ? e.message : String(e)));
      setStage("idle");
    }
  };

  const generateSpec = async (feature: Cluster) => {
    setSelectedFeature(feature);
    setSpec(null);
    setStage("speccing");
    try {
      const context = productContext.trim() ? `Product context: ${productContext.trim()}\n\n` : "";
      const prompt = productMode === "software" ? SYSTEM_PROMPT_SPEC_SOFTWARE : SYSTEM_PROMPT_SPEC_OTHER;
      const result: Spec = await callClaude(prompt, `${context}Generate a full product spec for:\n\nTheme: ${feature.theme}\nProblem: ${feature.problem}\nQuotes: ${feature.quotes.join(" | ")}\nPriority: ${feature.priority_score}`);
      setSpec(result);
      setStage("done");
    } catch (e: unknown) {
      setError("Spec failed: " + (e instanceof Error ? e.message : String(e)));
      setStage("done");
    }
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { const text = e.target?.result as string; setFeedback(text); runPipeline(text); };
    reader.readAsText(file);
  }, [productContext, productMode]);

  const copyMarkdown = (spec: Spec) => {
    const md = productMode === "software"
      ? `# ${spec.title}\n${spec.product_type ? `**${spec.product_type}**\n` : ""}\n## Problem\n${spec.problem_statement}\n\n## Why Now\n${spec.why_now}\n\n## Success Metrics\n${spec.success_metrics?.map(m => `- ${m}`).join("\n")}\n\n## User Stories\n${spec.user_stories?.map(s => `- ${s}`).join("\n")}\n\n## UI Changes\n${spec.ui_changes?.map(u => `- ${u}`).join("\n")}\n\n## Data Model Changes\n${spec.data_model_changes?.map(d => `- ${d}`).join("\n")}\n\n## Dev Tasks\n${spec.dev_tasks?.map((t, i) => `### ${i + 1}. ${t.title}\n${t.description}\n⏱ ${t.estimate_hours}h`).join("\n\n")}`
      : `# ${spec.title}\n${spec.product_type ? `**${spec.product_type}**\n` : ""}\n## Problem\n${spec.problem_statement}\n\n## Why Now\n${spec.why_now}\n\n## Success Metrics\n${spec.success_metrics?.map(m => `- ${m}`).join("\n")}\n\n## User Stories\n${spec.user_stories?.map(s => `- ${s}`).join("\n")}\n\n## Recommended Changes\n${spec.recommended_changes?.map(r => `- ${r}`).join("\n")}\n\n## Action Items\n${spec.action_items?.map((t, i) => `### ${i + 1}. ${t.title}\n${t.description}\n⏱ ${t.estimate_hours}h`).join("\n\n")}`;
    navigator.clipboard.writeText(md);
  };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", background: "#F5F0E8", minHeight: "100vh", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Playfair+Display:wght@700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --bg: #F5F0E8; --bg2: #EDE8DF; --ink: #0a0a0a; --ink2: #2a2a2a; --ink3: #666; --rule: #C4BFB6; }
        body { background: var(--bg); }
        .display { font-family: 'Playfair Display', serif; }
        .ticker { background: var(--ink); color: var(--bg); font-size: 10px; letter-spacing: 3px; padding: 6px 0; overflow: hidden; white-space: nowrap; }
        .ticker-inner { display: inline-block; animation: ticker 25s linear infinite; }
        @keyframes ticker { from{transform:translateX(100vw)} to{transform:translateX(-100%)} }
        .nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 20px 48px; border-bottom: 3px solid var(--ink); }
        .masthead { text-align: center; padding: 48px 48px 32px; border-bottom: 1px solid var(--rule); }
        .tagline { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: var(--ink2); margin-bottom: 16px; }
        .big-title { font-family: 'Playfair Display', serif; font-size: clamp(3.5rem, 9vw, 7rem); font-weight: 900; line-height: 0.9; letter-spacing: -3px; color: var(--ink); margin-bottom: 20px; }
        .subtitle { font-size: 12px; letter-spacing: 0.5px; color: var(--ink2); max-width: 480px; margin: 0 auto; line-height: 1.8; }
        .step-bar { display: flex; border-bottom: 1px solid var(--rule); background: var(--bg2); }
        .step-item { flex: 1; padding: 12px 24px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink3); border-right: 1px solid var(--rule); display: flex; align-items: center; gap: 10px; transition: color 0.3s; }
        .step-item:last-child { border-right: none; }
        .step-item.active { color: var(--ink); background: var(--bg); }
        .step-item.done { color: #27ae60; }
        .step-num { width: 20px; height: 20px; border: 1px solid currentColor; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
        .main { max-width: 960px; margin: 0 auto; padding: 48px 24px; }
        .mode-toggle { display: flex; margin-bottom: 28px; border: 1px solid var(--rule); }
        .mode-btn { flex: 1; padding: 12px 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; border: none; transition: all 0.2s; }
        .mode-btn + .mode-btn { border-left: 1px solid var(--rule); }
        .mode-btn.active { background: var(--ink); color: var(--bg); }
        .mode-btn.inactive { background: var(--bg2); color: var(--ink3); }
        .mode-btn.inactive:hover { color: var(--ink); background: #E8E3DA; }
        .upload-zone { border: 1px solid var(--rule); background: var(--bg2); padding: 64px 40px; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; margin-bottom: 28px; }
        .upload-zone::before { content: ''; position: absolute; inset: 6px; border: 1px dashed var(--rule); pointer-events: none; transition: border-color 0.2s; }
        .upload-zone:hover, .upload-zone.drag { background: #E8E3DA; }
        .upload-zone:hover::before, .upload-zone.drag::before { border-color: var(--ink); }
        .upload-icon { font-family: 'Playfair Display', serif; font-size: 64px; line-height: 1; color: var(--rule); margin-bottom: 16px; display: block; }
        .divider-text { display: flex; align-items: center; gap: 16px; margin: 28px 0; font-size: 10px; letter-spacing: 3px; color: var(--ink3); text-transform: uppercase; }
        .divider-text::before, .divider-text::after { content: ''; flex: 1; height: 1px; background: var(--rule); }
        textarea { width: 100%; background: var(--bg2); border: 1px solid var(--rule); color: var(--ink); font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 16px; resize: vertical; outline: none; min-height: 140px; line-height: 1.7; transition: border-color 0.2s; }
        textarea:focus { border-color: var(--ink); }
        textarea::placeholder { color: var(--ink3); }
        .btn-primary { background: var(--ink); color: var(--bg); border: none; padding: 14px 32px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .btn-primary:hover { background: #333; }
        .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink2); border: 1px solid var(--rule); padding: 10px 24px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .btn-ghost:hover { border-color: var(--ink); color: var(--ink); }
        .btn-sample { background: transparent; color: var(--ink3); border: none; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; transition: color 0.2s; padding: 0; }
        .btn-sample:hover { color: var(--ink); }
        .cluster-row { display: grid; grid-template-columns: 64px 1fr auto; align-items: start; gap: 24px; padding: 28px 0; border-bottom: 1px solid var(--rule); cursor: pointer; transition: all 0.15s; }
        .cluster-row:hover { background: var(--bg2); margin: 0 -24px; padding: 28px 24px; }
        .cluster-num { font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 900; color: var(--rule); line-height: 1; text-align: right; }
        .cluster-score { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 900; line-height: 1; text-align: right; }
        .priority-tag { display: inline-block; font-size: 9px; letter-spacing: 2px; padding: 3px 8px; border: 1px solid currentColor; text-transform: uppercase; margin-top: 6px; }
        .quote-chip { display: inline-block; font-size: 11px; color: var(--ink2); padding: 6px 12px; background: var(--bg); border: 1px solid var(--rule); margin: 4px 4px 0 0; font-style: italic; line-height: 1.5; }
        .bar-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink3); margin-bottom: 5px; display: flex; justify-content: space-between; }
        .bar-track { height: 2px; background: var(--rule); }
        .bar-fill { height: 100%; background: var(--ink); transition: width 1s ease; }
        .spec-block { border-top: 1px solid var(--rule); padding: 28px 0; }
        .spec-block-label { font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: var(--ink3); margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
        .spec-block-label::after { content: ''; flex: 1; height: 1px; background: var(--rule); }
        .spec-item { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; line-height: 1.7; color: var(--ink2); }
        .spec-bullet { color: var(--ink3); flex-shrink: 0; margin-top: 2px; }
        .task-row { display: grid; grid-template-columns: 32px 1fr auto; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--rule); align-items: start; }
        .pull-quote { border-left: 3px solid var(--ink); padding: 12px 20px; margin: 20px 0; font-family: 'Playfair Display', serif; font-size: 16px; font-style: italic; color: var(--ink2); line-height: 1.6; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .skeleton { background: linear-gradient(90deg, var(--bg2) 25%, var(--rule) 50%, var(--bg2) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 2px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media print { .no-print{display:none !important} body{background:white !important} .nav,.ticker,.step-bar{display:none !important} .main{padding:0 !important;max-width:100% !important} .spec-block{break-inside:avoid} .task-row{break-inside:avoid} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        .error-bar { background: #fef2f2; border: 1px solid #fca5a5; padding: 12px 16px; font-size: 12px; color: #991b1b; margin-top: 20px; }
        .rule-heavy { border: none; border-top: 3px solid var(--ink); margin: 0; }
        .section-label { font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
        .product-type-badge { display: inline-block; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; border: 1px solid var(--rule); padding: 3px 10px; color: var(--ink3); margin-left: 12px; vertical-align: middle; }
        @media (max-width: 640px) { .two-col{grid-template-columns:1fr} .nav{padding:16px 20px} .main{padding:32px 16px} .big-title{font-size:3rem;letter-spacing:-2px} .cluster-row{grid-template-columns:40px 1fr auto;gap:12px} }
      `}</style>

      {/* Ticker */}
      <div className="ticker">
        <span className="ticker-inner">
          &nbsp;&nbsp;&nbsp;PM·AI — CURSOR FOR PRODUCT MANAGERS &nbsp;·&nbsp; TURN USER FEEDBACK INTO FEATURE SPECS &nbsp;·&nbsp; POWERED BY AI &nbsp;·&nbsp; FREE TO USE &nbsp;·&nbsp; YC SPRING 2026 RFS &nbsp;·&nbsp; BUILD WHAT USERS ACTUALLY WANT &nbsp;·&nbsp; PM·AI — CURSOR FOR PRODUCT MANAGERS &nbsp;·&nbsp;
        </span>
      </div>

      {/* Nav */}
      <nav className="nav">
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--ink3)" }}>YC RFS · Spring 2026</div>
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>PM·AI</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <button className="btn-ghost" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "← Back" : `History (${history.length})`}
          </button>
        </div>
      </nav>

      {/* Masthead */}
      <div className="masthead">
        <p className="tagline">Product Intelligence Platform</p>
        <h1 className="big-title">What should<br />we build?</h1>
        <p className="subtitle">Drop in raw user feedback. Get back prioritized themes with a full product spec and action plan — ready for your team or coding agent.</p>
      </div>

      {/* Step bar */}
      <div className="step-bar">
        {[{ label: "Upload Feedback", n: "01" }, { label: "AI Analysis", n: "02" }, { label: "Generate Spec", n: "03" }].map(({ label, n }, i) => {
          const done = (i === 0 && clusters.length > 0) || (i === 1 && clusters.length > 0) || (i === 2 && !!spec);
          const active = (i === 1 && stage === "analyzing") || (i === 2 && stage === "speccing") || (i === 0 && stage === "idle" && clusters.length === 0);
          return (
            <div key={i} className={`step-item${done ? " done" : active ? " active" : ""}`}>
              <div className="step-num">{done ? "✓" : n}</div>{label}
            </div>
          );
        })}
      </div>

      <div className="main">

        {/* History Panel */}
        {showHistory && (
          <div className="fade-in">
            <div style={{ marginBottom: 32 }}>
              <p className="section-label">Past analyses</p>
              <h2 className="display" style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>History</h2>
            </div>
            <hr className="rule-heavy" />
            {history.length === 0 && (
              <p style={{ color: "var(--ink3)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>No analyses yet — run your first one!</p>
            )}
            {history.map((entry) => (
              <div key={entry.id} style={{ padding: "20px 0", borderBottom: "1px solid var(--rule)", cursor: "pointer" }}
                onClick={() => { setClusters(entry.clusters); setStage("done"); setShowHistory(false); setSpec(null); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{entry.context}</p>
                    <p style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: 1 }}>{entry.clusters.length} themes · {entry.date}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 400, justifyContent: "flex-end" }}>
                    {entry.clusters.slice(0, 3).map((c) => (
                      <span key={c.id} style={{ fontSize: 10, padding: "3px 10px", border: "1px solid var(--rule)", color: "var(--ink2)", letterSpacing: 1 }}>{c.theme}</span>
                    ))}
                  </div>
                </div>
                <p style={{ marginTop: 10, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink3)" }}>Click to restore →</p>
              </div>
            ))}
          </div>
        )}

        {/* Upload */}
        {stage === "idle" && clusters.length === 0 && !showHistory && (
          <div className="fade-in">

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <button className={`mode-btn ${productMode === "software" ? "active" : "inactive"}`} onClick={() => setProductMode("software")}>
                ⌨ Software App
              </button>
              <button className={`mode-btn ${productMode === "other" ? "active" : "inactive"}`} onClick={() => setProductMode("other")}>
                ☕ Other Product
              </button>
            </div>

            {/* Demo Banner */}
            <div style={{ background: "var(--bg2)", border: "1px solid var(--rule)", borderLeft: "3px solid var(--ink)", padding: "16px 20px", marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--ink3)", marginBottom: 4 }}>Live demo</p>
                <p style={{ fontSize: 13, color: "var(--ink2)" }}>See real output using Notion app store reviews as sample data</p>
              </div>
              <button className="btn-primary" onClick={() => { setClusters(NOTION_DEMO_CLUSTERS); setStage("done"); }}>
                View Demo →
              </button>
            </div>

            <div className={`upload-zone${dragOver ? " drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById("file-input")?.click()}>
              <span className="upload-icon">↑</span>
              <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 6 }}>Drop your feedback file here</p>
              <p style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: 1 }}>CSV or TXT · click to browse</p>
              <input id="file-input" type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", color: "var(--ink3)", marginBottom: 8 }}>
                Product context <span style={{ fontWeight: 300 }}>(optional but recommended)</span>
              </p>
              <input
                type="text"
                placeholder={productMode === "software" ? "e.g. A B2B project management SaaS for engineering teams" : "e.g. A specialty coffee shop in Dubai · A running shoe brand"}
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--rule)", borderBottom: "2px solid var(--ink)", color: "var(--ink)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "12px 16px", outline: "none", letterSpacing: 0.5 }}
              />
            </div>

            <div className="divider-text">or paste directly</div>

            <textarea
              placeholder={productMode === "software" ? "Paste user feedback — app reviews, support tickets, interview notes..." : "Paste customer feedback — reviews, complaints, survey responses..."}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <button className="btn-sample" onClick={() => setFeedback(sampleData)}>→ Load sample feedback</button>
              <button className="btn-primary" onClick={() => feedback.trim() && runPipeline(feedback)} disabled={!feedback.trim()}>Analyze →</button>
            </div>
          </div>
        )}

        {/* Skeleton — Analyzing */}
        {stage === "analyzing" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
              <div>
                <div className="skeleton" style={{ width: 120, height: 10, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: 260, height: 36 }} />
              </div>
            </div>
            <hr className="rule-heavy" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 24, padding: "28px 0", borderBottom: "1px solid var(--rule)" }}>
                <div className="skeleton" style={{ width: 42, height: 42 }} />
                <div>
                  <div className="skeleton" style={{ width: "40%", height: 18, marginBottom: 10 }} />
                  <div className="skeleton" style={{ width: "80%", height: 13, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: "60%", height: 13, marginBottom: 16 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                    <div className="skeleton" style={{ height: 2 }} />
                    <div className="skeleton" style={{ height: 2 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="skeleton" style={{ width: 120, height: 28 }} />
                    <div className="skeleton" style={{ width: 100, height: 28 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="skeleton" style={{ width: 52, height: 52, marginBottom: 8, marginLeft: "auto" }} />
                  <div className="skeleton" style={{ width: 60, height: 20, marginLeft: "auto" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skeleton — Speccing */}
        {stage === "speccing" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
              <div>
                <div className="skeleton" style={{ width: 100, height: 10, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: 340, height: 32 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton" style={{ width: 90, height: 38 }} />
                <div className="skeleton" style={{ width: 90, height: 38 }} />
              </div>
            </div>
            <hr className="rule-heavy" />
            <div style={{ padding: "28px 0" }}>
              <div className="skeleton" style={{ width: 140, height: 10, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: "90%", height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: "75%", height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 20 }} />
              <div className="skeleton" style={{ width: "100%", height: 48 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {[1, 2].map((i) => (
                <div key={i} style={{ padding: "28px 0" }}>
                  <div className="skeleton" style={{ width: 120, height: 10, marginBottom: 16 }} />
                  {[1, 2, 3].map((j) => (
                    <div key={j} style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                      <div className="skeleton" style={{ width: 10, height: 10, marginTop: 4, flexShrink: 0 }} />
                      <div className="skeleton" style={{ flex: 1, height: 13 }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--rule)" }}>
                <div className="skeleton" style={{ width: 20, height: 13 }} />
                <div>
                  <div className="skeleton" style={{ width: "50%", height: 13, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: "85%", height: 12 }} />
                </div>
                <div className="skeleton" style={{ width: 30, height: 13 }} />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {stage === "done" && clusters.length > 0 && !spec && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
              <div>
                <p className="section-label">Analysis complete</p>
                <h2 className="display" style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>{clusters.length} themes identified</h2>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", border: "1px solid var(--rule)" }}>
                  <button className={`mode-btn ${productMode === "software" ? "active" : "inactive"}`} style={{ padding: "8px 16px", fontSize: 10 }} onClick={() => setProductMode("software")}>⌨ Software</button>
                  <button className={`mode-btn ${productMode === "other" ? "active" : "inactive"}`} style={{ padding: "8px 16px", fontSize: 10, borderLeft: "1px solid var(--rule)" }} onClick={() => setProductMode("other")}>☕ Other</button>
                </div>
                <button className="btn-ghost" onClick={() => { setClusters([]); setFeedback(""); setStage("idle"); }}>← New analysis</button>
              </div>
            </div>
            <hr className="rule-heavy" />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clusters.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {clusters.map((c, i) => (
                  <SortableCluster key={c.id} c={c} i={i} onSelect={generateSpec} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Spec */}
        {spec && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
              <div>
                <p className="section-label">
                  Product spec
                  {spec.product_type && <span className="product-type-badge">{spec.product_type}</span>}
                </p>
                <h2 className="display" style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, maxWidth: 600 }}>{spec.title}</h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost no-print" onClick={() => { setSpec(null); setSelectedFeature(null); }}>← Back</button>
                <button className="btn-primary" onClick={() => copyMarkdown(spec)}>Copy MD</button>
                <button className="btn-ghost" onClick={() => downloadPDF(spec, productMode)}>Print / Save PDF</button>
              </div>
            </div>
            <hr className="rule-heavy" />

            <div className="spec-block">
              <div className="spec-block-label">Problem statement</div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--ink2)" }}>{spec.problem_statement}</p>
              <div className="pull-quote">{spec.why_now}</div>
            </div>

            <div className="two-col">
              <div className="spec-block">
                <div className="spec-block-label">Success metrics</div>
                {spec.success_metrics?.map((m, i) => <div key={i} className="spec-item"><span className="spec-bullet">◆</span><span>{m}</span></div>)}
              </div>
              <div className="spec-block">
                <div className="spec-block-label">User stories</div>
                {spec.user_stories?.map((s, i) => <div key={i} className="spec-item"><span className="spec-bullet">→</span><span>{s}</span></div>)}
              </div>
            </div>

            {/* Software mode */}
            {productMode === "software" && (
              <>
                <div className="two-col">
                  <div className="spec-block">
                    <div className="spec-block-label">UI changes</div>
                    {spec.ui_changes?.map((u, i) => <div key={i} className="spec-item"><span className="spec-bullet">—</span><span>{u}</span></div>)}
                  </div>
                  <div className="spec-block">
                    <div className="spec-block-label">Data model changes</div>
                    {spec.data_model_changes?.map((d, i) => <div key={i} className="spec-item"><span className="spec-bullet">—</span><span>{d}</span></div>)}
                  </div>
                </div>
                <div className="spec-block">
                  <div className="spec-block-label">Dev tasks — paste into Cursor or Claude Code</div>
                  {spec.dev_tasks?.map((t, i) => (
                    <div key={i} className="task-row">
                      <div style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: 1, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>{t.title}</p>
                        <p style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.6 }}>{t.description}</p>
                      </div>
                      <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink3)", whiteSpace: "nowrap", paddingTop: 2 }}>~{t.estimate_hours}h</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Other product mode */}
            {productMode === "other" && (
              <>
                <div className="spec-block">
                  <div className="spec-block-label">Recommended changes</div>
                  {spec.recommended_changes?.map((r, i) => <div key={i} className="spec-item"><span className="spec-bullet">—</span><span>{r}</span></div>)}
                </div>
                <div className="spec-block">
                  <div className="spec-block-label">Action items</div>
                  {spec.action_items?.map((t, i) => (
                    <div key={i} className="task-row">
                      <div style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: 1, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>{t.title}</p>
                        <p style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.6 }}>{t.description}</p>
                      </div>
                      <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink3)", whiteSpace: "nowrap", paddingTop: 2 }}>~{t.estimate_hours}h</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className="error-bar">⚠ {error}</div>}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "3px solid var(--ink)", padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 80 }}>
        <span style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--ink3)" }}>PM·AI © 2026</span>
        <span className="display" style={{ fontSize: 20, fontWeight: 900 }}>PM·AI</span>
        <span style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--ink3)" }}>Built on YC RFS</span>
      </div>
    </div>
  );
}