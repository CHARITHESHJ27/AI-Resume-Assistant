import { NextRequest, NextResponse } from "next/server";

// BACKEND_URL is set via environment variable only — never from user input (CWE-918)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Validate at module load that BACKEND_URL is a safe internal URL
const _parsed = new URL(BACKEND_URL);
if (!["http:", "https:"].includes(_parsed.protocol)) {
  throw new Error(`Invalid BACKEND_URL protocol: ${_parsed.protocol}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate body has messages array before forwarding
    if (!body?.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const backendRes = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: `Backend error: ${backendRes.status}` },
        { status: backendRes.status }
      );
    }

    return new NextResponse(backendRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal error" }, // generic — no internal details to client
      { status: 500 }
    );
  }
}
