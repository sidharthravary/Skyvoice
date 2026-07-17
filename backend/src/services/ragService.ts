import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { KnowledgeBase } from '../models/knowledgeBase.model';

// ── Embedding providers (priority: OpenAI → Gemini → deterministic mock) ──────

const openaiApiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;
if (
  openaiApiKey &&
  !openaiApiKey.includes('your-openai-api-key') &&
  !openaiApiKey.includes('placeholder')
) {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

let geminiEmbedder: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;
{
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your-gemini') && !geminiKey.includes('placeholder')) {
    try {
      geminiEmbedder = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      });
    } catch (err) {
      console.warn('[RAG] Gemini embedder init failed:', err);
    }
  }
}

export type EmbeddingProvider = 'openai' | 'gemini' | 'mock';

export function embeddingProviderInfo(): { provider: EmbeddingProvider } {
  if (openai) return { provider: 'openai' };
  if (geminiEmbedder) return { provider: 'gemini' };
  return { provider: 'mock' };
}

// Embedding dimensionality varies by provider/model — probe once with a real call.
let probedDims: number | null = null;
async function getEmbeddingDims(): Promise<number> {
  if (probedDims === null) {
    probedDims = (await generateEmbedding('dimension probe')).length;
  }
  return probedDims;
}

// Simple text chunker
export function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

// Generate embedding (OpenAI → Gemini → deterministic mock for offline dev)
export async function generateEmbedding(text: string): Promise<number[]> {
  if (openai) {
    try {
      const response = await openai.embeddings.create({
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('[RAG] OpenAI embedding failed, trying Gemini:', error);
    }
  }

  if (geminiEmbedder) {
    try {
      const result = await geminiEmbedder.embedContent(text.slice(0, 9000));
      const values = result.embedding?.values;
      if (Array.isArray(values) && values.length > 0) return values;
    } catch (error) {
      console.error('[RAG] Gemini embedding failed, falling back to mock:', error);
    }
  }

  // Fallback: stable deterministic pseudo-random embedding vector for localhost testing
  const vector: number[] = new Array(1536).fill(0);
  for (let i = 0; i < 1536; i++) {
    let hash = 0;
    const key = text + i;
    for (let j = 0; j < key.length; j++) {
      hash = (hash << 5) - hash + key.charCodeAt(j);
      hash |= 0;
    }
    vector[i] = (hash % 1000) / 1000.0;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(v => v / (magnitude || 1));
}

// ── Atlas Vector Search index (best-effort, created once at first use) ────────

// Index name is suffixed with the dimensionality so switching embedding
// providers can't leave a mismatched index silently breaking $vectorSearch.
let vectorIndexName: string | null = null;
let vectorIndexEnsured = false;
let vectorIndexAvailable = false;

export async function ensureVectorIndex(): Promise<string | null> {
  if (vectorIndexEnsured) return vectorIndexAvailable ? vectorIndexName : null;
  vectorIndexEnsured = true;

  const { provider } = embeddingProviderInfo();
  if (provider === 'mock') return null; // meaningless without real embeddings

  try {
    const dims = await getEmbeddingDims();
    vectorIndexName = `knowledge_vector_${dims}`;

    const collection = KnowledgeBase.collection;
    const existing = await collection.listSearchIndexes().toArray().catch(() => []);
    if (existing.some((idx: { name?: string }) => idx.name === vectorIndexName)) {
      vectorIndexAvailable = true;
      return vectorIndexName;
    }

    await collection.createSearchIndex({
      name: vectorIndexName,
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: dims, similarity: 'cosine' },
        ],
      },
    });
    console.log(`[RAG] ✅ Created Atlas vector index "${vectorIndexName}" (${dims} dims, ${provider})`);
    vectorIndexAvailable = true;
    return vectorIndexName;
  } catch (err) {
    console.warn(
      '[RAG] Atlas vector index unavailable (falling back to in-memory cosine):',
      (err as Error)?.message ?? err
    );
    vectorIndexAvailable = false;
    return null;
  }
}

