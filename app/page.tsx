"use client";

import { useState, useCallback } from "react";

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

const SYSTEM_PROMPT_SPEC = `You are a senior product manager and tech lead.

Return a JSON object with:
- title: string
- problem_statement: string
- why_now: string
- success_metrics: string[]
- user_stories: string[]
- ui_changes: string[]
- data_model_changes: string[]
- dev_tasks: {id: string, title: string, description: string, estimate_hours: number}[]

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

interface DevTask {
  id: string;
  title: string;
  description: string;
  estimate_hours: number;
}

interface Spec {
  title: string;
  problem_statement: string;
  why_now: string;
  success_metrics: string[];
  user_stories: string[];
  ui_changes: string[];
  data_model_changes: string[];
  dev_tasks: DevTask[];
}

const callClaude = async (systemPrompt: string, userMessage: string) => {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userMessage }),
  });
  const { text } = await res.json();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

const priorityColor = (score: number) => {
  if (score >= 7) return "#ef4444";
  if (score >= 5) return "#f97316";
  return "#22c55e";
};

const priorityLabel = (score: number) => {
  if (score >= 7) return "Critical";
  if (score >= 5) return "High";
  return "Medium";
};

export default function App() {
  const [stage, setStage] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<Cluster | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const runPipeline = async (text: string) => {
    setError(null);
    setClusters([]);
    setSpec(null);
    try {
      setStage("analyzing");
      const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 10);
      const feedbackBlock = lines.slice(0, 60).join("\n");
      const result: Cluster[] = await callClaude(
        SYSTEM_PROMPT_ANALYZE,
        `Here is user feedback:\n\n${feedbackBlock}\n\nIdentify 4-6 key themes.`
      );
      const sorted = result.sort((a, b) => b.priority_score - a.priority_score);
      setClusters(sorted);
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
      const result: Spec = await callClaude(
        SYSTEM_PROMPT_SPEC,
        `Generate a full product spec for:\n\nTheme: ${feature.theme}\nProblem: ${feature.problem}\nQuotes: ${feature.quotes.join(" | ")}\nPriority: ${feature.priority_score}`
      );
      setSpec(result);
      setStage("done");
    } catch (e: unknown) {
      setError("Spec failed: " + (e instanceof Error ? e.message : String(e)));
      setStage("done");
    }
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFeedback(text);
      runPipeline(text);
    };
    reader.readAsText(file);
  }, []);

  const sampleData = `The onboarding took way too long, I nearly gave up
