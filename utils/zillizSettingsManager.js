// Simplified Zilliz Settings Manager - Handles single JSON field storage
import 'dotenv/config';
import { MilvusClient } from "@zilliz/milvus2-sdk-node";

export class ZillizSettingsManager {
  constructor() {
    this.milvusClient = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT?.trim(),
      token: process.env.ZILLIZ_TOKEN?.trim(),
    });
  }

  // Helper to get user code (first 8 chars)
  getUserCode(userId) {
    return userId.substring(0, 8);
  }

  // === USER SETTINGS METHODS ===

  async getUserSettings(userId) {
    try {
      const userCode = this.getUserCode(userId);
      
      await this.milvusClient.loadCollection({ collection_name: 'user_settings' });
      
      const result = await this.milvusClient.query({
        collection_name: 'user_settings',
        expr: `user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
        output_fields: ['settings_data', 'updated_at'],
        limit: 1,
        consistency_level: 'Strong'
      });

      const rows = result.data || result || [];
      
      if (rows.length === 0) {
        console.log(`[ZILLIZ-SETTINGS] No user settings found for ${userCode}, returning defaults`);
        return this.getDefaultUserSettings();
      }

      const settingsData = rows[0].settings_data;
      
      // Return the complete settings object or defaults if missing
      return settingsData || this.getDefaultUserSettings();

    } catch (error) {
      console.error('[ZILLIZ-SETTINGS] Error getting user settings:', error);
      return this.getDefaultUserSettings();
    }
  }

  async saveUserSettings(userId, settings) {
    try {
      const userCode = this.getUserCode(userId);
      
      console.log(`[ZILLIZ-SETTINGS] Saving user settings for ${userCode}...`);

      await this.milvusClient.loadCollection({ collection_name: 'user_settings' });

      // Delete existing settings for this user
      try {
        const deleteResult = await this.milvusClient.delete({
          collection_name: 'user_settings',
          expr: `user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
        });
        console.log(`[ZILLIZ-SETTINGS] Existing user settings deleted for ${userCode}`);
      } catch (deleteError) {
        console.log(`[ZILLIZ-SETTINGS] No existing user settings to delete for ${userCode}`);
      }

      // Insert new settings
      const timestamp = new Date().toISOString();
      const insertData = [
        {
          user_id: userCode,
          settings_data: settings,
          created_at: timestamp,
          updated_at: timestamp,
          vector: [0.0, 1.0] // Dummy vector values
        }
      ];

      const insertResult = await this.milvusClient.insert({
        collection_name: 'user_settings',
        data: insertData,
      });

      // Flush to ensure data is persisted
      await this.milvusClient.flushSync({ collection_names: ['user_settings'] });

      console.log(`[ZILLIZ-SETTINGS] User settings saved successfully for ${userCode}. Insert count: ${insertResult.insert_cnt}`);
      return true;

    } catch (error) {
      console.error('[ZILLIZ-SETTINGS] Error saving user settings:', error);
      throw error;
    }
  }

  getDefaultUserSettings() {
    return {
      preferences: {
        username: '',
        email: '',
        notifications: true,
        theme: 'light'
      },
      aiPersonality: {
        tone: 'professional',
        style: 'concise',
        creativity: 'balanced'
      }
    };
  }

  // === LEAD AGENT SETTINGS METHODS ===

  async getLeadAgentSettings(userId) {
    try {
      const userCode = this.getUserCode(userId);
      
      await this.milvusClient.loadCollection({ collection_name: 'lead_agent_settings' });
      
      const result = await this.milvusClient.query({
        collection_name: 'lead_agent_settings',
        expr: `user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
        output_fields: ['lead_settings_data', 'updated_at'],
        limit: 1,
        consistency_level: 'Strong'
      });

      const rows = result.data || result || [];
      
      if (rows.length === 0) {
        console.log(`[ZILLIZ-SETTINGS] No lead agent settings found for ${userCode}`);
        return null;
      }

      const leadSettingsData = rows[0].lead_settings_data;
      
      return leadSettingsData || null;

    } catch (error) {
      console.error('[ZILLIZ-SETTINGS] Error getting lead agent settings:', error);
      return null;
    }
  }

  async saveLeadAgentSettings(userId, settings) {
    try {
      const userCode = this.getUserCode(userId);
      
      console.log(`[ZILLIZ-SETTINGS] Saving lead agent settings for ${userCode}...`);

      await this.milvusClient.loadCollection({ collection_name: 'lead_agent_settings' });

      // Delete existing settings for this user
      try {
        const deleteResult = await this.milvusClient.delete({
          collection_name: 'lead_agent_settings',
          expr: `user_id == "${userCode.replace(/["\\]/g, '\\$&')}"`,
        });
        console.log(`[ZILLIZ-SETTINGS] Existing lead agent settings deleted for ${userCode}`);
      } catch (deleteError) {
        console.log(`[ZILLIZ-SETTINGS] No existing lead agent settings to delete for ${userCode}`);
      }

      // Insert new settings
      const timestamp = new Date().toISOString();
      const insertData = [
        {
          user_id: userCode,
          lead_settings_data: settings,
          created_at: timestamp,
          updated_at: timestamp,
          vector: [0.0, 1.0] // Dummy vector values
        }
      ];

      const insertResult = await this.milvusClient.insert({
        collection_name: 'lead_agent_settings',
        data: insertData,
      });

      // Flush to ensure data is persisted
      await this.milvusClient.flushSync({ collection_names: ['lead_agent_settings'] });

      console.log(`[ZILLIZ-SETTINGS] Lead agent settings saved successfully for ${userCode}. Insert count: ${insertResult.insert_cnt}`);
      return true;

    } catch (error) {
      console.error('[ZILLIZ-SETTINGS] Error saving lead agent settings:', error);
      throw error;
    }
  }

  // === UTILITY METHODS ===

  async getCollectionStats() {
    try {
      await this.milvusClient.loadCollection({ collection_name: 'user_settings' });
      await this.milvusClient.loadCollection({ collection_name: 'lead_agent_settings' });
      
      const userStats = await this.milvusClient.getCollectionStatistics({ collection_name: 'user_settings' });
      const leadStats = await this.milvusClient.getCollectionStatistics({ collection_name: 'lead_agent_settings' });
      
      return {
        user_settings: userStats.data.row_count || 0,
        lead_agent_settings: leadStats.data.row_count || 0
      };
    } catch (error) {
      console.error('[ZILLIZ-SETTINGS] Error getting collection stats:', error);
      return { user_settings: 0, lead_agent_settings: 0 };
    }
  }
}

// Create singleton instance
const zillizSettingsManager = new ZillizSettingsManager();
export default zillizSettingsManager;