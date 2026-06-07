const GEMINI_KEY = import.meta.env["VITE_GEMINI_API_KEY"] ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

const SYSTEM_PROMPT = `Sen DACC (Digital Asset Command Center) panelinin AI asistanısın.
Kullanıcı dijital varlıklarını (web siteleri, URL'ler) yönetiyor, SEO denetimleri yapıyor
ve risk skorlarını takip ediyor. Türkçe sorulara Türkçe, İngilizce sorulara İngilizce yanıtla.
Komut örnekleri: varlık ekleme, audit başlatma, risk seviyesi yorumlama, SEO önerileri.
Kısa ve net yanıtlar ver.`;

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function sendToGemini(history: ChatMessage[], newMessage: string): Promise<string> {
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: newMessage }] },
  ];

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errText || res.statusText}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Yanıt alınamadı.";
}
