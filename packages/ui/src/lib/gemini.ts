const GEMINI_KEY = import.meta.env["VITE_GEMINI_API_KEY"] ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

const SYSTEM_PROMPT = `Sen DACC (Digital Asset Command Center) panelinin AI asistanısın.
Kullanıcı dijital varlıklarını (web siteleri, URL'ler) yönetiyor, SEO denetimleri yapıyor
ve risk skorlarını takip ediyor. Türkçe sorulara Türkçe, İngilizce sorulara İngilizce yanıtla.
Komut örnekleri: varlık ekleme, audit başlatma, risk seviyesi yorumlama, SEO önerileri.
Kısa ve net yanıtlar ver.`;

// --- Semaphore: max 3 eşzamanlı istek ---
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSemaphore(): void {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    activeRequests--;
  }
}

// --- Exponential backoff: 429 için 1s→2s→4s→8s ---
const RETRY_DELAYS = [1000, 2000, 4000, 8000];

async function fetchWithRetry(
  url: string,
  body: object,
  onRetry?: (attempt: number, waitMs: number) => void
): Promise<Response> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status !== 429 || attempt === RETRY_DELAYS.length) return res;

    const waitMs = RETRY_DELAYS[attempt];
    onRetry?.(attempt + 1, waitMs);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("Max retry aşıldı");
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export { RETRY_DELAYS };

export async function sendToGemini(
  history: ChatMessage[],
  newMessage: string,
  onRetry?: (attempt: number, waitMs: number) => void
): Promise<string> {
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: newMessage }] },
  ];

  await acquireSemaphore();
  try {
    const res = await fetchWithRetry(
      ENDPOINT,
      {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      },
      onRetry
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${errText || res.statusText}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Yanıt alınamadı.";
  } finally {
    releaseSemaphore();
  }
}
