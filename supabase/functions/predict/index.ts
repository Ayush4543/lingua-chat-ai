// Edge function: language detection + translation + AI reply
// Uses Lovable AI Gateway (Gemini) with structured tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Hinglish keyword boosting list
const HINGLISH_KEYWORDS = [
  "mera","meri","tum","tera","teri","hai","hain","nahi","nahin","kya","kyu","kyun",
  "kaise","kaisa","kab","kahan","matlab","yaar","bhai","bhi","aur","main","mujhe",
  "tumhe","acha","accha","theek","thik","bahut","bohot","bhot","kar","karo","karna",
  "raha","rahi","rahe","liye","sab","kuch","kuchh","abhi","wala","wali","kal","aaj",
];

function preprocess(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectHinglishBoost(text: string): number {
  const tokens = preprocess(text).split(/[^a-z]+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (HINGLISH_KEYWORDS.includes(t)) hits++;
  // ratio of keyword hits to total roman tokens
  return hits / tokens.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, target_language } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 2000) {
      return new Response(JSON.stringify({ error: "text too long (max 2000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const target = (typeof target_language === "string" && target_language) || "English";
    const cleaned = preprocess(text);
    const hinglishBoost = detectHinglishBoost(text);

    const systemPrompt = `You are a precise multilingual NLP engine. For the given user text:
1. Detect the language. Support all major world languages and Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Odia, Assamese, Nepali) and code-mixed "Hinglish" (Hindi written in Latin script mixed with English).
2. If the text is Hindi written in Latin script with words like "mera, tum, hai, nahi, kya, kaise, bhai, yaar", classify it as "Hinglish".
3. Return top 3 candidate languages with probability scores in [0,1] summing close to 1.
4. Translate the original text into "${target}". If already in ${target}, return it unchanged.
5. Generate a short, friendly conversational AI reply in ${target} (max 2 sentences) responding to the user's text.
Confidence must reflect true certainty. If unsure, return < 0.5.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Hinglish keyword ratio (hint): ${hinglishBoost.toFixed(2)}\n\nText: """${text}"""` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_analysis",
            description: "Return language detection, translation, and AI reply.",
            parameters: {
              type: "object",
              properties: {
                language: { type: "string", description: "Detected language name" },
                confidence: { type: "number" },
                top_predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lang: { type: "string" },
                      score: { type: "number" },
                    },
                    required: ["lang", "score"],
                    additionalProperties: false,
                  },
                },
                translation: { type: "string" },
                ai_reply: { type: "string" },
              },
              required: ["language", "confidence", "top_predictions", "translation", "ai_reply"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_analysis" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call in AI response");
    const args = JSON.parse(call.function.arguments);

    // Apply Hinglish boost: if model detected Hindi/English but boost is high, prefer Hinglish
    let language = args.language;
    let confidence = Number(args.confidence) || 0;
    const top = (args.top_predictions || []).slice(0, 3);

    if (hinglishBoost >= 0.25 && /^(hindi|english)$/i.test(language)) {
      language = "Hinglish";
      confidence = Math.min(1, Math.max(confidence, 0.6 + hinglishBoost * 0.3));
    }

    const result = {
      language,
      confidence: Number(confidence.toFixed(3)),
      confidence_label: confidence < 0.5 ? "Low Confidence" : "High Confidence",
      top_predictions: top,
      translation: args.translation,
      ai_reply: args.ai_reply,
      preprocessed: cleaned,
      hinglish_boost: Number(hinglishBoost.toFixed(3)),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
