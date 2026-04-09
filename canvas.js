import https from 'https';

const TOKEN = process.env.CANVAS_TOKEN || '26275~BHMHU6KQPExrzY6DaNJJwN2EQnANMewfKwvwERJRLkFDJxVWKUHBeweYW3UTWDta';
const BASE_URL = 'https://canvas.ualberta.ca/api/v1';

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { Authorization: `Bearer ${TOKEN}` },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const COURSE_ID = 30401; // MATH 134

  const [groups, assignments, submissions] = await Promise.all([
    get(`/courses/${COURSE_ID}/assignment_groups`),
    get(`/courses/${COURSE_ID}/assignments?per_page=100`),
    get(`/courses/${COURSE_ID}/students/submissions?student_ids[]=self&per_page=100`),
  ]);

  const assignmentMap = {};
  for (const a of assignments) assignmentMap[a.id] = a;

  // Group scores by assignment_group_id
  const groupScores = {};
  for (const sub of submissions) {
    const a = assignmentMap[sub.assignment_id];
    if (!a || sub.score == null || a.points_possible == null || a.points_possible === 0) continue;
    const gid = a.assignment_group_id;
    if (!groupScores[gid]) groupScores[gid] = { earned: 0, possible: 0 };
    groupScores[gid].earned += sub.score;
    groupScores[gid].possible += a.points_possible;
  }

  console.log('MATH 134 Weighted Grade Breakdown:\n');
  let weightedScore = 0;
  for (const g of groups) {
    if (!g.group_weight || g.group_weight === 0) continue;
    const s = groupScores[g.id];
    if (!s || s.possible === 0) {
      console.log(`  ${g.name} (${g.group_weight}%): No graded work yet`);
      continue;
    }
    const pct = (s.earned / s.possible) * 100;
    const contribution = (pct / 100) * g.group_weight;
    weightedScore += contribution;
    console.log(`  ${g.name} (${g.group_weight}%): ${pct.toFixed(1)}% → +${contribution.toFixed(2)}%`);
  }

  console.log(`\n--- Weighted points earned so far: ${weightedScore.toFixed(2)} / 50 (final not yet taken) ---`);
  const currentGrade = (weightedScore / 50) * 100;
  console.log(`--- Current grade on graded work: ${currentGrade.toFixed(1)}% ---\n`);

  // What final score is needed for target overall grades
  const targets = [50, 60, 70, 80];
  console.log('What you need on the final (worth 50%):');
  for (const target of targets) {
    const needed = ((target - weightedScore) / 50) * 100;
    console.log(`  To get ${target}% overall → need ${needed.toFixed(1)}% on final`);
  }
}

main().catch(console.error);
