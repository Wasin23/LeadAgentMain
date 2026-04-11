/**
 * test-linkedin.js
 * Quick integration test for EnrichLayer (profile enrichment) + Unipile (LinkedIn messaging)
 *
 * Prerequisites — add to .env:
 *   ENRICHLAYER_API_KEY=your_key
 *   UNIPILE_API_KEY=your_key
 *   UNIPILE_DSN=your_dsn  (looks like: https://api1.unipile.com:13111)
 *   UNIPILE_ACCOUNT_ID=your_account_id  (the connected LinkedIn account)
 *
 * Usage:
 *   node test-linkedin.js enrich   <linkedin_url>
 *   node test-linkedin.js send     <name_or_slug> "<message>"
 *   node test-linkedin.js reply    <chat_id> "<message>"
 *   node test-linkedin.js connect  <name_or_slug> "<note>"
 *   node test-linkedin.js inbox
 *   node test-linkedin.js accounts
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const ENRICHLAYER_KEY = process.env.ENRICHLAYER_API_KEY
const UNIPILE_KEY     = process.env.UNIPILE_API_KEY
const UNIPILE_DSN     = process.env.UNIPILE_DSN      // e.g. https://api1.unipile.com:13111
const UNIPILE_ACCOUNT = process.env.UNIPILE_ACCOUNT_ID

// ─────────────────────────────────────────────────────────────────────────────
// EnrichLayer
// ─────────────────────────────────────────────────────────────────────────────

async function enrichProfile(linkedinUrl) {
  console.log(`\n🔍 Enriching: ${linkedinUrl}\n`)

  if (!ENRICHLAYER_KEY) {
    console.error('❌ ENRICHLAYER_API_KEY not set in .env')
    process.exit(1)
  }

  const url = `https://enrichlayer.com/api/v2/linkedin/person?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ENRICHLAYER_KEY}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ EnrichLayer error ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = await res.json()

  console.log('✅ Profile enriched:\n')
  console.log(`  Name:       ${data.full_name || '—'}`)
  console.log(`  Headline:   ${data.headline || '—'}`)
  console.log(`  Company:    ${data.experiences?.[0]?.company || '—'}`)
  console.log(`  Title:      ${data.experiences?.[0]?.title || '—'}`)
  console.log(`  Location:   ${data.city || ''} ${data.state || ''} ${data.country_full_name || ''}`.trim())
  console.log(`  Email:      ${data.personal_emails?.[0] || data.personal_email || '—'}`)
  console.log(`  LinkedIn:   ${data.public_identifier ? `https://linkedin.com/in/${data.public_identifier}` : '—'}`)
  console.log(`  Followers:  ${data.follower_count?.toLocaleString() || '—'}`)
  console.log(`  Summary:    ${(data.summary || '—').slice(0, 120)}...`)
  console.log('\nFull response saved to: enrich-result.json')

  await import('fs').then(fs =>
    fs.writeFileSync('enrich-result.json', JSON.stringify(data, null, 2))
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Unipile helpers
// ─────────────────────────────────────────────────────────────────────────────

function unipileHeaders() {
  if (!UNIPILE_KEY || !UNIPILE_DSN) {
    console.error('❌ UNIPILE_API_KEY and UNIPILE_DSN must be set in .env')
    process.exit(1)
  }
  return {
    'X-API-KEY': UNIPILE_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

// List all connected accounts — useful to find your UNIPILE_ACCOUNT_ID
async function listAccounts() {
  console.log('\n📋 Connected Unipile accounts:\n')

  const res = await fetch(`${UNIPILE_DSN}/api/v1/accounts`, {
    headers: unipileHeaders(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ Unipile error ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = await res.json()
  const accounts = data.items || data.accounts || []

  if (!accounts.length) {
    console.log('  No accounts connected yet.')
    console.log('  → Go to your Unipile dashboard and connect a LinkedIn account first.')
    return
  }

  accounts.forEach((a, i) => {
    console.log(`  [${i + 1}] ID: ${a.id}`)
    console.log(`      Provider: ${a.type || a.provider}`)
    console.log(`      Name:     ${a.name || a.username || '—'}`)
    console.log(`      Status:   ${a.status || '—'}`)
    console.log()
  })

  console.log('  → Set UNIPILE_ACCOUNT_ID to the ID of the LinkedIn account you want to use.')
}

// Fetch the latest message text for a chat
async function fetchLatestMessage(chatId) {
  const res = await fetch(`${UNIPILE_DSN}/api/v1/chats/${chatId}/messages?limit=1`, {
    headers: unipileHeaders(),
  })
  if (!res.ok) return '—'
  const data = await res.json()
  return data.items?.[0]?.text?.slice(0, 80) || '—'
}

// Show recent inbox messages
async function showInbox() {
  console.log('\n📬 Recent LinkedIn inbox:\n')

  if (!UNIPILE_ACCOUNT) {
    console.error('❌ UNIPILE_ACCOUNT_ID not set in .env — run "node test-linkedin.js accounts" first')
    process.exit(1)
  }

  const res = await fetch(`${UNIPILE_DSN}/api/v1/chats?account_id=${UNIPILE_ACCOUNT}&limit=10`, {
    headers: unipileHeaders(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ Unipile error ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = await res.json()
  const chats = data.items || data.chats || []

  if (!chats.length) {
    console.log('  No messages found.')
    return
  }

  // Fetch latest message for each chat concurrently
  const previews = await Promise.all(chats.map(c => fetchLatestMessage(c.id)))

  chats.forEach((c, i) => {
    const who = c.attendee_provider_id || c.name || '—'
    const ts = c.timestamp ? new Date(c.timestamp).toLocaleDateString() : '—'
    console.log(`  [${i + 1}] ${who}  (${ts})  chat_id: ${c.id}`)
    console.log(`      ${previews[i]}`)
    console.log()
  })
}

// Resolve a LinkedIn profile slug/name/URL → Unipile provider_id
// Strategy: scan existing chats and check attendee names, since users/search is unreliable
async function resolveProviderId(slugOrId) {
  // Already a provider ID
  if (/^AC[ow]|^AE/i.test(slugOrId)) return slugOrId

  console.log(`  Resolving provider_id for: ${slugOrId}...`)

  // Extract the slug from a full URL
  const slug = slugOrId.startsWith('http')
    ? slugOrId.match(/linkedin\.com\/in\/([^/]+)/)?.[1] || slugOrId
    : slugOrId

  // Scan all chats, checking each attendee's name and public_identifier
  let cursor = null
  for (let page = 0; page < 8; page++) {
    const url = `${UNIPILE_DSN}/api/v1/chats?account_id=${UNIPILE_ACCOUNT}&limit=50${cursor ? '&cursor=' + cursor : ''}`
    const res = await fetch(url, { headers: unipileHeaders() })
    if (!res.ok) break
    const data = await res.json()
    const chats = data.items || []

    for (const chat of chats) {
      const r = await fetch(`${UNIPILE_DSN}/api/v1/chats/${chat.id}/attendees`, { headers: unipileHeaders() })
      if (!r.ok) continue
      const att = await r.json()
      const other = (att.items || []).find(a => !a.is_self)
      if (!other) continue
      const nameMatch = other.name?.toLowerCase().includes(slug.toLowerCase())
      const slugMatch = other.provider_id === slug || other.public_identifier === slug
      if (nameMatch || slugMatch) {
        console.log(`  Found: ${other.name} → ${other.provider_id}`)
        return other.provider_id
      }
    }

    cursor = data.cursor
    if (!cursor) break
  }

  console.error(`❌ Could not find a chat contact matching "${slugOrId}"`)
  console.error('   Tip: use the provider_id directly (e.g. ACoAAAA...) or the chat_id with: node test-linkedin.js reply <chat_id> "<msg>"')
  process.exit(1)
}

// Find an existing chat for a given provider_id (searches all pages up to 200 chats)
async function findExistingChat(providerId) {
  let cursor = null
  for (let page = 0; page < 4; page++) {
    const url = `${UNIPILE_DSN}/api/v1/chats?account_id=${UNIPILE_ACCOUNT}&limit=50${cursor ? '&cursor=' + cursor : ''}`
    const res = await fetch(url, { headers: unipileHeaders() })
    if (!res.ok) break
    const data = await res.json()
    const match = (data.items || []).find(c => c.attendee_provider_id === providerId)
    if (match) return match.id
    cursor = data.cursor
    if (!cursor) break
  }
  return null
}

// Send a DM to a LinkedIn profile (slug, URL, or provider_id)
async function sendMessage(profileId, message) {
  console.log(`\n✉️  Sending message to: ${profileId}\n`)

  if (!UNIPILE_ACCOUNT) {
    console.error('❌ UNIPILE_ACCOUNT_ID not set in .env')
    process.exit(1)
  }

  const providerId = await resolveProviderId(profileId)

  // Prefer replying into an existing chat (works on free tier)
  const existingChatId = await findExistingChat(providerId)
  if (existingChatId) {
    console.log(`  Found existing chat: ${existingChatId} — replying into it`)
    const res = await fetch(`${UNIPILE_DSN}/api/v1/chats/${existingChatId}/messages`, {
      method: 'POST',
      headers: unipileHeaders(),
      body: JSON.stringify({ text: message }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ Unipile error ${res.status}: ${text}`)
      process.exit(1)
    }
    const data = await res.json()
    console.log('✅ Message sent!')
    console.log(`   Message ID: ${data.message_id || JSON.stringify(data)}`)
    return
  }

  // No existing chat — try creating a new one
  console.log('  No existing chat found — creating new conversation')
  const res = await fetch(`${UNIPILE_DSN}/api/v1/chats`, {
    method: 'POST',
    headers: unipileHeaders(),
    body: JSON.stringify({
      account_id:    UNIPILE_ACCOUNT,
      attendees_ids: [providerId],
      text:          message,
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    if (res.status === 403) {
      console.error('❌ 403 subscription_required — creating new conversations requires a Unipile paid plan.')
      console.error('   Upgrade at https://unipile.com/pricing or message someone who has already messaged you first.')
    } else {
      console.error(`❌ Unipile error ${res.status}: ${JSON.stringify(errBody)}`)
    }
    process.exit(1)
  }

  const data = await res.json()
  console.log('✅ Message sent!')
  console.log(`   Chat ID: ${data.id || data.chat_id || JSON.stringify(data)}`)
}

// Send a connection request (with optional note)
async function sendConnectionRequest(profileId, note) {
  console.log(`\n🤝 Sending connection request to: ${profileId}\n`)

  if (!UNIPILE_ACCOUNT) {
    console.error('❌ UNIPILE_ACCOUNT_ID not set in .env')
    process.exit(1)
  }

  const body = {
    account_id:  UNIPILE_ACCOUNT,
    provider_id: profileId,
  }
  if (note) body.message = note

  const res = await fetch(`${UNIPILE_DSN}/api/v1/linkedin/invitations`, {
    method: 'POST',
    headers: unipileHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ Unipile error ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log('✅ Connection request sent!')
  console.log(`   Response: ${JSON.stringify(data)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const [,, command, arg1, arg2] = process.argv

switch (command) {
  case 'enrich':
    if (!arg1) { console.error('Usage: node test-linkedin.js enrich <linkedin_url>'); process.exit(1) }
    await enrichProfile(arg1)
    break

  case 'accounts':
    await listAccounts()
    break

  case 'inbox':
    await showInbox()
    break

  case 'send':
    if (!arg1 || !arg2) { console.error('Usage: node test-linkedin.js send <name_or_slug> "<message>"'); process.exit(1) }
    await sendMessage(arg1, arg2)
    break

  case 'reply': {
    if (!arg1 || !arg2) { console.error('Usage: node test-linkedin.js reply <chat_id> "<message>"'); process.exit(1) }
    const r = await fetch(`${UNIPILE_DSN}/api/v1/chats/${arg1}/messages`, {
      method: 'POST',
      headers: unipileHeaders(),
      body: JSON.stringify({ text: arg2 }),
    })
    const d = await r.json()
    if (!r.ok) { console.error(`❌ ${r.status}`, JSON.stringify(d)); process.exit(1) }
    console.log('✅ Sent! Message ID:', d.message_id)
    break
  }

  case 'connect':
    if (!arg1) { console.error('Usage: node test-linkedin.js connect <profile_id> "<optional note>"'); process.exit(1) }
    await sendConnectionRequest(arg1, arg2)
    break

  default:
    console.log(`
LinkedIn Integration Test
─────────────────────────
Commands:
  node test-linkedin.js accounts                           List connected Unipile accounts
  node test-linkedin.js enrich   <linkedin_url>            Enrich a LinkedIn profile
  node test-linkedin.js inbox                              Show recent inbox messages (with chat IDs)
  node test-linkedin.js reply    <chat_id> "<message>"     Reply into a specific chat (fast, no lookup)
  node test-linkedin.js send     <name_or_slug> "<msg>"    Send a DM by name/slug (scans existing chats)
  node test-linkedin.js connect  <name_or_slug> "<note>"   Send a connection request

Required .env keys:
  ENRICHLAYER_API_KEY   — from enrichlayer.com
  UNIPILE_API_KEY       — from dashboard.unipile.com → API Keys
  UNIPILE_DSN           — from dashboard.unipile.com (e.g. https://api1.unipile.com:13111)
  UNIPILE_ACCOUNT_ID    — run "accounts" command to find this

Sign up:
  EnrichLayer: https://enrichlayer.com/auth/register  (free PAYG, $10 min)
  Unipile:     https://dashboard.unipile.com/signup   (7-day free trial, no CC)
`)
}
