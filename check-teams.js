/**
 * Inspect the teams table and show stale/orphaned records.
 * Usage: node check-teams.js [teamId|email]
 *   no arg   → list all teams
 *   teamId   → show one team by ID
 *   email    → show the team owned/joined by that user
 */

import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromNodeProviderChain(),
}));

const TEAMS_TABLE  = process.env.AWS_DYNAMODB_TEAMS_TABLE  || 'meridian-teams';
const USERS_TABLE  = process.env.AWS_DYNAMODB_USERS_TABLE  || 'meridian-users';

async function getUserById(userId) {
  const r = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  return r.Item || null;
}

async function getUserByEmail(email) {
  const r = await db.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: 'email = :e',
    ExpressionAttributeValues: { ':e': email },
  }));
  return r.Items?.[0] || null;
}

async function printTeam(team) {
  console.log('\n── TEAM ───────────────────────────────────────────');
  console.log(`teamId:      ${team.teamId}`);
  console.log(`name:        ${team.name || '(none)'}`);
  console.log(`ownerId:     ${team.ownerId}`);
  console.log(`inviteToken: ${team.inviteToken || '(none)'}`);
  console.log(`createdAt:   ${team.createdAt}`);

  const owner = await getUserById(team.ownerId);
  if (owner) {
    console.log(`owner:       ${owner.username} <${owner.email}> ✅`);
  } else {
    console.log(`owner:       ⚠️  USER RECORD MISSING (stale team)`);
  }

  const members = team.members || [];
  console.log(`\nmembers (${members.length}):`);
  for (const m of members) {
    const user = await getUserById(m.userId);
    const exists = user ? '✅' : '⚠️  USER MISSING';
    console.log(`  • ${m.userId}  role=${m.role}  joined=${m.joinedAt}  ${exists}`);
    if (user) console.log(`    → ${user.username} <${user.email}>`);
  }
  console.log('');
}

const arg = process.argv[2];

if (!arg) {
  // List all teams
  const scan = await db.send(new ScanCommand({ TableName: TEAMS_TABLE }));
  const teams = scan.Items || [];
  console.log(`\n${teams.length} team(s) in ${TEAMS_TABLE}:`);
  for (const team of teams) await printTeam(team);
} else if (arg.includes('@')) {
  // Look up by email
  const user = await getUserByEmail(arg);
  if (!user) { console.log('No user found with that email.'); process.exit(1); }
  console.log(`User: ${user.username} (${user.userId})`);
  console.log(`  teamId:      ${user.teamId || '(none)'}`);
  console.log(`  teamRole:    ${user.teamRole || '(none)'}`);
  console.log(`  proxyUserId: ${user.proxyUserId || '(none)'}`);

  if (user.teamId) {
    const r = await db.send(new GetCommand({ TableName: TEAMS_TABLE, Key: { teamId: user.teamId } }));
    if (r.Item) await printTeam(r.Item);
    else console.log(`\n⚠️  teamId ${user.teamId} points to a NON-EXISTENT team record!`);
  }
} else {
  // Look up by teamId
  const r = await db.send(new GetCommand({ TableName: TEAMS_TABLE, Key: { teamId: arg } }));
  if (!r.Item) { console.log('No team found with that ID.'); process.exit(1); }
  await printTeam(r.Item);
}
