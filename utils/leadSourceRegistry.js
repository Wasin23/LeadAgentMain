/**
 * LEAD SOURCE REGISTRY
 * ====================
 * This is the single place where all lead databases are registered.
 *
 * ARCHITECTURE OVERVIEW
 * ---------------------
 * The agent needs leads. It used to always call Apollo. Now it can call any
 * source that is registered here. Every source exposes the same `search()`
 * interface, so the agent doesn't need to know which database it's talking to.
 *
 * To add a new source (e.g. Proxycurl, RocketReach):
 *   1. Add an object to LEAD_SOURCES below.
 *   2. Implement its `search()` method to accept the standard params and
 *      return the standard lead shape.
 *   3. Add its API key env var name in the `envKey` field.
 *   4. That's it. The bandit, switching logic, and tagging all work automatically.
 *
 * STANDARD SEARCH PARAMS (what every search() receives):
 * -------------------------------------------------------
 * {
 *   keyword:      string   — industry keyword, e.g. "saas"
 *   position:     string   — target job title, e.g. "CEO"
 *   companySizeMin: number
 *   companySizeMax: number
 *   locations:    string[] — e.g. ["United States"]
 *   page:         number   — 1-indexed page number
 *   perPage:      number   — how many leads to request
 *   excludeKeywords: string[] — optional exclusion list from campaign
 * }
 *
 * STANDARD LEAD SHAPE (what every search() must return):
 * -------------------------------------------------------
 * {
 *   success: boolean,
 *   leads: [
 *     {
 *       id:           string   — unique ID from the source
 *       name:         string   — full name
 *       email:        string   — email address (may be null if not found)
 *       title:        string   — job title
 *       company:      string   — company name
 *       organization: object   — raw org data (domain, size, etc.)
 *       linkedin_url: string
 *       city, state, country: string
 *       _leadSource:  string   — auto-tagged by the dispatcher (do NOT set here)
 *     }
 *   ],
 *   rawCount: number  — how many the API returned before dedup/filtering
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const LEAD_SOURCES = [
  {
    /**
     * APOLLO
     * ------
     * B2B prospecting database. Supports people search by industry keyword,
     * job title, company size, and location. Returns structured person objects.
     * The primary source. Very high volume, well-structured data.
     *
     * API docs: https://apolloio.github.io/apollo-api-docs/
     */
    id: 'apollo',
    label: 'Apollo',
    envKey: 'APOLLO_API_KEY',

    /**
     * DEFAULT BANDIT PRIORS
     * ---------------------
     * Thompson Sampling starts with Beta(α, β). The prior represents our
     * belief about this source BEFORE any data is collected.
     *
     * Apollo is well-known and reliable, so we start with a slightly
     * optimistic prior: α=3, β=1 (75% expected success rate).
     * This prevents the bandit from over-exploring alternatives early on.
     */
    defaultAlpha: 3,
    defaultBeta: 1,

    /**
     * search() — Apollo implementation
     * Accepts standard params, returns standard lead shape.
     * The actual fetch logic that was previously inline in leadSearch()
     * now lives here so the agent's method can stay source-agnostic.
     */
    async search(params, apiKey) {
      const {
        keyword, position, companySizeMin, companySizeMax,
        locations, page, perPage, excludeKeywords
      } = params;

      // Build Apollo-specific search payload from the normalized params
      const searchPayload = {
        q_keywords: position,
        page: page,
        per_page: perPage,
        reveal_personal_emails: true,
        reveal_phone_number: true,
        organization_num_employees_ranges: [`${companySizeMin},${companySizeMax}`],
        q_organization_keyword_tags: [keyword]
      };

      if (locations && locations.length > 0) {
        searchPayload.person_locations = locations;
      }

      if (excludeKeywords && excludeKeywords.length > 0) {
        searchPayload.organization_not_all_keywords = excludeKeywords;
      }

      // --- Search ---
      const response = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Apollo API error ${response.status}: ${errData.error || response.statusText}`);
      }

      const data = await response.json();
      const rawLeads = data.people || [];

      // --- Enrich each lead to get actual email + full name ---
      const leads = [];
      for (const lead of rawLeads) {
        try {
          if (!lead.has_email) continue;

          const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/enrich', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Api-Key': apiKey
            },
            body: JSON.stringify({ id: lead.id, reveal_personal_emails: true })
          });

          if (!enrichResponse.ok) continue;

          const enrichedData = await enrichResponse.json();
          const p = enrichedData.person;

          leads.push({
            id: lead.id,
            name: `${p.first_name} ${p.last_name}`,
            email: p.email,
            title: p.title,
            company: p.organization?.name || lead.organization?.name,
            organization: p.organization || lead.organization,
            city: p.city,
            state: p.state,
            country: p.country,
            linkedin_url: p.linkedin_url,
            phone: p.phone_number || p.direct_phone,
            ...p
          });
        } catch (enrichError) {
          console.error(`[APOLLO SOURCE] Enrich failed for ${lead.id}:`, enrichError.message);
        }
      }

      return {
        success: true,
        leads,
        rawCount: rawLeads.length
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD FUTURE SOURCES HERE — example stub for Proxycurl:
  // ─────────────────────────────────────────────────────────────────────────
  // {
  //   id: 'proxycurl',
  //   label: 'Proxycurl',
  //   envKey: 'PROXYCURL_API_KEY',
  //   defaultAlpha: 2,
  //   defaultBeta: 2,   // neutral prior — we don't know yet
  //   async search(params, apiKey) {
  //     // Call Proxycurl /api/v2/search/person
  //     // Map response to standard lead shape
  //     // Return { success, leads, rawCount }
  //   }
  // }
];

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all sources that have a valid API key configured in the environment.
 * Sources without a key are silently excluded — the agent won't attempt to
 * use them but also won't error out.
 */
export function getAvailableSources() {
  return LEAD_SOURCES.filter(s => !!process.env[s.envKey]);
}

/**
 * Look up a source object by its string ID.
 * Returns undefined if not found (caller should handle gracefully).
 */
export function getSourceById(id) {
  return LEAD_SOURCES.find(s => s.id === id);
}
