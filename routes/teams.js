import express from 'express';
import { authenticateToken, generateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

// Strongly-consistent read for post-write token generation
async function getUser(userId) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: fromNodeProviderChain(),
  }));
  const r = await client.send(new GetCommand({
    TableName: process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users',
    Key: { userId },
    ConsistentRead: true,
  }));
  return r.Item || null;
}

const router = express.Router();

/**
 * GET /api/teams/invite/:token
 * Get basic team info for an invite token (no auth required — shown on join/onboarding page)
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const aws = new AWSManager();
    const team = await aws.getTeamByInviteToken(req.params.token);
    if (!team) return res.status(404).json({ success: false, error: 'Invalid or expired invite link.' });
    res.json({ success: true, team: { teamId: team.teamId, name: team.name, memberCount: team.members?.length ?? 1 } });
  } catch (error) {
    console.error('[TEAMS] Error looking up invite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// All remaining routes require auth
router.use(authenticateToken);

/**
 * GET /api/teams/me
 * Get the current user's team (or null if none)
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    res.json({ success: true, team: team || null });
  } catch (error) {
    console.error('[TEAMS] Error getting team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/teams/create
 * Create a new team. Caller becomes owner.
 */
router.post('/create', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();

    // Prevent creating a second team
    const existing = await aws.getTeamByUserId(userId);
    if (existing) {
      return res.status(409).json({ success: false, error: 'You are already in a team.' });
    }

    const user = await aws.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const { name } = req.body;
    const team = await aws.createTeam(userId, user.email, user.username, name);

    // Consistent read so teamId/teamRole are guaranteed present in the new token
    const freshUser = await getUser(userId);
    const token = generateToken(freshUser);
    res.json({ success: true, team, token });
  } catch (error) {
    console.error('[TEAMS] Error creating team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/teams/invite/refresh
 * Generate a new invite token for the team (owner only)
 */
router.post('/invite/refresh', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    if (!team) return res.status(404).json({ success: false, error: 'No team found.' });
    if (team.ownerId !== userId) return res.status(403).json({ success: false, error: 'Only the team owner can refresh the invite link.' });

    const inviteToken = await aws.refreshTeamInviteToken(team.teamId);
    res.json({ success: true, inviteToken });
  } catch (error) {
    console.error('[TEAMS] Error refreshing invite token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/teams/invite/:token/accept
 * Join a team via invite token
 */
router.post('/invite/:token/accept', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();

    const existingTeam = await aws.getTeamByUserId(userId);
    if (existingTeam) return res.status(409).json({ success: false, error: 'You are already in a team. Leave it first.' });

    const team = await aws.getTeamByInviteToken(req.params.token);
    if (!team) return res.status(404).json({ success: false, error: 'Invalid or expired invite link.' });

    // Prevent owner from accepting their own invite (they're already in the team)
    if (team.ownerId === userId) return res.status(400).json({ success: false, error: 'You created this team.' });

    const user = await aws.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    await aws.addTeamMember(team.teamId, user);

    // Consistent read so proxyUserId is guaranteed present in the new token
    const freshUser = await getUser(userId);
    const token = generateToken(freshUser);
    res.json({ success: true, teamId: team.teamId, proxyUserId: team.ownerId, token });
  } catch (error) {
    console.error('[TEAMS] Error accepting invite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/teams/members/:memberId/role
 * Update a member's role (owner only)
 */
router.patch('/members/:memberId/role', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const { memberId } = req.params;
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ success: false, error: 'Invalid role. Use admin or member.' });

    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    if (!team) return res.status(404).json({ success: false, error: 'No team found.' });
    if (team.ownerId !== userId) return res.status(403).json({ success: false, error: 'Only the owner can change roles.' });
    if (memberId === userId) return res.status(400).json({ success: false, error: 'Cannot change owner role.' });

    await aws.updateTeamMemberRole(team.teamId, memberId, role);
    res.json({ success: true });
  } catch (error) {
    console.error('[TEAMS] Error updating role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/teams/members/:memberId
 * Remove a member (owner only)
 */
router.delete('/members/:memberId', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const { memberId } = req.params;
    if (memberId === userId) return res.status(400).json({ success: false, error: 'Use /leave to leave the team, or /disband to delete it.' });

    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    if (!team) return res.status(404).json({ success: false, error: 'No team found.' });
    if (team.ownerId !== userId) return res.status(403).json({ success: false, error: 'Only the owner can remove members.' });

    await aws.removeTeamMember(team.teamId, memberId);
    res.json({ success: true });
  } catch (error) {
    console.error('[TEAMS] Error removing member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/teams/leave
 * Leave a team (non-owners only)
 */
router.post('/leave', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    if (!team) return res.status(404).json({ success: false, error: 'You are not in a team.' });
    if (team.ownerId === userId) return res.status(400).json({ success: false, error: 'Owners cannot leave. Use disband to delete the team.' });

    await aws.removeTeamMember(team.teamId, userId);

    // Consistent read guarantees proxyUserId is gone before issuing new token
    const freshUser = await getUser(userId);
    const token = generateToken(freshUser);
    res.json({ success: true, token });
  } catch (error) {
    console.error('[TEAMS] Error leaving team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/teams
 * Disband the team entirely (owner only)
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId;
    const aws = new AWSManager();
    const team = await aws.getTeamByUserId(userId);
    if (!team) return res.status(404).json({ success: false, error: 'No team found.' });
    if (team.ownerId !== userId) return res.status(403).json({ success: false, error: 'Only the owner can disband the team.' });

    await aws.disbandTeam(team.teamId);
    res.json({ success: true });
  } catch (error) {
    console.error('[TEAMS] Error disbanding team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
