import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropicModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage } = await req.json();
    if (typeof systemPrompt !== "string" || typeof userMessage !== "string") {
      return NextResponse.json(
        { error: "systemPrompt and userMessage must be strings." },
        { status: 400 },
      );
    }

    if (!anthropic) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    const response = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "Anthropic returned an empty text response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 500 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
