export interface Env {
  GEMINI_API_KEY: string;
}

type RequestPayload = {
  system: string;
  memory: string;
  imageDataUrl?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload = (await request.json()) as RequestPayload;

    if (!env.GEMINI_API_KEY) {
      return new Response("Missing GEMINI_API_KEY", { status: 500 });
    }

    const systemInstruction = `${payload.system}\n\nLong-term memory:\n${payload.memory}`;

    const contents = payload.messages.map((message, index) => {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { text: message.content }
      ];

      const isLastUser = index === payload.messages.length - 1 && message.role === "user";
      if (isLastUser && payload.imageDataUrl) {
        const data = payload.imageDataUrl.split(",")[1];
        if (data) {
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data
            }
          });
        }
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts
      };
    });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(errText, { status: geminiResponse.status });
    }

    const data = (await geminiResponse.json()) as any;
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request)
      }
    });
  }
};

const corsHeaders = (request: Request) => {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
};