Can't figure out how to invite my team members
Search is completely broken, can't find anything
Love the product but the mobile app crashes constantly
Wish there was a dark mode option
The dashboard is too cluttered, hard to find what I need
Notifications are overwhelming, I turn them all off
Team collaboration features are missing
Can't export my data to CSV
The loading speed is very slow on large datasets
I need better filtering options in the reports
Would love Slack integration
Mobile experience is terrible compared to desktop
Inviting teammates is confusing
Search doesn't find recent items
App crashes when uploading large files
Need bulk actions for managing items
The pricing page is confusing
Onboarding emails are too frequent
Wish I could customize my dashboard layout`;

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", background: "#0a0a0f", minHeight: "100vh", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; transition: all 0.2s; cursor: pointer; position: relative; overflow: hidden; }
        .card:hover { border-color: #4f46e5; transform: translateY(-2px); }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,#4f46e5,#7c3aed); opacity: 0; transition: opacity 0.2s; }
        .card:hover::before, .card.selected::before { opacity: 1; }
        .card.selected { border-color: #4f46e5; background: #13131f; }
        .btn { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; transition: all 0.2s; }
        .btn:hover { background: #4338ca; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .btn-ghost { background: transparent; border: 1px solid #2a2a3e; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.2s; }
        .btn-ghost:hover { border-color: #4f46e5; color: #e2e8f0; }
        .drop-zone { border: 2px dashed #2a2a3e; border-radius: 16px; padding: 60px 40px; text-align: center; transition: all 0.2s; cursor: pointer; background: #0d0d16; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: #4f46e5; background: #111120; }
        .spec-section { background: #0d0d16; border: 1px solid #1e1e2e; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .spec-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #4f46e5; margin-bottom: 10px; font-weight: 500; }
        .task-item { background: #111118; border: 1px solid #1e1e2e; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 12px; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .bar-bg { background: #1e1e2e; border-radius: 4px; height: 4px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; }
        textarea { width: 100%; background: #0d0d16; border: 1px solid #1e1e2e; border-radius: 8px; color: #e2e8f0; font-family: inherit; font-size: 13px; padding: 12px; resize: vertical; outline: none; min-height: 120px; transition: border-color 0.2s; }
        textarea:focus { border-color: #4f46e5; }
        @keyframes slide { from{transform:translateX(-100%)}to{transform:translateX(300%)} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e2e", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-2px", background: "linear-gradient(135deg,#fff,#94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>PM·AI</h1>
          <p style={{ color: "#64748b", fontSize: "11px", letterSpacing: "2px", marginTop: "4px" }}>CURSOR FOR PRODUCT MANAGERS</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", border: "1px solid #22c55e33", background: "#22c55e11", color: "#22c55e" }}>● FREE TIER</span>
          {stage !== "idle" && stage !== "done" && (
            <span className="pulse" style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", border: "1px solid #f9731622", background: "#f9731611", color: "#f97316" }}>
              ◌ {stage.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px" }}>

        {/* Steps */}
        <div style={{ display: "flex", marginBottom: "40px" }}>
          {["Upload Feedback", "AI Analysis", "Generate Spec"].map((label, i) => {
            const done = (i === 0 && clusters.length > 0) || (i === 1 && clusters.length > 0) || (i === 2 && !!spec);
            const active = (i === 1 && stage === "analyzing") || (i === 2 && stage === "speccing");
            return (
              <div key={i} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? "#4f46e5" : active ? "#7c3aed" : "#1e1e2e", border: active ? "2px solid #7c3aed" : "1px solid #2a2a3e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: done || active ? "white" : "#475569", transition: "all 0.3s" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: done ? "#94a3b8" : "#475569", marginTop: 6, letterSpacing: "0.5px" }}>{label}</span>
                </div>
                {i < 2 && <div style={{ height: 1, flex: 0.5, background: "#1e1e2e", marginBottom: 18 }} />}
              </div>
            );
          })}
        </div>

        {/* Upload */}
        {stage === "idle" && clusters.length === 0 && (
          <div className="fade-in">
            <div
              className={`drop-zone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 16 }}>⬆</div>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>Drop your feedback CSV or TXT file here</p>
              <p style={{ color: "#475569", fontSize: 12 }}>or click to browse</p>
              <input id="file-input" type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            <div style={{ textAlign: "center", margin: "20px 0", color: "#334155", fontSize: 12 }}>── OR PASTE DIRECTLY ──</div>

            <textarea placeholder="Paste user feedback here... (interview notes, survey responses, app reviews, support tickets)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
              <button className="btn-ghost" onClick={() => { setFeedback(sampleData); }}>Load sample feedback</button>
              <button className="btn" onClick={() => feedback.trim() && runPipeline(feedback)} disabled={!feedback.trim()}>
                Analyze Feedback →
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {(stage === "analyzing" || stage === "speccing") && (
          <div className="fade-in" style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 24 }} className="pulse">{stage === "speccing" ? "📋" : "🔍"}</div>
            <p style={{ fontSize: 16, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>
              {stage === "analyzing" ? "Identifying themes & priorities..." : "Generating feature spec..."}
            </p>
            <p style={{ color: "#475569", fontSize: 13 }}>Claude Haiku is analyzing your data</p>
            <div style={{ width: 200, margin: "24px auto", background: "#1e1e2e", borderRadius: 4, height: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#4f46e5,#7c3aed)", borderRadius: 4, animation: "slide 1.5s ease infinite" }} />
            </div>
          </div>
        )}

        {/* Results */}
        {stage === "done" && clusters.length > 0 && !spec && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, marginBottom: 4 }}>{clusters.length} Themes Found</h2>
                <p style={{ color: "#64748b", fontSize: 12 }}>Ranked by priority. Click any theme to generate a full spec.</p>
              </div>
              <button className="btn-ghost" onClick={() => { setClusters([]); setFeedback(""); setStage("idle"); }}>← New Analysis</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {clusters.map((c, i) => (
                <div key={c.id} className={`card${selectedFeature?.id === c.id ? " selected" : ""}`} onClick={() => generateSpec(c)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, color: "#2a2a3e", fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{c.theme}</h3>
                        <p style={{ color: "#64748b", fontSize: 12 }}>{c.problem}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: 22, fontFamily: "'Syne',sans-serif", fontWeight: 800, color: priorityColor(c.priority_score) }}>{c.priority_score}</div>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, border: `1px solid ${priorityColor(c.priority_score)}33`, background: `${priorityColor(c.priority_score)}11`, color: priorityColor(c.priority_score) }}>{priorityLabel(c.priority_score)}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div>
                      <p style={{ color: "#475569", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>FREQUENCY</p>
                      <div className="bar-bg"><div className="bar-fill" style={{ width: `${c.frequency * 10}%`, background: "#4f46e5" }} /></div>
                    </div>
                    <div>
                      <p style={{ color: "#475569", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>SEVERITY</p>
                      <div className="bar-bg"><div className="bar-fill" style={{ width: `${c.severity * 10}%`, background: "#7c3aed" }} /></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.quotes?.slice(0, 2).map((q, qi) => (
                      <span key={qi} style={{ background: "#1e1e2e", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>"{q}"</span>
                    ))}
                  </div>
                  <p style={{ marginTop: 12, fontSize: 11, color: "#4f46e5" }}>Click to generate full spec + dev tasks →</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spec */}
        {spec && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, marginBottom: 4 }}>{spec.title}</h2>
                <p style={{ color: "#64748b", fontSize: 12 }}>Full product spec — ready for Cursor or Claude Code</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => { setSpec(null); setSelectedFeature(null); }}>← Back</button>
                <button className="btn" onClick={() => {
                  const md = `# ${spec.title}\n\n## Problem\n${spec.problem_statement}\n\n## Why Now\n${spec.why_now}\n\n## Success Metrics\n${spec.success_metrics?.map((m) => `- ${m}`).join("\n")}\n\n## User Stories\n${spec.user_stories?.map((s) => `- ${s}`).join("\n")}\n\n## UI Changes\n${spec.ui_changes?.map((u) => `- ${u}`).join("\n")}\n\n## Data Model\n${spec.data_model_changes?.map((d) => `- ${d}`).join("\n")}\n\n## Dev Tasks\n${spec.dev_tasks?.map((t, i) => `### ${i + 1}. ${t.title}\n${t.description}\n⏱ ${t.estimate_hours}h`).join("\n\n")}`;
                  navigator.clipboard.writeText(md);
                }}>Copy as Markdown</button>
              </div>
            </div>

            <div className="spec-section">
              <p className="spec-label">Problem Statement</p>
              <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6 }}>{spec.problem_statement}</p>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#111118", borderRadius: 8, borderLeft: "3px solid #4f46e5" }}>
                <p style={{ color: "#94a3b8", fontSize: 12 }}><strong style={{ color: "#4f46e5" }}>Why now:</strong> {spec.why_now}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="spec-section">
                <p className="spec-label">Success Metrics</p>
                {spec.success_metrics?.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <span style={{ color: "#22c55e" }}>◆</span>
                    <p style={{ color: "#cbd5e1", fontSize: 13 }}>{m}</p>
                  </div>
                ))}
              </div>
              <div className="spec-section">
                <p className="spec-label">User Stories</p>
                {spec.user_stories?.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, lineHeight: 1.5, padding: 8, background: "#111118", borderRadius: 6 }}>{s}</div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="spec-section">
                <p className="spec-label">UI Changes</p>
                {spec.ui_changes?.map((u, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#7c3aed" }}>→</span>
                    <p style={{ color: "#cbd5e1", fontSize: 13 }}>{u}</p>
                  </div>
                ))}
              </div>
              <div className="spec-section">
                <p className="spec-label">Data Model Changes</p>
                {spec.data_model_changes?.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#f97316" }}>⬡</span>
                    <p style={{ color: "#cbd5e1", fontSize: 13 }}>{d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="spec-section">
              <p className="spec-label">Dev Tasks — Paste into Cursor or Claude Code</p>
              {spec.dev_tasks?.map((t, i) => (
                <div key={i} className="task-item">
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "#1e1e2e", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</p>
                      <span style={{ fontSize: 11, color: "#475569", background: "#1e1e2e", padding: "2px 8px", borderRadius: 4 }}>~{t.estimate_hours}h</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{t.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, color: "#fca5a5", fontSize: 13, marginTop: 16 }}>
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}