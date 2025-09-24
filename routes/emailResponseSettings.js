// Email Response Settings API Route
import express from 'express';
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);

// Zilliz client setup
const milvusClient = new MilvusClient({
  address: process.env.ZILLIZ_ENDPOINT?.trim(),
  token: process.env.ZILLIZ_TOKEN?.trim(),
});

async function ensureEmailResponseSettingsCollection() {
  try {
    // Just load the existing agent_settings collection
    await milvusClient.loadCollection({ collection_name: 'agent_settings' });
    console.log('[EMAIL-RESPONSE] Using existing agent_settings collection');
  } catch (error) {
    console.error('[EMAIL-RESPONSE] Error loading collection:', error);
    throw error;
  }
}

// GET /api/email-response-settings
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[EMAIL-RESPONSE] Getting settings for user: ${userId}`);
    
    // Extract first 8 characters for user code
    const userCode = userId.substring(0, 8);
    
    await ensureEmailResponseSettingsCollection();
    
    const result = await milvusClient.query({
      collection_name: 'agent_settings',
      expr: `setting_key == "email_response_settings" && user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
      output_fields: ['setting_value', 'updated_at'],
      limit: 1,
      consistency_level: 'Strong'
    });
    
    const rows = result.data || result || [];
    
    if (rows.length === 0) {
      // Return default settings
      const defaultSettings = {
        calendar_id: 'colton.fidd@gmail.com',
        company_name: 'Exabits',
        timezone: 'America/Los_Angeles',
        response_tone: 'professional_friendly'
      };
      
      res.json({
        success: true,
        userId: userId,
        settings: defaultSettings,
        isDefault: true
      });
      return;
    }
    
    const settings = JSON.parse(rows[0].setting_value);
    
    res.json({
      success: true,
      userId: userId,
      settings: settings,
      updated_at: rows[0].updated_at,
      isDefault: false
    });
    
  } catch (error) {
    console.error('[EMAIL-RESPONSE] Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email-response-settings
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    const settings = req.body;
    
    // Extract first 8 characters for user code
    const userCode = userId.substring(0, 8);
    
    console.log(`[EMAIL-RESPONSE] Saving settings for user: ${userId} (code: ${userCode})`);
    console.log('[EMAIL-RESPONSE] Settings:', settings);
    
    await ensureEmailResponseSettingsCollection();
    
    const now = new Date().toISOString();
    const settingsJson = JSON.stringify(settings);
    
    // Delete existing email response settings record for this user (UPSERT approach)
    try {
      const deleteResult = await milvusClient.delete({
        collection_name: 'agent_settings',
        expr: `setting_key == "email_response_settings" && user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`
      });
      console.log(`[EMAIL-RESPONSE] Deleted ${deleteResult.delete_count || 0} existing records for user ${userCode}`);
    } catch (deleteError) {
      console.log(`[EMAIL-RESPONSE] No existing record to delete for user ${userCode}:`, deleteError.message);
    }
    
    // Insert new record with all email response settings as JSON (UPDATE by replace)
    const insertResult = await milvusClient.insert({
      collection_name: 'agent_settings',
      data: [{
        setting_key: 'email_response_settings',
        setting_value: settingsJson,
        setting_type: 'email_response',
        updated_at: now,
        user_id: userCode, // Use 8-character code
        dummy_vector: [0.1, 0.2] // Required vector field
      }]
    });
    
    console.log(`[EMAIL-RESPONSE] Settings saved successfully for user ${userCode}. Insert count: ${insertResult.insert_count}`);
    
    // Verify the update was successful by checking for duplicates
    try {
      const verifyResult = await milvusClient.query({
        collection_name: 'agent_settings',
        expr: `setting_key == "email_response_settings" && user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
        output_fields: ['setting_key', 'user_id', 'updated_at']
      });
      
      if (verifyResult.data.length > 1) {
        console.warn(`[EMAIL-RESPONSE] Warning: Found ${verifyResult.data.length} records for user ${userCode}. Should only be 1.`);
      } else {
        console.log(`[EMAIL-RESPONSE] Verified: Exactly ${verifyResult.data.length} record exists for user ${userCode}`);
      }
    } catch (verifyError) {
      console.log('[EMAIL-RESPONSE] Could not verify record count:', verifyError.message);
    }
    
    res.json({
      success: true,
      userId: userId,
      settings: settings,
      updated_at: now,
      message: 'Email response settings updated successfully (no duplicates)'
    });
    
  } catch (error) {
    console.error('[EMAIL-RESPONSE] Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
