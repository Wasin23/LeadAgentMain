# Meridian Legal & Compliance

## Status Overview

| Area | Risk | Status |
|------|------|--------|
| Apollo API (reseller model) | CRITICAL | Action needed — email partners@apollo.io |
| Gmail/Outlook OAuth bulk send | LOW | Covered — emails are user-approved via queue |
| LinkedIn via Unipile | ACCEPTED | User accepted risk |
| CAN-SPAM | LOW | Covered — need address validation (see below) |
| GDPR | LOW-MED | Sign DPAs (quick), document legitimate interests |
| Mailgun AUP | LOW | Compliant |
| Hunter / ZeroBounce / Serper | LOW | Within intended use |
| OpenAI / Anthropic / Mistral | LOW | Fine for B2B use |
| Stripe | LOW | PCI covered by tokenization |

---

## Apollo.io — ACTION NEEDED

**Problem**: Meridian uses a single shared `APOLLO_API_KEY` and bills users per enrichment at a 1.5x markup. This is a reselling model that Apollo's standard ToS prohibits without a formal agreement.

**Good news**: Apollo has a dedicated **API Reseller Program** built exactly for this use case.

**Action**: Email `partners@apollo.io`
- Describe Meridian: AI prospecting SaaS that uses Apollo for lead enrichment/search as a backend
- Ask for the API Reseller Agreement
- Most partners sign within a week

**Program page**: https://www.apollo.io/partners/api-reseller

Apollo is not strict about enforcement — they actively want SaaS tools built on their data. This is a paperwork formality, not a restructure.

---

## CAN-SPAM

**Covered**:
- ✅ Unsubscribe link in every email (HMAC token, 30-day expiry)
- ✅ Unsubscribe honored immediately + pending follow-ups cancelled
- ✅ Accurate sender info (OAuth real email)
- ✅ Bounce handling

**One gap**:
- ⚠️ Physical postal address is required in every commercial email. This comes from `companyBranding` in the compliance footer, but there's no validation forcing users to fill it in. **Fix**: block agent start if `companyBranding.address` is empty.

---

## GDPR (European Leads)

### Lawful Basis
Using "legitimate interests" as the basis for cold emailing EU business contacts. This holds because:
- Target is a work email address in a relevant business role
- Individual can opt out at any time (unsubscribe ✅)
- B2B marketing to work emails is a recognized legitimate interest under GDPR

No code changes needed — just document this internally.

### DPAs (Data Processing Agreements) — Quick Wins
Need signed DPAs with services that process EU personal data. All are click-through or simple email requests:

| Service | How to get DPA |
|---------|---------------|
| AWS (DynamoDB) | AWS Console → My Account → Data Processing Addendum |
| Mailgun | Email support@mailgun.com and request DPA |
| OpenAI | OpenAI account settings → Privacy → DPA |
| Anthropic | legal@anthropic.com or account settings |

Estimated time: ~30 minutes total.

### Data Retention
- **Issue**: Lead PII is stored indefinitely in DynamoDB. GDPR requires deletion when no longer needed.
- **Fix (low urgency)**: Add TTL on lead records — e.g., auto-delete contacted leads after 2 years of no activity. Not urgent at current scale.

### Privacy Footer (Optional Enhancement)
Add a one-liner to the compliance footer disclosing data sourcing:
> *"Your contact info was sourced from a B2B database. [Privacy Policy]"*

Not legally required for CAN-SPAM; good practice for GDPR.

---

## Gmail / Outlook OAuth

Google's Gmail API policy says users must review and authorize each message. This is **covered** because:
- Every email goes into the queue (QUEUED status)
- User manually approves before it sends (APPROVED status)
- No email fires without human approval

Outlook/Microsoft OAuth: same argument applies.

---

## Mailgun

Mailgun's AUP permits CAN-SPAM-compliant B2B cold email. Meridian is compliant:
- ✅ Unsubscribe mechanism
- ✅ Bounce handling + complaint tracking
- ✅ ZeroBounce email validation before send
- ✅ Physical address (when companyBranding filled in)

No issues here.

---

## LinkedIn via Unipile

LinkedIn's ToS prohibits automated access via unofficial APIs. Unipile wraps LinkedIn's private API. **Risk accepted by user.** LinkedIn can ban accounts doing automated outreach. Enforce as a user-side risk.

---

## Notes

- **Apollo reseller agreement** is the only active action item.
- **DPAs** are a 30-minute admin task — do when convenient.
- **CAN-SPAM address validation** is a small code fix — block agent start if address empty.
- Everything else is low risk or already handled.
