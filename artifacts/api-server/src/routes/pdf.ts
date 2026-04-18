import { Router, Request, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
// pdf-parse v1 exports a CJS function; use globalThis.require which is set by the esbuild banner
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> =
  (globalThis as any).require("pdf-parse");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function getOpenAI(): OpenAI {
  let key = process.env.OPENAI_API_KEY ?? "";
  if (key.startsWith("y") && key.slice(1).startsWith("sk-")) key = key.slice(1);
  return new OpenAI({ apiKey: key });
}

function getTavilyKey(): string {
  return process.env.TAVILY_API_KEY ?? "";
}

interface Chunk {
  text: string;
  embedding: number[];
}

interface VectorStore {
  filename: string;
  chunks: Chunk[];
}

interface WebResult {
  title: string;
  url: string;
  content: string;
}

let vectorStore: VectorStore | null = null;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function splitIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapText = words.slice(-Math.floor(overlap / 6)).join(" ");
      current = overlapText + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 50);
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

async function tavilySearch(query: string): Promise<WebResult[]> {
  const apiKey = getTavilyKey();
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      console.error("Tavily search failed:", response.status, await response.text());
      return [];
    }

    const data: any = await response.json();
    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 600),
    }));
  } catch (err) {
    console.error("Tavily search error:", err);
    return [];
  }
}

router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  if (!req.file.mimetype.includes("pdf")) {
    res.status(400).json({ error: "Only PDF files are supported" });
    return;
  }

  try {
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.replace(/\s+/g, " ").trim();

    if (text.length < 50) {
      res.status(400).json({ error: "PDF appears to be empty or unreadable" });
      return;
    }

    // Fix filename encoding (multer may receive Latin-1 encoded UTF-8 bytes)
    const rawName = req.file.originalname;
    const filename = (() => {
      try { return Buffer.from(rawName, "latin1").toString("utf8"); } catch { return rawName; }
    })();

    const rawChunks = splitIntoChunks(text);
    const chunks: Chunk[] = [];

    const batchSize = 20;
    for (let i = 0; i < rawChunks.length; i += batchSize) {
      const batch = rawChunks.slice(i, i + batchSize);
      const embRes = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: batch.map(c => c.slice(0, 8000)),
      });
      for (let j = 0; j < batch.length; j++) {
        chunks.push({ text: batch[j], embedding: embRes.data[j].embedding });
      }
    }

    vectorStore = { filename, chunks };

    res.json({
      success: true,
      filename,
      chunkCount: chunks.length,
      message: `PDF indexed successfully with ${chunks.length} chunks`,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to process PDF: ${err.message}` });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  const { question, history = [], webSearch = false } = req.body;

  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  try {
    // --- PDF RAG (if indexed) ---
    let pdfContext = "";
    const sources: string[] = [];

    if (vectorStore) {
      const queryEmbedding = await getEmbedding(question);
      const scored = vectorStore.chunks
        .map(chunk => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      pdfContext = scored.map((s, i) => `[여행기 ${i + 1}] ${s.chunk.text}`).join("\n\n");
      scored.slice(0, 3).forEach(s =>
        sources.push(s.chunk.text.slice(0, 200) + (s.chunk.text.length > 200 ? "..." : ""))
      );
    }

    // --- Tavily Web Search (if requested) ---
    let webResults: WebResult[] = [];
    let webContext = "";

    if (webSearch) {
      webResults = await tavilySearch(question);
      if (webResults.length > 0) {
        webContext = webResults
          .map((r, i) => `[웹 ${i + 1}] ${r.title}\n${r.content}\n출처: ${r.url}`)
          .join("\n\n");
      }
    }

    // --- Build system prompt ---
    let systemPrompt = `당신은 친절하고 유용한 여행 챗봇입니다. 동유럽 여행 전문가로서 여행자의 질문에 자세하게 답해주세요.
질문과 같은 언어로 답변하세요 (한국어 질문 → 한국어 답변).`;

    if (pdfContext) {
      systemPrompt += `\n\n## 여행기 (개인 경험)\n${pdfContext}`;
    }
    if (webContext) {
      systemPrompt += `\n\n## 최신 인터넷 정보\n${webContext}`;
    }
    if (!pdfContext && !webContext) {
      systemPrompt += `\n\n현재 참고할 문서나 웹 정보가 없습니다. 일반 여행 지식을 바탕으로 답변해주세요.`;
    } else {
      systemPrompt += `\n\n위 정보를 종합하여 답변하되, 여행기의 개인 경험과 최신 웹 정보를 구분하여 설명해주세요.`;
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: question },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    });

    const answer = completion.choices[0].message.content ?? "";
    res.json({ answer, sources, webResults });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate answer: ${err.message}` });
  }
});

router.get("/status", (_req: Request, res: Response) => {
  if (!vectorStore) {
    res.json({ indexed: false });
  } else {
    res.json({
      indexed: true,
      filename: vectorStore.filename,
      chunkCount: vectorStore.chunks.length,
    });
  }
});

export default router;
