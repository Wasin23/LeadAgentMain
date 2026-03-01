// Industry Facts RAG — stores and retrieves industry statistics for email generation
// Per-industry cache with 2-week TTL. Deduplicates by cosine similarity.
// Flow: query before search → skip search if fresh → upsert after search → query before email build

import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import OpenAI from 'openai';

const COLLECTION_NAME = 'industry_facts';
const EMBEDDING_DIM = 1536; // text-embedding-3-small
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const DEDUPE_SIMILARITY_THRESHOLD = 0.92; // skip insert if nearly identical fact exists

class ZillizIndustryFacts {
  constructor() {
    this.client = null;
    this.openai = null;
    this.isConnected = false;
  }

  async initialize() {
    if (this.isConnected) return;

    const endpoint = process.env.ZILLIZ_ENDPOINT;
    const token = process.env.ZILLIZ_TOKEN;

    if (!endpoint || !token) {
      throw new Error('ZILLIZ_ENDPOINT and ZILLIZ_TOKEN required for industry facts RAG');
    }

    this.client = new MilvusClient({ address: endpoint, token });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const health = await this.client.checkHealth();
    if (!health.isHealthy) throw new Error('Zilliz health check failed');

    await this._ensureCollection();
    this.isConnected = true;
  }

  async _ensureCollection() {
    const collections = await this.client.listCollections();
    const exists = collections.collection_names?.includes(COLLECTION_NAME);

    if (!exists) {
      await this.client.createCollection({
        collection_name: COLLECTION_NAME,
        description: 'Industry statistics for email generation RAG',
        fields: [
          {
            name: 'id',
            data_type: DataType.VarChar,
            max_length: 64,
            is_primary_key: true
          },
          {
            name: 'embedding',
            data_type: DataType.FloatVector,
            dim: EMBEDDING_DIM
          },
          {
            name: 'fact_text',
            data_type: DataType.VarChar,
            max_length: 1000
          },
          {
            name: 'industry',
            data_type: DataType.VarChar,
            max_length: 100
          },
          {
            name: 'source_url',
            data_type: DataType.VarChar,
            max_length: 500
          },
          {
            name: 'added_at',
            data_type: DataType.Int64
          }
        ]
      });

      await this.client.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding',
        index_type: 'HNSW',
        index_name: 'embedding_index',
        params: { M: 16, efConstruction: 200 }
      });
    }

    try {
      await this.client.loadCollection({ collection_name: COLLECTION_NAME });
    } catch (e) {
      if (!e.message?.includes('already loaded')) throw e;
    }
  }

  async _embed(text) {
    const res = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 800) // keep within token limit
    });
    return res.data[0].embedding;
  }

  // Check if fresh facts exist for an industry (< TTL_MS old)
  // Returns { hasFresh: bool, facts: string[] }
  async getFreshFacts(industry, topK = 5) {
    try {
      await this.initialize();

      const queryVec = await this._embed(`${industry} industry statistics`);
      const cutoff = Date.now() - TTL_MS;

      const results = await this.client.search({
        collection_name: COLLECTION_NAME,
        vector: queryVec,
        filter: `industry == "${industry.toLowerCase()}" && added_at > ${cutoff}`,
        output_fields: ['fact_text', 'added_at'],
        limit: topK
      });

      const hits = results.results || [];
      if (hits.length === 0) return { hasFresh: false, facts: [] };

      return {
        hasFresh: true,
        facts: hits.map(h => h.fact_text)
      };
    } catch (err) {
      console.error('[IndustryFacts] getFreshFacts error:', err.message);
      return { hasFresh: false, facts: [] };
    }
  }

  // Query facts relevant to a specific topic within an industry (for email build)
  async queryRelevantFacts(industry, topic, topK = 3) {
    try {
      await this.initialize();

      const queryVec = await this._embed(`${industry} ${topic}`);

      const results = await this.client.search({
        collection_name: COLLECTION_NAME,
        vector: queryVec,
        filter: `industry == "${industry.toLowerCase()}"`,
        output_fields: ['fact_text'],
        limit: topK
      });

      return (results.results || []).map(h => h.fact_text);
    } catch (err) {
      console.error('[IndustryFacts] queryRelevantFacts error:', err.message);
      return [];
    }
  }

  // Upsert facts from a research run — deduplicates before inserting
  async upsertFacts(industry, factsArray, sourceUrl = '') {
    if (!factsArray || factsArray.length === 0) return;

    try {
      await this.initialize();

      for (const factText of factsArray) {
        if (!factText || factText.length < 20) continue;

        const vec = await this._embed(factText);

        // Deduplicate — check if a very similar fact already exists
        const existing = await this.client.search({
          collection_name: COLLECTION_NAME,
          vector: vec,
          filter: `industry == "${industry.toLowerCase()}"`,
          output_fields: ['id'],
          limit: 1
        });

        const topScore = existing.results?.[0]?.score ?? 0;
        if (topScore >= DEDUPE_SIMILARITY_THRESHOLD) {
          continue; // already have this fact
        }

        const id = `${industry.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        await this.client.insert({
          collection_name: COLLECTION_NAME,
          data: [{
            id,
            embedding: vec,
            fact_text: factText.slice(0, 1000),
            industry: industry.toLowerCase(),
            source_url: (sourceUrl || '').slice(0, 500),
            added_at: Date.now()
          }]
        });
      }

      await this.client.flush({ collection_names: [COLLECTION_NAME] });
    } catch (err) {
      console.error('[IndustryFacts] upsertFacts error:', err.message);
    }
  }

  // Get all facts (for settings UI display) — grouped by industry
  // Pass industries array to filter to only those the user has actually used
  async getAllFacts(industries = null) {
    try {
      await this.initialize();

      const results = await this.client.query({
        collection_name: COLLECTION_NAME,
        filter: 'added_at > 0',
        output_fields: ['id', 'fact_text', 'industry', 'source_url', 'added_at'],
        limit: 500
      });

      const allFacts = (results.data || []);
      const filtered = industries && industries.length > 0
        ? allFacts.filter(r => industries.map(i => i.toLowerCase()).includes(r.industry))
        : allFacts;
      const facts = filtered.map(r => ({
        id: r.id,
        fact: r.fact_text,
        industry: r.industry,
        source: r.source_url,
        addedAt: r.added_at,
        age: Math.floor((Date.now() - r.added_at) / (1000 * 60 * 60 * 24)), // days old
        fresh: (Date.now() - r.added_at) < TTL_MS
      }));

      // Group by industry
      const grouped = {};
      for (const fact of facts) {
        if (!grouped[fact.industry]) grouped[fact.industry] = [];
        grouped[fact.industry].push(fact);
      }

      // Sort each group newest first
      for (const ind of Object.keys(grouped)) {
        grouped[ind].sort((a, b) => b.addedAt - a.addedAt);
      }

      return { success: true, grouped, total: facts.length };
    } catch (err) {
      console.error('[IndustryFacts] getAllFacts error:', err.message);
      return { success: false, error: err.message, grouped: {}, total: 0 };
    }
  }

  // Delete a single fact by ID
  async deleteFact(id) {
    try {
      await this.initialize();
      await this.client.delete({
        collection_name: COLLECTION_NAME,
        filter: `id == "${id}"`
      });
      return { success: true };
    } catch (err) {
      console.error('[IndustryFacts] deleteFact error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Delete all facts for an industry
  async deleteIndustry(industry) {
    try {
      await this.initialize();
      await this.client.delete({
        collection_name: COLLECTION_NAME,
        filter: `industry == "${industry.toLowerCase()}"`
      });
      return { success: true };
    } catch (err) {
      console.error('[IndustryFacts] deleteIndustry error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Parse raw webpageInsights into individual fact strings
  static extractFactStrings(webpageInsights) {
    const facts = [];
    for (const insight of webpageInsights) {
      if (!insight.insights || insight.insights.includes('NO RELEVANT DATA')) continue;
      const lines = insight.insights.split('\n').filter(l => l.trim().startsWith('-'));
      for (const line of lines) {
        const text = line.replace(/^-\s*/, '').trim();
        if (text.length > 20) facts.push(text);
      }
    }
    return facts;
  }
}

export const industryFacts = new ZillizIndustryFacts();
export { ZillizIndustryFacts };