// ── Semantic search helpers ────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function vectorSearchAtlas(
  indexName: string,
  queryVector: number[],
  limit: number
): Promise<Array<{ title: string; content: string; score: number }> | null> {
  try {
    const results = await KnowledgeBase.aggregate([
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(limit * 20, 100),
          limit,
        },
      },
      {
        $project: {
          title: 1,
          content: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
    if (!Array.isArray(results) || results.length === 0) return null;
    return results.map(r => ({ title: r.title, content: r.content, score: r.score ?? 0.9 }));
  } catch (err) {
    console.warn('[RAG] $vectorSearch failed, using in-memory cosine:', (err as Error)?.message ?? err);
    return null;
  }
}

async function vectorSearchInMemory(
  queryVector: number[],
  limit: number
): Promise<Array<{ title: string; content: string; score: number }>> {
  // Fine for small/medium knowledge bases; avoids requiring an Atlas index.
  const docs = await KnowledgeBase.find(
    { embedding: { $exists: true, $type: 'array', $ne: [] } },
    { title: 1, content: 1, embedding: 1 }
  ).lean();

  return docs
    .filter(d => Array.isArray(d.embedding) && d.embedding.length === queryVector.length)
    .map(d => ({
      title: d.title as string,
      content: d.content as string,
      score: cosineSimilarity(queryVector, d.embedding as number[]),
    }))
    .filter(r => r.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── Search: vector first, keyword fallback ─────────────────────────────────────

export async function searchKnowledge(query: string, limit = 5): Promise<Array<{ title: string; content: string; score: number }>> {
  console.log(`[RAG] Searching knowledge base for: "${query}"`);

  // 1) Semantic vector search (only meaningful with a real embedding provider)
  const { provider } = embeddingProviderInfo();
  if (provider !== 'mock') {
    try {
      const queryVector = await generateEmbedding(query);

      const indexName = await ensureVectorIndex();
      if (indexName) {
        const atlasResults = await vectorSearchAtlas(indexName, queryVector, limit);
        if (atlasResults && atlasResults.length > 0) {
          console.log(`[RAG] ✅ ${atlasResults.length} hits via Atlas $vectorSearch`);
          return atlasResults;
        }
      }

      const cosineResults = await vectorSearchInMemory(queryVector, limit);
      if (cosineResults.length > 0) {
        console.log(`[RAG] ✅ ${cosineResults.length} hits via in-memory cosine (${provider} embeddings)`);
        return cosineResults;
      }
    } catch (err) {
      console.error('[RAG] Vector search error, falling back to keywords:', err);
    }
  }

  // 2) Keyword fallback (text index → regex → defaults)
  try {
    const entries = await KnowledgeBase.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    if (entries.length > 0) {
      return entries.map(entry => ({
        title: entry.title,
        content: entry.content,
        score: (entry as any)._doc.score || 0.8,
      }));
    }

    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    if (keywords.length > 0) {
      const regexFilters = keywords.map(kw => ({
        $or: [
          { title: { $regex: kw, $options: 'i' } },
          { content: { $regex: kw, $options: 'i' } }
        ]
      }));

      const regexEntries = await KnowledgeBase.find({ $and: regexFilters }).limit(limit);
      if (regexEntries.length > 0) {
        return regexEntries.map(entry => ({
          title: entry.title,
          content: entry.content,
          score: 0.6,
        }));
      }
    }

    const count = await KnowledgeBase.countDocuments();
    if (count === 0) {
      return [
        {
          title: 'SkyVoice Platform Overview',
          content: 'SkyVoice is an intelligent Voice-to-Voice AI assistant system. It supports speech recognition, voice synthesis, Google Calendar scheduling, and project inquiries.',
          score: 0.5
        }
      ];
    }

    const allDocs = await KnowledgeBase.find().limit(limit);
    return allDocs.map(entry => ({
      title: entry.title,
      content: entry.content,
      score: 0.4
    }));
  } catch (error) {
    console.error('[RAG] MongoDB local search error:', error);
    return [];
  }
}

// Chunk + embed + store plain text (shared by PDF/DOCX and URL ingestion)
export async function ingestPlainText(
  title: string,
  text: string,
  sourceType: 'pdf' | 'docx' | 'url' | 'manual',
  sourceUrl?: string
): Promise<{ chunks: string[]; status: 'success' | 'error' }> {
  try {
    if (!text.trim()) throw new Error('Text is empty');
    const chunks = chunkText(text);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      await KnowledgeBase.create({
        title: chunks.length > 1 ? `${title} (Part ${i + 1})` : title,
        content: chunk,
        embedding,
        sourceType,
        sourceUrl,
        chunkIndex: i,
        totalChunks: chunks.length,
        indexStatus: 'indexed',
      });
    }
    return { chunks, status: 'success' };
  } catch (error) {
    console.error('[RAG] Failed to ingest text:', error);
    return { chunks: [], status: 'error' };
  }
}

// Fetch a web page and reduce it to readable text
export async function fetchUrlAsText(url: string): Promise<{ title: string; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SkyVoice-KnowledgeBot/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('html')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const pageTitle = titleMatch?.[1]?.trim() || url;

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;|&\w+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { title: pageTitle, text };
  } finally {
    clearTimeout(timeout);
  }
}

// Main function to parse and ingest documents
export async function ingestDocument(
  title: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; chunks: string[]; status: 'success' | 'error' }> {
  try {
    let text = '';

    if (mimeType === 'application/pdf') {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'docx'
    ) {
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value;
    } else {
      text = buffer.toString('utf-8');
    }

    if (!text.trim()) {
      throw new Error('Parsed text is empty');
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Ingest chunks into DB
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);

      await KnowledgeBase.create({
        title: `${title} (Part ${i + 1})`,
        content: chunk,
        embedding,
        sourceType: mimeType.includes('pdf') ? 'pdf' : 'docx',
        chunkIndex: i,
        totalChunks: chunks.length,
        indexStatus: 'indexed',
      });
    }

    return { text, chunks, status: 'success' };
  } catch (error) {
    console.error('[RAG] Failed to ingest document:', error);
    return { text: '', chunks: [], status: 'error' };
  }
}
