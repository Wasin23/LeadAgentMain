import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const COLLECTION_NAME = 'company_memory';
const EMBEDDING_DIM   = 1536; // text-embedding-3-small

/**
 * ZillizCompanyMemory — RAG knowledge base for the Lead Chat system.
 *
 * Uses the existing `company_memory` collection. Schema:
 *   id          — VarChar PK (UUID, manual)
 *   user_id     — VarChar
 *   doc_id      — VarChar  (groups all chunks from one source doc)
 *   chunk_index — Int32
 *   type        — VarChar  (case_study | pricing | battle_card | faq | process | general)
 *   source      — VarChar  (original filename or 'manual')
 *   text        — VarChar  (raw chunk, max 8192)
 *   embedding   — FloatVector 1536-dim COSINE
 *   created_at  — VarChar  (ISO timestamp)
 */
export class ZillizCompanyMemory {
  constructor() {
    this.client      = null;
    this.openai      = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.client = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT,
      token:   process.env.ZILLIZ_TOKEN,
    });
    await this.client.loadCollection({ collection_name: COLLECTION_NAME });
    this.initialized = true;
    console.log('🧠 [COMPANY MEMORY] Ready —', COLLECTION_NAME);
  }

  async _ensureInit() {
    if (!this.initialized) await this.initialize();
  }

  // ── Embedding ─────────────────────────────────────────────────────────────

  async _embed(text) {
    const res = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return res.data[0].embedding;
  }

  // ── Chunking ──────────────────────────────────────────────────────────────

  _chunkText(text, chunkSize = 400, overlap = 60) {
    const words  = text.split(/\s+/);
    const chunks = [];
    let i = 0;
    while (i < words.length) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) chunks.push(chunk);
      i += chunkSize - overlap;
    }
    return chunks;
  }

  // ── Ingest ────────────────────────────────────────────────────────────────

  /**
   * Chunk, embed, and store a document. Returns { docId, chunkCount }.
   */
  async ingestDocument(userId, { text, source, type = 'general' }) {
    await this._ensureInit();
    const docId     = randomUUID();
    const createdAt = new Date().toISOString();
    const chunks    = this._chunkText(text);

    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this._embed(chunks[i]);
      rows.push({
        id:          randomUUID(),
        user_id:     userId,
        doc_id:      docId,
        chunk_index: i,
        type,
        source,
        text:        chunks[i].slice(0, 8000),
        embedding,
        created_at:  createdAt,
      });
    }

    await this.client.insert({ collection_name: COLLECTION_NAME, data: rows });
    await this.client.flush({ collection_names: [COLLECTION_NAME] });

    console.log(`✅ [COMPANY MEMORY] Ingested ${chunks.length} chunks — ${source} (${docId})`);
    return { docId, chunkCount: chunks.length };
  }

  // ── Retrieve ──────────────────────────────────────────────────────────────

  /**
   * Semantic search. Returns top-k chunks relevant to query.
   * Optional type filter for precision (e.g. battle_card when lead mentions competitor).
   */
  async retrieve(userId, query, { topK = 4, type = null } = {}) {
    await this._ensureInit();
    const queryVec = await this._embed(query);

    const filter = type
      ? `user_id == "${userId}" && type == "${type}"`
      : `user_id == "${userId}"`;

    const res = await this.client.search({
      collection_name: COLLECTION_NAME,
      data:            [queryVec],
      filter,
      limit:           topK,
      output_fields:   ['doc_id', 'chunk_index', 'type', 'source', 'text'],
    });

    return (res.results || []).map(r => ({
      docId:      r.doc_id,
      chunkIndex: r.chunk_index,
      type:       r.type,
      source:     r.source,
      text:       r.text,
      score:      r.score,
    }));
  }

  // ── List documents ────────────────────────────────────────────────────────

  /**
   * List unique documents (one per doc_id) for a user.
   */
  async listDocuments(userId) {
    await this._ensureInit();

    const res = await this.client.query({
      collection_name: COLLECTION_NAME,
      filter:          `user_id == "${userId}" && chunk_index == 0`,
      output_fields:   ['doc_id', 'type', 'source', 'created_at'],
      limit:           200,
    });

    const docs = await Promise.all((res.data || []).map(async row => {
      const countRes = await this.client.query({
        collection_name: COLLECTION_NAME,
        filter:          `user_id == "${userId}" && doc_id == "${row.doc_id}"`,
        output_fields:   ['id'],
        limit:           500,
      });
      return {
        docId:      row.doc_id,
        type:       row.type,
        source:     row.source,
        createdAt:  row.created_at,
        chunkCount: countRes.data?.length || 1,
      };
    }));

    return docs;
  }

  // ── Get chunks ───────────────────────────────────────────────────────────

  async getDocumentChunks(userId, docId) {
    await this._ensureInit();
    const res = await this.client.query({
      collection_name: COLLECTION_NAME,
      filter:          `user_id == "${userId}" && doc_id == "${docId}"`,
      output_fields:   ['chunk_index', 'text'],
      limit:           500,
    });
    return (res.data || [])
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map(r => r.text);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteDocument(userId, docId) {
    await this._ensureInit();
    await this.client.delete({
      collection_name: COLLECTION_NAME,
      filter:          `user_id == "${userId}" && doc_id == "${docId}"`,
    });
    await this.client.flush({ collection_names: [COLLECTION_NAME] });
    console.log(`🗑️  [COMPANY MEMORY] Deleted doc ${docId}`);
  }

  // ── Update type ───────────────────────────────────────────────────────────

  /**
   * Re-label all chunks of a doc with a new type.
   * Deletes and re-inserts since Milvus serverless doesn't support scalar updates.
   */
  async updateDocType(userId, docId, newType) {
    await this._ensureInit();

    const res = await this.client.query({
      collection_name: COLLECTION_NAME,
      filter:          `user_id == "${userId}" && doc_id == "${docId}"`,
      output_fields:   ['id', 'chunk_index', 'source', 'text', 'embedding', 'created_at'],
      limit:           500,
    });

    if (!res.data?.length) return;

    await this.client.delete({
      collection_name: COLLECTION_NAME,
      filter:          `user_id == "${userId}" && doc_id == "${docId}"`,
    });

    const rows = res.data.map(r => ({
      id:          r.id,
      user_id:     userId,
      doc_id:      docId,
      chunk_index: r.chunk_index,
      type:        newType,
      source:      r.source,
      text:        r.text,
      embedding:   r.embedding,
      created_at:  r.created_at,
    }));

    await this.client.insert({ collection_name: COLLECTION_NAME, data: rows });
    await this.client.flush({ collection_names: [COLLECTION_NAME] });
  }
}

export const zillizCompanyMemory = new ZillizCompanyMemory();
