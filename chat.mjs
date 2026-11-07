import { createClient } from "@supabase/supabase-js";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!apiKey) return new Response(JSON.stringify({ error: "The Gemini API key is not configured on the server." }), { status: 503, headers });
  if (!supabaseUrl || !supabaseAnonKey) return new Response(JSON.stringify({ error: "Server authentication is not configured." }), { status: 503, headers });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return new Response(JSON.stringify({ error: "Please sign in first." }), { status: 401, headers });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Your session is invalid or expired. Please sign in again." }), { status: 401, headers });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON request." }), { status: 400, headers }); }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return new Response(JSON.stringify({ error: "Message cannot be empty." }), { status: 400, headers });
  if (message.length > 12000) return new Response(JSON.stringify({ error: "Message is too long. Please keep it under 12,000 characters." }), { status: 413, headers });

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are NOVA AI, a helpful, accurate, clear and responsible AI assistant created by NOVA Tech Company. Explain complex topics step by step. Be honest about uncertainty and never invent sources." }]
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    const data = await result.json();
    if (!result.ok) {
      const message = data?.error?.message || "The AI provider rejected the request.";
      return new Response(JSON.stringify({ error: message }), { status: result.status >= 500 ? 502 : result.status, headers });
    }
    const reply = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!reply) return new Response(JSON.stringify({ error: "The AI provider returned an empty response. Please try again." }), { status: 502, headers });
    return new Response(JSON.stringify({ reply }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Could not reach the AI service. Check the server connection and try again." }), { status: 502, headers });
  }
};

export const config = { path: "/api/chat" };
