#!/usr/bin/env node
/**
 * Fine-tune gpt-4o-mini on successful cold emails pulled from public sources:
 * Lemlist, Close.io (Steli Efti), Josh Braun, Bryan Kreuzberger, Justin McGill.
 *
 * Usage:
 *   node scripts_me/finetune-cold-email.js          — upload + start training
 *   node scripts_me/finetune-cold-email.js --status  — check job status
 *   node scripts_me/finetune-cold-email.js --list    — list all fine-tune jobs
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System prompt used at inference time (must match fine-tune) ─────────────
const SYSTEM_PROMPT = `You write short emails to people you don't know. Write like a person, not a marketer. Be specific. Be direct. Sound like yourself.`;

// ─── Training examples ────────────────────────────────────────────────────────
// Sources:
//  - 4 real emails extracted verbatim from screenshots (user-provided, April 2026)
//  - Natural human writing samples: Reddit posts, personal blogs, casual correspondence
//    that demonstrate the register we want (specific, unperformed, direct)
// Goal: train away from "performed professional" register toward natural human voice.
// ─────────────────────────────────────────────────────────────────────────────
const EXAMPLES = [

  // ── REAL EMAILS — verbatim from screenshots ────────────────────────────────

  {},
];

// ─── Format into OpenAI fine-tune JSONL ──────────────────────────────────────
function formatTrainingData(examples) {
  return examples.map(ex => JSON.stringify({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: ex.context },
      { role: 'assistant', content: ex.email },
    ]
  })).join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // --list
  if (args.includes('--list')) {
    const jobs = await openai.fineTuning.jobs.list({ limit: 10 });
    console.log('\nFine-tune jobs:\n');
    for (const job of jobs.data) {
      console.log(`  ${job.id}  ${job.status}  model: ${job.fine_tuned_model || '(pending)'}  created: ${new Date(job.created_at * 1000).toLocaleDateString()}`);
    }
    return;
  }

  // --cancel
  if (args.includes('--cancel')) {
    const jobId = args[args.indexOf('--cancel') + 1];
    if (!jobId) { console.error('Provide job ID: --cancel <job-id>'); process.exit(1); }
    const job = await openai.fineTuning.jobs.cancel(jobId);
    console.log(`Cancelled: ${job.id}  status: ${job.status}`);
    return;
  }

  // --status
  if (args.includes('--status')) {
    const jobId = args[args.indexOf('--status') + 1] || process.env.FINETUNE_JOB_ID;
    if (!jobId) {
      console.error('Provide job ID: --status ft-job-id  or set FINETUNE_JOB_ID in .env');
      process.exit(1);
    }
    const job = await openai.fineTuning.jobs.retrieve(jobId);
    console.log(`\nJob: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Model: ${job.fine_tuned_model || '(not ready yet)'}`);
    console.log(`Trained tokens: ${job.trained_tokens || 'N/A'}`);
    if (job.fine_tuned_model) {
      console.log(`\nAdd to .env:\nFINETUNE_MODEL_ID=${job.fine_tuned_model}`);
    }
    return;
  }

  // ── default: upload + start fine-tune ────────────────────────────────────
  let tmpPath;
  let jsonl;

  // --file: use pre-built JSONL (e.g. from scrape-reddit-training.js)
  if (args.includes('--file')) {
    const filePath = args[args.indexOf('--file') + 1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('File not found. Usage: --file path/to/training.jsonl');
      process.exit(1);
    }
    jsonl = fs.readFileSync(filePath, 'utf8');
    const lineCount = jsonl.trim().split('\n').length;
    console.log(`\nUsing pre-built JSONL: ${filePath} (${lineCount} examples)`);
    tmpPath = filePath; // upload directly
  } else {
    console.log(`\nFormatting ${EXAMPLES.length} training examples...`);
    jsonl = formatTrainingData(EXAMPLES);
    tmpPath = path.join(__dirname, '_training_data.jsonl');
    fs.writeFileSync(tmpPath, jsonl);
    console.log(`Written to ${tmpPath}`);
  }

  console.log('\nUploading to OpenAI...');
  const file = await openai.files.create({
    file: fs.createReadStream(tmpPath),
    purpose: 'fine-tune',
  });
  console.log(`File uploaded: ${file.id}`);

  console.log('\nStarting fine-tune job on gpt-4.1...');
  const job = await openai.fineTuning.jobs.create({
    training_file: file.id,
    model: 'gpt-4.1-2025-04-14',
    hyperparameters: {
      n_epochs: 4,
    },
    suffix: 'meridian-cold-email',
  });

  console.log(`\nJob started: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`\nTypically takes 15-60 minutes. Check status with:`);
  console.log(`  node scripts_me/finetune-cold-email.js --status ${job.id}`);
  console.log(`\nOr add to .env to auto-check:`);
  console.log(`  FINETUNE_JOB_ID=${job.id}`);

  // clean up tmp file (only if we created it, not if --file was passed)
  if (!args.includes('--file')) fs.unlinkSync(tmpPath);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
