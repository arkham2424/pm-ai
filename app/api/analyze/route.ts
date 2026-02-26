import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "arcee-ai/trinity-mini:free",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();
    
    // LOG EVERYTHING so we can see what's coming back
    console.log("STATUS:", response.status);
    console.log("OPENROUTER RESPONSE:", JSON.stringify(data, null, 2));

    const text = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ text });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("CAUGHT ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}