# Product Ideas

## LinkedIn Outreach Queue

### Core idea
- Evolve the current email queue into an outreach queue over time.
- Keep channel logic deterministic instead of relying on prompt-only reasoning.
- Let email remain the default channel for qualified leads.
- Add LinkedIn drafts only for the highest-priority eligible leads each day.

### Proposed v1 rule
- Qualified leads with a valid email get email outreach queued.
- The top 20 LinkedIn-eligible leads by score each day also get LinkedIn outreach queued.
- LinkedIn eligibility should be enforced in code, not by model judgment alone.

### LinkedIn eligibility rules
- Lead meets qualification threshold.
- Lead has a LinkedIn URL or profile data.
- Campaign has LinkedIn enabled.
- Lead has not already been contacted on LinkedIn.
- Lead has not already replied on any channel.
- Daily LinkedIn quota is not exhausted.

### Important design constraints
- Do not make the model decide mid-draft whether LinkedIn is better.
- Do not force LinkedIn messages into the same data model as email too early.
- Use code for channel eligibility and sequencing.
- Use the model only to generate the approved channel-specific drafts.
- Keep sending/scheduling separate from draft generation because LinkedIn is quota-constrained.

### Recommended product shape
- Strategy layer decides allowed channels per lead.
- Draft generation creates email and/or LinkedIn copy for allowed channels.
- Scheduler enforces daily quotas and send timing.
- UI can eventually become an "Outreach Queue" once both channels are supported cleanly.

### Suggested rollout
1. Add LinkedIn draft generation as a suggestion/review workflow first.
2. Add deterministic channel planning and quota-aware scheduling.
3. Unify email and LinkedIn under an outreach queue UI.
4. Keep social post creation separate from direct outreach queue items.