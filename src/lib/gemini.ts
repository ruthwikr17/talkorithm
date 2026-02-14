import type { Message } from "../App";

type MentorChatInput = {
  messages: Message[];
  system: string;
  memory: string;
  imageDataUrl?: string;
};

type MentorChatResponse = {
  text: string;
};

const GEMINI_PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;

export const sendMentorChat = async ({ messages, system, memory, imageDataUrl }: MentorChatInput) => {
  if (!GEMINI_PROXY_URL) {
    throw new Error("Missing VITE_GEMINI_PROXY_URL");
  }

  const payload = {
    system,
    memory,
    imageDataUrl,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  };

  const response = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini proxy error: ${response.status}`);
  }

  const data = (await response.json()) as MentorChatResponse;
  return data.text;
};
