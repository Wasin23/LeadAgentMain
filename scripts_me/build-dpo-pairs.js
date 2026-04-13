#!/usr/bin/env node
/**
 * Build DPO preference pairs from the existing SFT training data.
 *
 * For each example in _reddit_training.jsonl:
 *   - preferred_output = the original human-written response
 *   - non_preferred_output = what gpt-4.1 naturally generates (RLHF slop)
 *
 * Usage:
 *   node scripts_me/build-dpo-pairs.js                          — generate pairs (writes _dpo_training.jsonl)
 *   node scripts_me/build-dpo-pairs.js --limit 50               — only first 50 examples (for testing)
 *   node scripts_me/build-dpo-pairs.js --start 50               — resume from example 50
 *   node scripts_me/build-dpo-pairs.js --finetune               — upload + start DPO fine-tune after building
 *
 * Output format (OpenAI DPO JSONL):
 *   { "input": [...messages without assistant], "preferred_output": [...], "non_preferred_output": [...] }
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INPUT_FILE = path.join(__dirname, '_reddit_training.jsonl');
const OUTPUT_FILE = path.join(__dirname, '_dpo_training.jsonl');
const MODEL = 'gpt-4.1-2025-04-14';

// No special instructions — let the model write its natural RLHF output
const REJECTED_SYSTEM = `You respond like a real person. Short. Direct. No filler. Say what you mean and stop.`;

const CONCURRENCY = 5; // parallel API calls
const DELAY_MS = 200;  // ms between batches

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateRejected(systemContent, userContent) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: REJECTED_SYSTEM },
      { role: 'user', content: userContent },
    ],
    temperature: 0.9,
    max_tokens: 300,
  });
  return res.choices[0].message.content.trim();
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
  const startIdx = args.indexOf('--start');
  const start = startIdx !== -1 ? parseInt(args[startIdx + 1]) : 0;
  const doFinetune = args.includes('--finetune');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  const examples = lines
    .map((l, i) => ({ idx: i, data: JSON.parse(l) }))
    .filter(({ idx }) => idx >= start)
    .slice(0, limit);

  console.log(`\nBuilding DPO pairs for ${examples.length} examples (starting at ${start})...`);
  console.log(`Model: ${MODEL}  |  Concurrency: ${CONCURRENCY}\n`);

  // Resume: if output file exists, skip already-done indices
  const doneIndices = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    const existing = fs.readFileSync(OUTPUT_FILE, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of existing) {
      try {
        const parsed = JSON.parse(line);
        if (parsed._idx !== undefined) doneIndices.add(parsed._idx);
      } catch {}
    }
    console.log(`Resuming: ${doneIndices.size} already done, skipping those.\n`);
  }

  const outStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });
  let done = 0;
  let errors = 0;

  for (let i = 0; i < examples.length; i += CONCURRENCY) {
    const batch = examples.slice(i, i + CONCURRENCY).filter(({ idx }) => !doneIndices.has(idx));
    if (batch.length === 0) { done += CONCURRENCY; continue; }

    await Promise.all(batch.map(async ({ idx, data }) => {
      const messages = data.messages;
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsg = messages.find(m => m.role === 'user');
      const assistantMsg = messages.find(m => m.role === 'assistant');

      if (!userMsg || !assistantMsg) {
        console.warn(`  Skipping example ${idx}: missing user or assistant message`);
        return;
      }

      try {
        const rejected = await generateRejected(
          systemMsg?.content || REJECTED_SYSTEM,
          userMsg.content
        );

        const dpoExample = {
          _idx: idx,
          input: {
            messages: [
              { role: 'system', content: systemMsg?.content || REJECTED_SYSTEM },
              { role: 'user', content: userMsg.content },
            ],
          },
          preferred_output: [{ role: 'assistant', content: assistantMsg.content }],
          non_preferred_output: [{ role: 'assistant', content: rejected }],
        };

        outStream.write(JSON.stringify(dpoExample) + '\n');
        done++;
        process.stdout.write(`\r  Progress: ${done}/${examples.length}  errors: ${errors}  `);
      } catch (err) {
        errors++;
        console.error(`\n  Error on example ${idx}: ${err.message}`);
      }
    }));

    await sleep(DELAY_MS);
  }

  outStream.end();
  console.log(`\n\nDone. Written to: ${OUTPUT_FILE}`);
  console.log(`Total: ${done} pairs, ${errors} errors`);

  if (!doFinetune) {
    console.log(`\nTo start DPO fine-tune:`);
    console.log(`  node scripts_me/build-dpo-pairs.js --finetune`);
    console.log(`  (or run again with --finetune after reviewing the output)`);
    return;
  }

  // ── Start DPO fine-tune ───────────────────────────────────────────────────
  console.log('\nUploading DPO data to OpenAI...');

  // Strip the _idx helper field before uploading
  const cleanedLines = fs.readFileSync(OUTPUT_FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    const obj = JSON.parse(l);
    delete obj._idx;
    return JSON.stringify(obj);
  });
  const cleanedPath = OUTPUT_FILE.replace('.jsonl', '_clean.jsonl');
  fs.writeFileSync(cleanedPath, cleanedLines.join('\n'));

  const file = await openai.files.create({
    file: fs.createReadStream(cleanedPath),
    purpose: 'fine-tune',
  });
  console.log(`File uploaded: ${file.id}`);

  console.log('\nStarting DPO fine-tune job...');
  const job = await openai.fineTuning.jobs.create({
    training_file: file.id,
    model: MODEL,
    method: {
      type: 'dpo',
      dpo: {
        hyperparameters: {
          beta: 0.1,
        },
      },
    },
    suffix: 'meridian-dpo',
  });

  console.log(`\nJob started: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`\nCheck status:`);
  console.log(`  node scripts_me/finetune-cold-email.js --status ${job.id}`);
  console.log(`\nAdd to .env when complete:`);
  console.log(`  FINETUNE_MODEL_ID=${job.id}  (update after job completes)`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
