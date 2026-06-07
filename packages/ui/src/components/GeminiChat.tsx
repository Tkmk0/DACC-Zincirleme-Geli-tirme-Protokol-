import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { apiFetch } from "../lib/api.js";
import { cn } from "../lib/cn.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function GeminiChat() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async () => {
    const userMsg = input.trim();
    if (!userMsg || loading) return;
    setInput("");
    setError(null);
    const nextHistory: ChatMessage[] = [...history, { role: "user", content: userMsg }];
    setHistory(nextHistory);
    setLoading(true);
    try {
      const { reply } = await apiFetch<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: nextHistory }),
      });
      setHistory([...nextHistory, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <Card className="w-96 shadow-2xl flex flex-col" style={{ height: "480px" }}>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-semibold">DACC AI Asistan</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {history.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">
                Merhaba! DACC hakkında soru sorabilir veya komut verebilirsin.
              </p>
            )}

            {history.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}

            {error !== null && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <div ref={bottomRef} />
          </CardContent>

          <div className="px-4 pb-4 pt-2 border-t flex gap-2">
            <Input
              placeholder="Bir şey sor veya komut ver…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button size="sm" onClick={() => void send()} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Button
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 p-0"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}
