/**
 * LEAD SOURCE BANDIT
 * ==================
 * Thompson Sampling multi-armed bandit for choosing between lead sources.
 *
 * WHAT IS THOMPSON SAMPLING?
 * ---------------------------
 * We have N lead sources (arms). We don't know which source is best for a
 * given keyword. Instead of picking randomly or locking in early, we maintain
 * a probability distribution over each source's "quality" and update it as
 * we collect data.
 *
 * Each source × keyword combination maintains two counters:
 *   α (alpha) — number of "successes" (valid, non-duplicate leads returned)
 *   β (beta)  — number of "failures" (duplicates, invalid emails, no results)
 *
 * These define a Beta(α, β) distribution, which represents our belief about
 * the probability that a random result from that source will be a success.
 *
 * ON EACH SELECTION:
 *   1. For every available source, draw a random sample from Beta(α, β).
 *   2. Pick the source whose sample value is highest.
 *   3. Call that source. Observe results. Update α and β.
 *
 * WHY THIS WORKS:
 *   - A source with few observations → wide distribution → gets explored often
 *     because it *might* be great. We don't know yet.
 *   - A source that consistently returns clean leads → narrow distribution
 *     around a high mean → wins most selections naturally.
 *   - A source that was good but starts returning dupes → distribution shifts
 *     downward gradually → gets deprioritized without a hard rule.
 *   - It NEVER stops exploring entirely. Old, deprioritized sources can still
 *     win on any given keyword if they sample higher. This matters because
 *     database freshness changes over time.
 *
 * REWARD SIGNAL (current):
 *   +1 to α for every valid, non-duplicate lead returned
 *   +1 to β for every duplicate or invalid email
 *
 * REWARD SIGNAL (future — plug in here):
 *   When reply data is available, weight α by open/reply rate:
 *     α += replyRate × weight
 *   Nothing else changes in the algorithm.
 *
 * STORAGE:
 *   Stats are persisted to DynamoDB (meridian-lead-source-bandit).
 *   PK: userId, SK: keyword#sourceId
 *   Loaded into memory on agent startup. Written after each search batch.
 *
 * MATH REFERENCE:
 *   Beta distribution: Beta(α, β)
 *   Mean: α / (α + β)
 *   Sampling: approximated via the Johnk method (pure JS, no native stats lib)
 */

import AWSManager from './awsManager.js';

// ─────────────────────────────────────────────────────────────────────────────
// BETA DISTRIBUTION SAMPLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sample from a Gamma distribution using the Marsaglia-Tsang method.
 * This is a building block for Beta sampling.
 *
 * @param {number} shape — α parameter (must be > 0)
 * @returns {number}
 */
