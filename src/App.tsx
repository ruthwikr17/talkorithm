import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from "firebase/auth";
import {
  addMessage,
  addMemory,
  listenMessages,
  listenMemories
} from "./lib/db";
import { auth } from "./lib/firebase";
import { sendMentorChat } from "./lib/gemini";
import { getMentorSystemPrompt } from "./lib/prompt";
import { startSpeechRecognition, speakText, stopSpeaking } from "./lib/speech";
import Whiteboard, { WhiteboardHandle } from "./components/Whiteboard";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type MemoryItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
};

const THREAD_ID = "main";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoSendVoice, setAutoSendVoice] = useState(true);
  const [userGesture, setUserGesture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<WhiteboardHandle | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setMemories([]);
      return;
    }
    const stopMessages = listenMessages(user.uid, THREAD_ID, setMessages);
    const stopMemories = listenMemories(user.uid, setMemories);
    return () => {
      stopMessages();
      stopMemories();
    };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  const memorySummary = useMemo(() => {
    if (!memories.length) return "No saved memory yet.";
    return memories
      .slice(0, 8)
      .map((item) => `- ${item.title}: ${item.detail}`)
      .join("\n");
  }, [memories]);

  const handleLogin = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async () => {
    setError(null);
    await signOut(auth);
  };

  const handleSendText = async (text: string, opts?: { fromVoice?: boolean }) => {
    if (!user || !text.trim() || loading) return;
    setError(null);
    const userMessage = text.trim();
    const now = Date.now();

    await addMessage(user.uid, THREAD_ID, {
      role: "user",
      content: userMessage,
      createdAt: now
    });

    if (!opts?.fromVoice) {
      setInput("");
    }

    setLoading(true);
    try {
      const drawing = boardRef.current?.getDataUrl();
      const response = await sendMentorChat({
        messages: [...messages, { id: "tmp", role: "user", content: userMessage, createdAt: now }],
        system: getMentorSystemPrompt(),
        memory: memorySummary,
        imageDataUrl: drawing ?? undefined
      });

      await addMessage(user.uid, THREAD_ID, {
        role: "assistant",
        content: response,
        createdAt: Date.now()
      });

      if (autoSpeak && userGesture) {
        if (speaking) stopSpeaking();
        setSpeaking(true);
        await speakText(response, () => setSpeaking(false));
      }
    } catch (err) {
      setError("Unable to reach the mentor right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await handleSendText(input);
  };

  const handleSpeak = async () => {
    if (listening) return;
    setError(null);
    setListening(true);
    try {
      const transcript = await startSpeechRecognition();
      if (autoSendVoice) {
        await handleSendText(transcript, { fromVoice: true });
      } else {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    } catch (err) {
      setError("Speech recognition is unavailable in this browser.");
    } finally {
      setListening(false);
    }
  };

  const handleSaveMemory = async (message: Message) => {
    if (!user) return;
    const title = message.content.slice(0, 64).replace(/\s+/g, " ").trim();
    const detail = message.content.slice(0, 220).replace(/\s+/g, " ").trim();
    await addMemory(user.uid, {
      title: title || "Saved insight",
      detail,
      createdAt: Date.now()
    });
  };

  const handleSpeakMessage = async (message: Message) => {
    if (speaking) stopSpeaking();
    setSpeaking(true);
    await speakText(message.content, () => setSpeaking(false));
  };

  return (
    <div className="app" onClickCapture={() => setUserGesture(true)}>
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Talkorithm</p>
            <h1>DSA Mentor Studio</h1>
            <p className="subtext">
              Explain your intuition. We refine it into rigorous algorithms, proofs, and alternatives.
            </p>
          </div>
          <div className="auth">
            {user ? (
              <>
                <div className="user-chip">
                  <img src={user.photoURL ?? ""} alt={user.displayName ?? "User"} />
                  <div>
                    <p>{user.displayName ?? "Student"}</p>
                    <span>{user.email ?? ""}</span>
                  </div>
                </div>
                <button className="ghost" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="primary" onClick={handleLogin}>
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        <section className="mentor-bar">
          <div className="mentor-mode">
            <h3>Professor Mode</h3>
            <p>Structured feedback, proofs, and multiple solution paths.</p>
          </div>
          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoSendVoice}
                onChange={(event) => setAutoSendVoice(event.target.checked)}
              />
              <span>Auto‑send voice</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => setAutoSpeak(event.target.checked)}
              />
              <span>Read responses aloud</span>
            </label>
            {speaking && (
              <button className="ghost" onClick={() => stopSpeaking()}>
                Stop voice
              </button>
            )}
            <button className="ghost" onClick={() => speakText("Voice ready.")}>
              Test voice
            </button>
          </div>
        </section>

        <main className="main-grid">
          <section className="panel chat">
            <div className="panel-header">
              <h2>Conversation</h2>
              <span className="pill">Interactive</span>
            </div>
            <div className="chat-scroll" ref={scrollRef}>
              {!messages.length && (
                <div className="empty">
                  <h3>Start by explaining your idea.</h3>
                  <p>
                    I’ll respond like a top‑tier DSA professor: probing questions, proofs, and
                    alternative approaches.
                  </p>
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={`bubble ${message.role}`}>
                  <div className="bubble-header">
                    <span>{message.role === "user" ? "You" : "Professor"}</span>
                    {message.role === "assistant" && (
                      <div className="bubble-actions">
                        <button className="link" onClick={() => handleSpeakMessage(message)}>
                          Play voice
                        </button>
                        <button
                          className="link"
                          onClick={() => handleSaveMemory(message)}
                          title="Save as long-term memory"
                        >
                          Save to Memory
                        </button>
                      </div>
                    )}
                  </div>
                  <p>{message.content}</p>
                </div>
              ))}
              {loading && (
                <div className="bubble assistant">
                  <div className="bubble-header">
                    <span>Professor</span>
                  </div>
                  <p>Thinking through it with you…</p>
                </div>
              )}
            </div>
            <div className="composer">
              <div className="composer-input">
                <textarea
                  placeholder="Explain your intuition, ask for hints, or try a solution…"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="actions">
                  <button className="ghost" onClick={handleSpeak} disabled={listening}>
                    {listening ? "Listening…" : "Speak"}
                  </button>
                  <button className="primary" onClick={handleSend} disabled={!user || loading}>
                    Send
                  </button>
                </div>
                {error && <p className="error">{error}</p>}
              </div>
              <div className="composer-board">
                <div className="board-header">
                  <h3>Sketchpad</h3>
                  <span className="pill ghost">Optional</span>
                </div>
                <Whiteboard ref={boardRef} />
                <p className="muted small">
                  Sketches are sent with your next message (not stored).
                </p>
              </div>
            </div>
          </section>

          <section className="panel side">
            <div className="panel-header">
              <h2>Long‑term Memory</h2>
              <span className="pill ghost">Synced</span>
            </div>
            <div className="memory-list">
              {memories.length === 0 ? (
                <p className="muted">Save key insights from the mentor to build a personal DSA guide.</p>
              ) : (
                memories.map((memory) => (
                  <div key={memory.id} className="memory-card">
                    <h3>{memory.title}</h3>
                    <p>{memory.detail}</p>
                  </div>
                ))
              )}
            </div>
            <div className="memory-footnote">
              <p>Memory is injected into each prompt for continuity.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
