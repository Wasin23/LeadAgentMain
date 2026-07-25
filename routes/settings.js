import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import AWSManager from '../utils/awsManager.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/settings/presets
 * Get all settings presets for user
 */
router.get('/presets', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    const presets = userSettings?.settingsPresets || [];
    
    console.log('📦 [SETTINGS] Fetching presets from AWS, count:', presets.length);
    if (presets.length > 0) {
      console.log('📦 [SETTINGS] First preset example:', JSON.stringify(presets[0], null, 2));
    }
    
    res.json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Error getting presets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/settings/presets
 * Create a new settings preset
 */
router.post('/presets', async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('📥 [SETTINGS] Received preset creation request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      name, 
      targetIndustries, 
      targetPositions, 
      companySizeMin, 
      companySizeMax, 
      leadLimit,
      emailLength,
      callToAction,
      personalizationLevel,
      ccEmails,
      bccEmails,
      followupIntervalDays,
      enableAutoResponse,
      useCustomSignature,
      signatureName,
      signatureTitle,
      specialInstructions,
      writingRules,
      includeChatLink,
      chatLinkInstructions
    } = req.body;

    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};

    const newPreset = {
      id: uuidv4(),
      name,
      targetIndustries,
      targetPositions,
      companySizeMin,
      companySizeMax,
      leadLimit,
      emailLength: emailLength || 'medium',
      callToAction: callToAction || 'schedule-meeting',
      personalizationLevel: personalizationLevel || 'high',
      ccEmails: ccEmails || '',
      bccEmails: bccEmails || '',
      followupIntervalDays: followupIntervalDays || 7,
      enableAutoResponse: enableAutoResponse !== undefined ? enableAutoResponse : true,
      useCustomSignature: useCustomSignature || false,
      signatureName: signatureName || '',
      signatureTitle: signatureTitle || '',
      specialInstructions: specialInstructions || '',
      writingRules: writingRules || '',
      includeChatLink: includeChatLink || false,
      chatLinkInstructions: chatLinkInstructions || '',
      createdAt: new Date().toISOString()
    };
    
    userSettings.settingsPresets = [...(userSettings.settingsPresets || []), newPreset];
    
    console.log('💾 [SETTINGS] Saving preset to AWS:', JSON.stringify(newPreset, null, 2));
    await awsManager.saveUserSettings(userId, userSettings);
    
    console.log('✅ [SETTINGS] Returning preset to frontend:', JSON.stringify(newPreset, null, 2));
    res.json({
      success: true,
      preset: newPreset
    });
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/settings/presets/:id
 * Delete a settings preset
 */
router.delete('/presets/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    userSettings.settingsPresets = (userSettings.settingsPresets || []).filter(p => p.id !== id);
    
    await awsManager.saveUserSettings(userId, userSettings);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/settings/presets/:id
 * Update a settings preset
 */
router.put('/presets/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { 
      name, 
      targetIndustries, 
      targetPositions, 
      companySizeMin, 
      companySizeMax, 
      leadLimit,
      emailLength,
      callToAction,
      personalizationLevel,
      ccEmails,
      bccEmails,
      followupIntervalDays,
      enableAutoResponse,
      useCustomSignature,
      signatureName,
      signatureTitle,
      specialInstructions,
      writingRules,
      includeChatLink,
      chatLinkInstructions
    } = req.body;
    
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(userId) || {};
    
    const presetIndex = (userSettings.settingsPresets || []).findIndex(p => p.id === id);
    
    if (presetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }
    
    const updatedPreset = {
      ...userSettings.settingsPresets[presetIndex],
      name,
      targetIndustries,
      targetPositions,
      companySizeMin,
      companySizeMax,
      leadLimit,
      emailLength: emailLength || 'medium',
      callToAction: callToAction || 'schedule-meeting',
      personalizationLevel: personalizationLevel || 'high',
      ccEmails: ccEmails || '',
      bccEmails: bccEmails || '',
      followupIntervalDays: followupIntervalDays || 7,
      enableAutoResponse: enableAutoResponse || false,
      useCustomSignature: useCustomSignature || false,
      signatureName: signatureName || '',
      signatureTitle: signatureTitle || '',
      specialInstructions: specialInstructions || '',
      writingRules: writingRules || '',
      includeChatLink: includeChatLink || false,
      chatLinkInstructions: chatLinkInstructions || '',
      updatedAt: new Date().toISOString()
    };
    
    userSettings.settingsPresets[presetIndex] = updatedPreset;
    
    await awsManager.saveUserSettings(userId, userSettings);
    
    res.json({
      success: true,
      preset: updatedPreset
    });
  } catch (error) {
    console.error('Error updating preset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/settings/notifications
 * Returns the user's notification preferences.
 */
router.get('/notifications', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    res.json({
      success: true,
      settings: userSettings.notificationSettings || { emailEnabled: true, smsEnabled: false, phone: '' }
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/settings/notifications
 * Saves the user's notification preferences.
 * Body: { emailEnabled?: boolean, smsEnabled?: boolean, phone?: string }
 */
router.put('/notifications', async (req, res) => {
  try {
    const { emailEnabled, smsEnabled, phone } = req.body;

    // Validate phone if provided
    const cleanPhone = typeof phone === 'string' ? phone.replace(/\s/g, '') : '';
    if (cleanPhone && !/^\+?[1-9]\d{6,14}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number. Use E.164 format, e.g. +15551234567'
      });
    }

    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    userSettings.notificationSettings = {
      emailEnabled: emailEnabled !== false,  // default true unless explicitly false
      smsEnabled:   !!smsEnabled,
      phone:        cleanPhone,
    };
    await awsManager.saveUserSettings(req.user.userId, userSettings);

    res.json({ success: true, settings: userSettings.notificationSettings });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/settings/auto-topup
 * Returns the user's auto top-up preferences.
 */
router.get('/auto-topup', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    res.json({
      success: true,
      settings: userSettings.autoTopup || { enabled: false, threshold: 50, tierId: 'small' }
    });
  } catch (error) {
    console.error('Error getting auto top-up settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/settings/auto-topup
 * Saves the user's auto top-up preferences.
 * Body: { enabled: boolean, threshold: number, tierId: string }
 */
router.put('/auto-topup', async (req, res) => {
  try {
    const { enabled, threshold, tierId } = req.body;
    const validTiers = ['mini', 'small', 'medium', 'bulk'];
    if (tierId && !validTiers.includes(tierId)) {
      return res.status(400).json({ success: false, error: 'Invalid tier ID' });
    }
    if (threshold !== undefined && (typeof threshold !== 'number' || threshold < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid threshold value' });
    }
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    userSettings.autoTopup = {
      enabled: !!enabled,
      threshold: typeof threshold === 'number' ? threshold : 50,
      tierId: validTiers.includes(tierId) ? tierId : 'small',
    };
    await awsManager.saveUserSettings(req.user.userId, userSettings);
    res.json({ success: true, settings: userSettings.autoTopup });
  } catch (error) {
    console.error('Error saving auto top-up settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/settings/sending-schedule
 * Returns the user's global sending schedule (one per account, not per agent — every
 * agent's queued emails and eligible follow-ups share this schedule's daily slots).
 */
router.get('/sending-schedule', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const { getPlanDailyCap } = await import('../utils/dailySendCaps.js');
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    const planDailyCap = await getPlanDailyCap(req.user.userId).catch(() => 50);
    res.json({ success: true, schedule: userSettings.sendingSchedule || null, planDailyCap });
  } catch (error) {
    console.error('Error getting sending schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/settings/sending-schedule
 * Saves (or, with `schedule: null`, clears) the user's global sending schedule.
 * Body: { schedule: { activeDays: number[], sendTime: string, timezone: string, mainPerDay: number, followUpPerDay: number } | null }
 */
router.put('/sending-schedule', async (req, res) => {
  try {
    const { schedule } = req.body;

    const awsManager = new AWSManager();
    let normalized = null;
    if (schedule !== null) {
      const { getPlanDailyCap } = await import('../utils/dailySendCaps.js');
      const planCap = await getPlanDailyCap(req.user.userId).catch(() => 50);
      try { normalized = normalizeScheduleFields(schedule, planCap); }
      catch (e) { return res.status(e.status || 400).json({ success: false, error: e.message }); }
    }

    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    userSettings.sendingSchedule = normalized;

    // A manual edit that no longer matches the previously-applied named schedule means
    // the "Schedule for Send" button can no longer honestly show that name.
    const stillMatches = userSettings.activeSavedScheduleId && (userSettings.savedSchedules || [])
      .find(s => s.id === userSettings.activeSavedScheduleId
        && JSON.stringify({ ...s, id: undefined, name: undefined, createdAt: undefined, updatedAt: undefined })
           === JSON.stringify({ ...userSettings.sendingSchedule, id: undefined, name: undefined, createdAt: undefined, updatedAt: undefined }));
    if (!stillMatches) userSettings.activeSavedScheduleId = null;

    await awsManager.saveUserSettings(req.user.userId, userSettings);

    const { syncGlobalScheduleForUser } = await import('../utils/scheduleSlots.js');
    await syncGlobalScheduleForUser(req.user.userId, { awsManager, schedule: userSettings.sendingSchedule }).catch(syncError => {
      console.error('[SETTINGS] Failed to sync schedule after save:', syncError.message);
    });

    res.json({ success: true, schedule: userSettings.sendingSchedule });
  } catch (error) {
    console.error('Error saving sending schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Saved schedules — named presets of the sending schedule, switchable at will ────────────
// Unlike settingsPresets (copy-once, no memory of which was applied), these track which one
// is currently live via userSettings.activeSavedScheduleId, so the "Schedule for Send"
// button can show its real name.

// `planCap` is the account's actual plan-tier daily sending ceiling (utils/dailySendCaps.js)
// — main + follow-ups share it, so it's not just "clamp each to 50" anymore. Main gets
// priority for the shared cap; follow-ups get whatever's left over.
function normalizeScheduleFields(body, planCap) {
  if (!Array.isArray(body?.activeDays) || !body.activeDays.length) {
    throw Object.assign(new Error('activeDays must be a non-empty array'), { status: 400 });
  }
  if (typeof body.sendTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.sendTime)) {
    throw Object.assign(new Error('sendTime must be "HH:MM"'), { status: 400 });
  }
  const cap = planCap || 50;
  const mainPerDay = Math.min(cap, Math.max(1, parseInt(body.mainPerDay, 10) || 1));
  const followUpPerDay = Math.min(Math.max(0, cap - mainPerDay), Math.max(0, parseInt(body.followUpPerDay, 10) || 0));
  return {
    activeDays: body.activeDays,
    sendTime: body.sendTime,
    timezone: body.timezone || 'America/New_York',
    mainPerDay,
    followUpPerDay,
  };
}

/**
 * GET /api/settings/saved-schedules
 */
router.get('/saved-schedules', async (req, res) => {
  try {
    const awsManager = new AWSManager();
    const { getPlanDailyCap } = await import('../utils/dailySendCaps.js');
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    const planDailyCap = await getPlanDailyCap(req.user.userId).catch(() => 50);
    res.json({
      success: true,
      schedules: userSettings.savedSchedules || [],
      activeSavedScheduleId: userSettings.activeSavedScheduleId || null,
      planDailyCap,
    });
  } catch (error) {
    console.error('Error getting saved schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/settings/saved-schedules
 * Body: { name: string, activeDays, sendTime, timezone, mainPerDay, followUpPerDay }
 */
router.post('/saved-schedules', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const { getPlanDailyCap } = await import('../utils/dailySendCaps.js');
    const planCap = await getPlanDailyCap(req.user.userId).catch(() => 50);
    let fields;
    try { fields = normalizeScheduleFields(req.body, planCap); }
    catch (e) { return res.status(e.status || 400).json({ success: false, error: e.message }); }

    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    const now = new Date().toISOString();
    const newSchedule = { id: uuidv4(), name, ...fields, createdAt: now, updatedAt: now };

    userSettings.savedSchedules = [...(userSettings.savedSchedules || []), newSchedule];
    await awsManager.saveUserSettings(req.user.userId, userSettings);

    res.json({ success: true, schedule: newSchedule });
  } catch (error) {
    console.error('Error creating saved schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/settings/saved-schedules/:id
 */
router.put('/saved-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    if (name === '') return res.status(400).json({ success: false, error: 'Name cannot be empty' });

    const { getPlanDailyCap } = await import('../utils/dailySendCaps.js');
    const planCap = await getPlanDailyCap(req.user.userId).catch(() => 50);
    let fields;
    try { fields = normalizeScheduleFields(req.body, planCap); }
    catch (e) { return res.status(e.status || 400).json({ success: false, error: e.message }); }

    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    const list = userSettings.savedSchedules || [];
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Schedule not found' });

    const updated = { ...list[index], ...fields, name: name ?? list[index].name, updatedAt: new Date().toISOString() };
    list[index] = updated;
    userSettings.savedSchedules = list;

    // If this is the currently-applied schedule, push the edit live too — otherwise the
    // button would keep showing this name while actually sending on stale settings.
    if (userSettings.activeSavedScheduleId === id) {
      userSettings.sendingSchedule = { ...fields };
    }
    await awsManager.saveUserSettings(req.user.userId, userSettings);

    if (userSettings.activeSavedScheduleId === id) {
      const { syncGlobalScheduleForUser } = await import('../utils/scheduleSlots.js');
      await syncGlobalScheduleForUser(req.user.userId, { awsManager, schedule: userSettings.sendingSchedule }).catch(() => {});
    }

    res.json({ success: true, schedule: updated });
  } catch (error) {
    console.error('Error updating saved schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/settings/saved-schedules/:id
 */
router.delete('/saved-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    userSettings.savedSchedules = (userSettings.savedSchedules || []).filter(s => s.id !== id);
    // Deleting the applied schedule doesn't stop it from sending — just forgets its name.
    if (userSettings.activeSavedScheduleId === id) userSettings.activeSavedScheduleId = null;
    await awsManager.saveUserSettings(req.user.userId, userSettings);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/settings/saved-schedules/:id/apply
 * Copies the named schedule's fields into the live sendingSchedule and remembers the name.
 */
router.post('/saved-schedules/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const awsManager = new AWSManager();
    const userSettings = await awsManager.getUserSettings(req.user.userId) || {};
    const target = (userSettings.savedSchedules || []).find(s => s.id === id);
    if (!target) return res.status(404).json({ success: false, error: 'Schedule not found' });

    userSettings.sendingSchedule = {
      activeDays: target.activeDays,
      sendTime: target.sendTime,
      timezone: target.timezone,
      mainPerDay: target.mainPerDay,
      followUpPerDay: target.followUpPerDay,
    };
    userSettings.activeSavedScheduleId = id;
    await awsManager.saveUserSettings(req.user.userId, userSettings);

    const { syncGlobalScheduleForUser } = await import('../utils/scheduleSlots.js');
    await syncGlobalScheduleForUser(req.user.userId, { awsManager, schedule: userSettings.sendingSchedule }).catch(syncError => {
      console.error('[SETTINGS] Failed to sync schedule after apply:', syncError.message);
    });

    res.json({ success: true, schedule: userSettings.sendingSchedule, appliedName: target.name });
  } catch (error) {
    console.error('Error applying saved schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