function sampleGamma(shape) {
  if (shape < 1) {
    // Boost small shape into the valid regime, then correct
    return sampleGamma(1 + shape) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do {
      // Standard normal via Box-Muller
      x = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Draw one sample from Beta(alpha, beta).
 *
 * The Beta distribution is defined over [0,1] and represents a probability.
 * We use it to represent our belief about each source's success rate.
 *
 * @param {number} alpha — success count + prior (must be > 0)
 * @param {number} beta  — failure count + prior (must be > 0)
 * @returns {number} — a value in (0, 1)
 */
export function sampleBeta(alpha, beta) {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  // Beta sample = Gamma(α) / (Gamma(α) + Gamma(β))
  return x / (x + y);
}

// ─────────────────────────────────────────────────────────────────────────────
// BANDIT CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class LeadSourceBandit {
  /**
   * @param {string} userId — scopes all stats to this user
   * @param {AWSManager} awsManager — used for DynamoDB reads/writes
   */
  constructor(userId, awsManager) {
    this.userId = userId;
    this.awsManager = awsManager;

    /**
     * In-memory stats cache.
     * Structure: { "keyword#sourceId": { alpha: number, beta: number } }
     *
     * The "#" separator is safe because neither keywords nor source IDs
     * contain "#" (keywords are lowercase industry terms, source IDs are
     * clean strings like "apollo").
     */
    this.stats = {};

    /**
     * Dirty flags — only write to DynamoDB when a stat has changed.
     * Avoids unnecessary writes on every cycle.
     * Structure: Set<"keyword#sourceId">
     */
    this._dirty = new Set();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load all stored bandit stats for this user from DynamoDB into memory.
   * Called once during agent startup. If DynamoDB has no data yet, we start
   * with empty stats (the prior is applied lazily on first select()).
   */
  async loadFromDB() {
    try {
      const rows = await this.awsManager.getBanditStats(this.userId);
      for (const row of rows) {
        // SK format: "keyword#sourceId"
        const key = row.sk;
        this.stats[key] = {
          alpha: row.alpha,
          beta: row.beta
        };
      }
      console.log(`🎰 [BANDIT] Loaded ${rows.length} stat records for user ${this.userId}`);
    } catch (err) {
      // Non-fatal — we'll use defaults and re-populate over time
      console.warn(`⚠️ [BANDIT] Failed to load stats from DB, using priors: ${err.message}`);
    }
  }

  /**
   * Persist all dirty (changed) stats back to DynamoDB.
   * Called after each search batch, not after every individual lead,
   * to keep write volume low.
   */
  async flushToDB() {
    if (this._dirty.size === 0) return;
    const toWrite = [];
    for (const key of this._dirty) {
      const [keyword, sourceId] = key.split('#');
      const { alpha, beta } = this.stats[key];
      toWrite.push({ userId: this.userId, sk: key, keyword, sourceId, alpha, beta });
    }
    try {
      await this.awsManager.putBanditStats(toWrite);
      this._dirty.clear();
    } catch (err) {
      console.warn(`⚠️ [BANDIT] Flush to DB failed: ${err.message}`);
      // Leave dirty set intact so next flush retries
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CORE BANDIT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get or initialize stats for a source × keyword pair.
   * Applies the source's default priors if this is the first observation.
   *
   * Using priors > 0 (rather than 1,1) encodes our prior belief:
   *   Apollo (3,1) → we're fairly confident it starts out decent
   *   A new unknown source (2,2) → genuinely uncertain, explore more
   *
   * @param {string} keyword
   * @param {object} source — source definition from leadSourceRegistry
   * @returns {{ alpha: number, beta: number }}
   */
  _getStats(keyword, source) {
    const key = `${keyword}#${source.id}`;
    if (!this.stats[key]) {
      // First time we've seen this source × keyword pair — apply priors
      this.stats[key] = {
        alpha: source.defaultAlpha ?? 2,
        beta: source.defaultBeta ?? 2
      };
      // Mark dirty so the prior gets written to DB on next flush
      this._dirty.add(key);
    }
    return this.stats[key];
  }

  /**
   * SELECT — Thompson Sampling selection.
   *
   * Given a list of available sources and a keyword, draw one sample from
   * each source's Beta distribution and return the source with the highest
   * sample. This is the core "explore vs. exploit" decision.
   *
   * Returns the winning source object (from leadSourceRegistry).
   *
   * @param {string} keyword
   * @param {object[]} availableSources — array of source objects, must have ≥1
   * @returns {object} — the selected source
   */
  select(keyword, availableSources) {
    if (availableSources.length === 1) {
      // No choice to make — skip sampling overhead
      return availableSources[0];
    }

    let bestSource = null;
    let bestSample = -1;

    for (const source of availableSources) {
      const { alpha, beta } = this._getStats(keyword, source);

      /**
       * Draw one sample from Beta(α, β).
       *
       * Intuitively: if α >> β, samples will cluster near 1.0 (this source
       * is probably great). If α << β, samples cluster near 0 (probably bad).
       * If α ≈ β or both are small, samples are spread out (uncertain —
       * the bandit will explore this source more).
       */
      const sample = sampleBeta(alpha, beta);

      if (sample > bestSample) {
        bestSample = sample;
        bestSource = source;
      }
    }

    return bestSource;
  }

  /**
   * REWARD — update stats after a search completes.
   *
   * Call this once per search batch with the aggregate results.
   * Do NOT call per-lead — batch updates keep write amplification low.
   *
   * @param {string} keyword    — the keyword that was searched
   * @param {string} sourceId   — which source was used
   * @param {number} successes  — valid, non-duplicate leads found
   * @param {number} failures   — duplicates + invalid emails + no-results
   *
   * FUTURE EXTENSION:
   *   When you have reply data, call this with weighted successes:
   *     reward(keyword, sourceId, newLeads * replyRateWeight, dupes)
   *   The formula stays identical — only the input numbers change.
   */
  reward(keyword, sourceId, successes, failures) {
    const source = { id: sourceId, defaultAlpha: 2, defaultBeta: 2 };
    const stats = this._getStats(keyword, source);

    // Increment α by successes, β by failures
    // Beta distribution updates are purely additive — this is Bayesian conjugacy
    stats.alpha += successes;
    stats.beta += failures;

    this._dirty.add(`${keyword}#${sourceId}`);

    console.log(
      `🎰 [BANDIT] Updated ${keyword}#${sourceId}: ` +
      `α=${stats.alpha.toFixed(1)} β=${stats.beta.toFixed(1)} ` +
      `(mean=${(stats.alpha / (stats.alpha + stats.beta)).toFixed(2)})`
    );
  }

  /**
   * SUMMARY — return a readable snapshot of all known stats.
   * Used for debugging, admin panels, and future analytics views.
   *
   * @returns {object[]} — sorted by estimated success rate descending
   */
  getSummary() {
    return Object.entries(this.stats)
      .map(([key, { alpha, beta }]) => {
        const [keyword, sourceId] = key.split('#');
        return {
          keyword,
          sourceId,
          alpha,
          beta,
          estimatedRate: alpha / (alpha + beta),
          observations: alpha + beta
        };
      })
      .sort((a, b) => b.estimatedRate - a.estimatedRate);
  }

  /**
   * FORCED SWITCH — when a trigger fires (depth or dup-rate), pick the
   * NEXT best source for this keyword that is NOT the currently active one.
   *
   * Thompson Sampling normally handles switching gradually, but the agent
   * has hard triggers (depth > 3, dup rate > 20%) that should immediately
   * move off the current source. This method finds the best alternative.
   *
   * Returns the best alternative source, or null if only one source is available.
   *
   * @param {string} keyword
   * @param {string} currentSourceId
   * @param {object[]} availableSources
   * @returns {object|null}
   */
  selectAlternative(keyword, currentSourceId, availableSources) {
    const alternatives = availableSources.filter(s => s.id !== currentSourceId);
    if (alternatives.length === 0) return null;

    // Use the same Thompson Sampling selection among alternatives only
    return this.select(keyword, alternatives);
  }
}
