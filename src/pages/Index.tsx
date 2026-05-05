import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessage, rowToMessage } from "@/lib/chat-types";
import { TARGET_LANGUAGES } from "@/lib/languages";
import { MessageBubble } from "@/components/MessageBubble";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LogOut, Send, Languages, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string>("English");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) { toast.error(error.message); return; }
      setMessages((data || []).map(rowToMessage));
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !user) return;
    setInput("");
    setBusy(true);

    const tempUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUser]);

    try {
      // Persist user message
      const { data: insUser, error: insErr } = await supabase
        .from("messages")
        .insert({ user_id: user.id, role: "user", content: text, target_language: target })
        .select().single();
      if (insErr) throw insErr;
      setMessages((m) => m.map((x) => (x.id === tempUser.id ? rowToMessage(insUser) : x)));

      // Call edge function
      const { data, error } = await supabase.functions.invoke("predict", {
        body: { text, target_language: target },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const r = data as any;
      const { data: insBot, error: botErr } = await supabase
        .from("messages")
        .insert({
          user_id: user.id,
          role: "assistant",
          content: text,
          detected_language: r.language,
          confidence: r.confidence,
          top_predictions: r.top_predictions,
          translation: r.translation,
          target_language: target,
          ai_reply: r.ai_reply,
        })
        .select().single();
      if (botErr) throw botErr;
      setMessages((m) => [...m, rowToMessage(insBot)]);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const clearChat = async () => {
    if (!user || messages.length === 0) return;
    if (!confirm("Clear chat history?")) return;
    const { error } = await supabase.from("messages").delete().eq("user_id", user.id);
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("Chat cleared");
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="glass sticky top-0 z-10 border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: "var(--gradient-bubble-user)" }}>
            <Languages className="w-5 h-5 text-bubble-user-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-bold leading-tight">Polyglot</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Detect · Translate · Reply
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={clearChat} title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => supabase.auth.signOut()} title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="inline-block p-4 rounded-2xl mb-4" style={{ background: "var(--gradient-hero)" }}>
                <Languages className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2">Type in any language</h2>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                I'll detect the language with confidence scores, translate to your target,
                and reply naturally. Try Hindi, Hinglish, Tamil, French — anything.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {["Mera naam Rahul hai", "Bonjour mon ami", "வணக்கம் நண்பரே", "Hello world"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition font-mono"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}

          {busy && (
            <div className="flex justify-start mb-3">
              <div className="bg-bubble-bot rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="glass border-t border-border/40 sticky bottom-0">
        <div className="max-w-4xl mx-auto px-3 md:px-6 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Translate to</span>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TARGET_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type or speak in any language..."
              rows={1}
              className="resize-none min-h-[44px] max-h-32 bg-input/60"
              disabled={busy}
            />
            <VoiceInputButton onTranscript={(t) => setInput((p) => (p ? p + " " : "") + t)} disabled={busy} />
            <Button
              onClick={send}
              disabled={busy || !input.trim()}
              size="icon"
              className="h-11 w-11"
              style={{ background: "var(--gradient-bubble-user)", color: "hsl(var(--bubble-user-foreground))" }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
