import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props { onTranscript: (text: string) => void; disabled?: boolean }

// Browser SpeechRecognition wrapper
export function VoiceInputButton({ onTranscript, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    return () => { try { recRef.current?.stop(); } catch {} };
  }, []);

  const start = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) onTranscript(text);
    };
    rec.onerror = (e: any) => { toast.error(`Mic error: ${e.error || "unknown"}`); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };

  return (
    <Button
      type="button"
      size="icon"
      variant={listening ? "default" : "secondary"}
      onClick={listening ? stop : start}
      disabled={disabled}
      title={listening ? "Stop" : "Voice input"}
      className={listening ? "animate-pulse" : ""}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}
