import { ChatMessage } from "@/lib/chat-types";
import { Languages, Sparkles, ArrowRight } from "lucide-react";

interface Props { msg: ChatMessage }

export function MessageBubble({ msg }: Props) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[85%] md:max-w-[70%] relative">
          <div
            className="bubble-tail-right rounded-2xl rounded-br-sm px-4 py-2.5 text-bubble-user-foreground font-medium"
            style={{ background: "var(--gradient-bubble-user)", boxShadow: "var(--shadow-bubble)" }}
          >
            <p className="whitespace-pre-wrap break-words text-[15px]">{msg.content}</p>
          </div>
        </div>
      </div>
    );
  }

  const conf = msg.confidence ?? 0;
  const low = conf < 0.5;

  return (
    <div className="flex justify-start mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-[90%] md:max-w-[75%] relative">
        <div
          className="bubble-tail-left bg-bubble-bot text-bubble-bot-foreground rounded-2xl rounded-bl-sm px-4 py-3 space-y-3"
          style={{ boxShadow: "var(--shadow-bubble)" }}
        >
          {/* Detection */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-mono">
              <Languages className="w-3 h-3" />
              {msg.detected_language}
            </div>
            <div
              className={`text-xs px-2 py-1 rounded-full font-mono ${
                low ? "bg-destructive/20 text-destructive" : "bg-primary/15 text-primary"
              }`}
            >
              {(conf * 100).toFixed(1)}% {low && "· Low Confidence"}
            </div>
          </div>

          {/* Top predictions */}
          {msg.top_predictions && msg.top_predictions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top predictions</p>
              <div className="space-y-1">
                {msg.top_predictions.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">{p.lang}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(p.score * 100)}%`,
                          background: i === 0 ? "var(--gradient-bubble-user)" : "hsl(var(--muted-foreground))",
                        }}
                      />
                    </div>
                    <span className="font-mono text-muted-foreground w-10 text-right">
                      {(p.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Translation */}
          {msg.translation && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> Translation · {msg.target_language}
              </p>
              <p className="text-[15px] leading-relaxed">{msg.translation}</p>
            </div>
          )}

          {/* AI reply */}
          {msg.ai_reply && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Reply
              </p>
              <p className="text-[15px] leading-relaxed">{msg.ai_reply}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
