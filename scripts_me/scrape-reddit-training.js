#!/usr/bin/env node
/**
 * Scrape real Hacker News comments as fine-tune training data.
 *
 * HN API is open — no auth, no meaningful rate limits.
 * post title = "user" prompt, top comment = "assistant" response.
 *
 * Usage:
 *   node scripts_me/scrape-reddit-training.js              — scrape + save JSONL
 *   node scripts_me/scrape-reddit-training.js --dry-run    — print examples, dont save
 *
 * Output: scripts_me/_reddit_training.jsonl
 * Then:   node scripts_me/finetune-cold-email.js --file scripts_me/_reddit_training.jsonl
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = `You respond like a real person. Short. Direct. No filler. Say what you mean and stop.`;
const HN_API = 'https://hacker-news.firebaseio.com/v0';
const STORIES_TO_FETCH   = 200;
const COMMENTS_PER_STORY = 3;
const MIN_LENGTH         = 60;
const MAX_LENGTH         = 400;
const DELAY_MS           = 60;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function isGoodComment(text) {
  if (!text) return false;
  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) return false;
  if (text.includes('<a href')) return false;
  if (text.startsWith('>')) return false;
  if ((text.match(/\n/g) || []).length > 4) return false;
  if (/https?:\/\//.test(text)) return false;  // drop comments with raw URLs
  return true;
}

function stripHtml(text) {
  return text
    .replace(/<p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, '/').replace(/&#x3D;/g, '=')
    .trim();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const examples = [];

  console.log('Fetching top HN story IDs...');
  const ids = await fetchJSON(`${HN_API}/topstories.json`);
  const storyIds = ids.slice(0, STORIES_TO_FETCH);
  console.log(`Processing ${storyIds.length} stories...\n`);

  for (const storyId of storyIds) {
    try {
      const story = await fetchJSON(`${HN_API}/item/${storyId}.json`);
      await sleep(DELAY_MS);
      if (!story || !story.title || !story.kids?.length) { process.stdout.write('_'); continue; }

      let collected = 0;
      for (const commentId of story.kids.slice(0, 10)) {
        if (collected >= COMMENTS_PER_STORY) break;
        try {
          const comment = await fetchJSON(`${HN_API}/item/${commentId}.json`);
          await sleep(DELAY_MS);
          if (!comment || comment.dead || comment.deleted || !comment.text) continue;
          const text = stripHtml(comment.text);
          if (!isGoodComment(text)) continue;
          examples.push({ title: story.title, comment: text });
          collected++;
        } catch { /* skip */ }
      }
      process.stdout.write(collected > 0 ? '.' : '_');
    } catch { process.stdout.write('x'); }
  }

  console.log(`\n\nCollected ${examples.length} examples\n`);

  if (dryRun) {
    console.log('DRY RUN - first 5 examples:\n');
    examples.slice(0, 5).forEach((ex, i) => {
      console.log(`[${i+1}] ${ex.title}`);
      console.log(`    ${ex.comment.slice(0, 250)}`);
      console.log();
    });
    return;
  }

  if (examples.length < 10) { console.error('Not enough examples. Aborting.'); process.exit(1); }

  const jsonl = examples.map(ex => JSON.stringify({
    messages: [
      { role: 'system',    content: SYSTEM_PROMPT },
      { role: 'user',      content: ex.title },
      { role: 'assistant', content: ex.comment },
    ],
  })).join('\n');

  const outPath = path.join(__dirname, '_reddit_training.jsonl');
  fs.writeFileSync(outPath, jsonl, 'utf8');
  console.log(`Saved ${examples.length} examples to ${outPath}`);
  console.log(`\nNext: node scripts_me/finetune-cold-email.js --file scripts_me/_reddit_training.jsonl`);
}

main().catch(err => { console.error(err); process.exit(1); });
