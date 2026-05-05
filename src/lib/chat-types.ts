import { Json } from "@/integrations/supabase/types";

export interface Prediction { lang: string; score: number }

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  detected_language?: string | null;
  confidence?: number | null;
  top_predictions?: Prediction[] | null;
  translation?: string | null;
  target_language?: string | null;
  ai_reply?: string | null;
  created_at: string;
}

export function rowToMessage(r: any): ChatMessage {
  return {
    id: r.id,
    role: r.role,
    content: r.content,
    detected_language: r.detected_language,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    top_predictions: (r.top_predictions as unknown as Prediction[] | null) ?? null,
    translation: r.translation,
    target_language: r.target_language,
    ai_reply: r.ai_reply,
    created_at: r.created_at,
  };
}
