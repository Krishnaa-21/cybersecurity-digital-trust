import React, { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Shield,
  Loader2,
  Trash2,
  ChevronDown,
  Minimize2,
  Maximize2,
  CornerDownLeft,
  Copy,
  Check,
} from "lucide-react";
import { useMode } from "../context/ModeContext";
import { apiClient } from "../api/client";

const REQUEST_TIMEOUT_MS = 30000;
const MAX_HISTORY_TURNS = 6;

const nowStamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Turn a failed chat request into a message an officer can act on. */
function describeChatError(err) {
  if (err?.name === "AbortError") {
    return "The assistant took too long to respond. Please try again — or ask a narrower question.";
  }
  const status = err?.status;
  if (status === 400 && typeof err.message === "string") return err.message;
  if (status === 404) return "The assistant service was not found on the server. Please make sure the backend is up to date.";
  if (status >= 500) return "The intelligence service hit an error. Please try again in a moment.";
  if (status === undefined) {
    return "Cannot reach the TraceX server. Check that the backend is running and your connection is working, then try again.";
  }
  return "Error retrieving intelligence response. Please try again.";
}

/** Inline **bold**, *italic* and `code` -> React nodes (no innerHTML, so evidence text can't inject markup). */
function renderInline(text, keyPrefix) {
  const nodes = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/20 font-mono text-[11px] text-cyan-300 break-all">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Minimal markdown: paragraphs, "- " bullets, numbered lines, bold/italic/code. */
function FormattedText({ text }) {
  const lines = String(text ?? "").split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={idx} className="flex gap-2 pl-1 items-start">
              <span aria-hidden="true" className="text-cyan-400 font-bold select-none">•</span>
              <span className="min-w-0 break-words flex-1">{renderInline(bullet[1], `l${idx}`)}</span>
            </div>
          );
        }
        return (
          <div key={idx} className="break-words">
            {renderInline(line, `l${idx}`)}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatWidget() {
  const { mode, isStandardMode } = useMode();
  const location = useLocation();
  const params = useParams();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: "Hello Officer. I am your TraceX Cyber Intelligence Assistant. Ask me questions regarding the active case investigation, mule accounts, APK threat signatures, or cross-case fraud analytics across the state network.",
      timestamp: nowStamp(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Extract caseId from URL if user is viewing a case
  const caseMatch = location.pathname.match(/\/cases\/(\d+)/);
  const activeCaseId = caseMatch ? parseInt(caseMatch[1], 10) : null;

  const [activeCaseNumber, setActiveCaseNumber] = useState(null);
  useEffect(() => {
    setActiveCaseNumber(null);
    if (!activeCaseId) return undefined;
    let cancelled = false;
    apiClient
      .get(`cases/${activeCaseId}`)
      .then((c) => {
        if (!cancelled) setActiveCaseNumber(c?.case_number || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeCaseId]);
  const caseLabel = activeCaseNumber ? `Case #${activeCaseNumber}` : `Case ID ${activeCaseId}`;

  // Listen for global custom event to toggle chat (e.g. from topbar button)
  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("tracex_toggle_chat", handleToggle);
    window.addEventListener("tracex_open_chat", handleOpen);
    return () => {
      window.removeEventListener("tracex_toggle_chat", handleToggle);
      window.removeEventListener("tracex_open_chat", handleOpen);
    };
  }, []);

  // Keyboard shortcut: Escape closes the drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: nowStamp(),
    };

    const history = messages
      .filter((m) => !m.isError && m.id !== "welcome" && m.id !== "cleared")
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await apiClient.post(
        "chat",
        { message: query, case_id: activeCaseId, history },
        { signal: controller.signal }
      );
      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res?.response || "No response received from intelligence engine.",
        suggested: Array.isArray(res?.suggested_actions) ? res.suggested_actions : [],
        timestamp: nowStamp(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: "bot",
        text: describeChatError(err),
        isError: true,
        timestamp: nowStamp(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      clearTimeout(timer);
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "cleared",
        sender: "bot",
        text: "Chat history cleared. How can I assist your investigation today?",
        timestamp: nowStamp(),
      },
    ]);
  };

  const copyToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const lastBotId = [...messages].reverse().find((m) => m.sender === "bot" && !m.isError)?.id;

  const quickPrompts = activeCaseId
    ? [
        "⚡ Summarize this case",
        "🎯 Identify high-risk entities",
        "🏦 Detect suspect mule accounts",
        "🔗 Check cross-case connections",
        "📜 Recommended legal freeze action",
      ]
    : [
        "📊 How many high-risk cases are open?",
        "🚨 List active investigations",
        "📈 What are the top scam trends?",
        "🛡️ State-wide Mule account summary",
      ];

  return (
    <>
      {/* ── Top-Right Corner Floating Launcher Button ── */}
      {!isOpen && (
        <div
          className={`fixed right-6 z-40 font-sans transition-all duration-300 ${
            isStandardMode ? "top-28" : "top-20"
          }`}
        >
          <button
            type="button"
            id="tracex-ai-chatbot-launcher"
            onClick={() => setIsOpen(true)}
            title="Open TraceX Cyber AI Assistant"
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-full font-semibold text-xs transition-all duration-200 cursor-pointer ${
              isStandardMode
                ? "bg-[#0B3B60] hover:bg-[#082C48] text-white border border-[#082C48] shadow-lg hover:shadow-xl"
                : "bg-[#050914]/90 hover:bg-[#0B1224] text-white border border-cyan-400/40 hover:border-cyan-300 shadow-[0_4px_24px_rgba(0,0,0,0.7),0_0_20px_rgba(0,212,255,0.25)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.8),0_0_28px_rgba(0,212,255,0.45)] backdrop-blur-xl"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="flex flex-col text-left">
              <span className="text-[11.5px] font-bold tracking-wide leading-tight bg-gradient-to-r from-cyan-200 via-white to-cyan-400 bg-clip-text text-transparent">
                TraceX Cyber AI
              </span>
              <span className="text-[9px] font-mono text-cyan-300/70 leading-none">
                {activeCaseId ? caseLabel : "Global Intelligence"}
              </span>
            </div>

            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 font-semibold">
              LIVE
            </span>
          </button>
        </div>
      )}

      {/* ── Slide-Over Drawer Window (Right-Side Window) ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] overflow-hidden font-sans">
          {/* Backdrop with blur & smooth click-outside */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 cursor-pointer"
            onClick={() => setIsOpen(false)}
            aria-label="Close Chatbot Drawer"
          />

          {/* Dedicated Slide-over Window Container */}
          <aside
            className={`fixed top-0 right-0 h-full flex flex-col z-[1000] shadow-2xl transition-all duration-300 ease-out border-l ${
              isMaximized ? "w-full sm:w-[720px] md:w-[840px]" : "w-full sm:w-[480px] md:w-[540px]"
            } ${
              isStandardMode
                ? "bg-white border-[#5F6B7A] text-[#0F172A]"
                : "bg-[#050914]/98 border-cyan-500/30 text-[#E2E8F0] backdrop-blur-2xl"
            }`}
            style={{
              boxShadow: isStandardMode
                ? "-4px 0 24px rgba(0,0,0,0.25)"
                : "-16px 0 60px rgba(0,0,0,0.9), -2px 0 25px rgba(0,212,255,0.20)",
            }}
          >
            {/* Window Header */}
            <div
              className={`px-5 py-3.5 flex items-center justify-between border-b select-none ${
                isStandardMode
                  ? "bg-[#0B3B60] text-white border-[#082C48]"
                  : "bg-gradient-to-r from-[#003859]/90 via-[#0B142E]/95 to-[#2E0F6B]/90 text-white border-cyan-500/30"
              }`}
            >
              {/* Left: Intelligence Title & Context */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    isStandardMode
                      ? "bg-white text-[#0B3B60]"
                      : "bg-gradient-to-br from-cyan-400/25 to-blue-600/30 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,212,255,0.35)]"
                  }`}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold tracking-wide truncate">
                      TraceX Cyber Intelligence Assistant
                    </h2>
                    <span className="flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded font-mono font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-cyan-200/80 truncate">
                    <span className="font-mono font-medium text-cyan-300">
                      {activeCaseId ? `Active Context: ${caseLabel}` : "Global Threat Intelligence Network"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Window Controls (Clear, Maximize/Restore, Close) */}
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear Conversation Thread"
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[10px] font-mono">Clear</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? "Restore Standard Width" : "Expand Window Width"}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close Window (Escape)"
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-4 h-4 text-white" />
                  <span className="text-[9px] font-mono opacity-60 hidden sm:inline">ESC</span>
                </button>
              </div>
            </div>

            {/* Quick Action Prompt Chips */}
            <div
              className={`px-4 py-2.5 border-b overflow-x-auto flex items-center gap-2 scrollbar-none whitespace-nowrap text-[11px] ${
                isStandardMode ? "bg-[#F8FAFC] border-[#E2E8F0]" : "bg-[#070D1E]/90 border-cyan-500/15"
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/70 flex-shrink-0 flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Suggested:
              </span>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 cursor-pointer flex-shrink-0 ${
                    isStandardMode
                      ? "bg-white border-[#CBD5E1] text-[#0B3B60] hover:bg-[#EEF2F6] hover:border-[#0B3B60] shadow-xs"
                      : "bg-cyan-500/10 border-cyan-500/25 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-white shadow-xs"
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Message Feed / Chat Thread */}
            <div
              className={`flex-1 p-5 space-y-4 overflow-y-auto text-[13px] leading-relaxed ${
                isStandardMode ? "bg-[#F4F6F9]" : "bg-transparent"
              }`}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.sender === "bot" && (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
                        isStandardMode
                          ? "bg-[#0B3B60] text-white"
                          : "bg-gradient-to-br from-cyan-400/20 to-blue-600/30 text-cyan-400 border border-cyan-500/30"
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl p-3.5 shadow-md relative group ${
                      m.sender === "user"
                        ? isStandardMode
                          ? "bg-[#0B3B60] text-white rounded-tr-none"
                          : "bg-gradient-to-r from-[#007FA8] to-[#005280] text-white rounded-tr-none border border-cyan-400/30 shadow-[0_2px_12px_rgba(0,127,168,0.25)]"
                        : isStandardMode
                        ? "bg-white border border-[#CBD5E1] text-[#0F172A] rounded-tl-none"
                        : "bg-[#0B1328]/95 border border-cyan-500/25 text-[#E2E8F0] rounded-tl-none shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                    }`}
                  >
                    {m.sender === "bot" ? (
                      <FormattedText text={m.text} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    )}

                    {/* Metadata & Timestamp Row */}
                    <div className="flex items-center justify-between gap-4 mt-2 pt-1 border-t border-white/10 text-[10px] font-mono">
                      <span className={m.sender === "user" ? "text-white/60" : "text-cyan-400/60"}>
                        {m.sender === "user" ? "Officer" : "TraceX Intelligence Model"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={m.sender === "user" ? "text-white/70" : "text-slate-400"}>
                          {m.timestamp}
                        </span>
                        {m.sender === "bot" && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.id, m.text)}
                            title="Copy intelligence message"
                            className="text-slate-400 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer"
                          >
                            {copiedMessageId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Follow-up suggestions from the assistant */}
                    {m.sender === "bot" && m.id === lastBotId && !isLoading && m.suggested?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-cyan-500/20">
                        <span className="text-[10px] font-mono text-cyan-300 w-full mb-0.5">
                          Next Recommended Actions:
                        </span>
                        {m.suggested.map((sg) => (
                          <button
                            key={sg}
                            type="button"
                            onClick={() => handleSendMessage(sg)}
                            className={`px-2.5 py-1 rounded-full border text-[11px] text-left transition-colors cursor-pointer ${
                              isStandardMode
                                ? "bg-white border-[#CBD5E1] text-[#0B3B60] hover:bg-[#EEF2F6] hover:border-[#0B3B60]"
                                : "bg-cyan-500/10 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400"
                            }`}
                          >
                            {sg}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {m.sender === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Real-time Analysis Indicator */}
              {isLoading && (
                <div className="flex gap-3 items-center">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isStandardMode
                        ? "bg-[#0B3B60] text-white"
                        : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                  <div
                    className={`px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      isStandardMode
                        ? "bg-white border border-[#CBD5E1] text-[#0B3B60] shadow-sm"
                        : "bg-[#0B1328]/95 border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(0,212,255,0.15)]"
                    }`}
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Analyzing intelligence databases, Mule graphs & telecom records...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input & Command Bar Footer */}
            <div
              className={`p-4 border-t ${
                isStandardMode ? "bg-white border-[#CBD5E1]" : "bg-[#030712] border-cyan-500/25"
              }`}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2.5"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    placeholder={
                      activeCaseId
                        ? `Ask TraceX AI about ${caseLabel}...`
                        : "Ask about high-risk entities, scam clusters, or legal notices..."
                    }
                    className={`w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border outline-none transition-all duration-200 ${
                      isStandardMode
                        ? "bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] focus:border-[#0B3B60] focus:bg-white shadow-inner"
                        : "bg-[#080E21] border-cyan-500/25 text-white placeholder-slate-500 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,212,255,0.25)] shadow-inner"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 hidden sm:block pointer-events-none">
                    ↵ Enter
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                    isStandardMode
                      ? "bg-[#0B3B60] text-white hover:bg-[#082C48] shadow-md"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_16px_rgba(0,212,255,0.35)] hover:shadow-[0_0_24px_rgba(0,212,255,0.55)] hover:scale-105 active:scale-95"
                  }`}
                  title="Send Question"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
                <span>Intelligence engine v2.4 • End-to-end encrypted</span>
                <span className="hidden sm:inline">Press Esc to close window</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
