import 'dotenv/config';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

/**
 * Agent Settings Manager - Handles configurable AI response settings in Zilliz
 * Allows real-time updates between localhost and Netlify webhook
 */
export class AgentSettingsManager {
    constructor() {
        this.client = null;
        this.collectionName = 'agent_settings';
        this.initialized = false;
    }

    async initialize() {
        try {
            this.client = new MilvusClient({
                address: process.env.ZILLIZ_ENDPOINT,
                token: process.env.ZILLIZ_TOKEN
            });

            // Check if collection exists
            const collections = await this.client.listCollections();
            const collectionExists = collections.data.some(col => col.name === this.collectionName);

            if (!collectionExists) {
                await this.createSettingsCollection();
            }

            this.initialized = true;
            console.log('⚙️ [SETTINGS] Agent Settings Manager initialized successfully');
        } catch (error) {
            console.error('❌ [SETTINGS] Initialization failed:', error);
            throw error;
        }
    }

    async createSettingsCollection() {
        const schema = [
            {
                name: 'id',
                data_type: DataType.Int64,
                is_primary_key: true,
                autoID: true
            },
            {
                name: 'setting_key',
                data_type: DataType.VarChar,
                max_length: 100
            },
            {
                name: 'setting_value',
                data_type: DataType.VarChar,
                max_length: 5000  // Allow large JSON configurations
            },
            {
                name: 'setting_type',
                data_type: DataType.VarChar,
                max_length: 50   // 'company_info', 'response_style', 'knowledge_base', etc.
            },
            {
                name: 'updated_at',
                data_type: DataType.VarChar,
                max_length: 50
            },
            {
                name: 'user_id',
                data_type: DataType.VarChar,
                max_length: 100  // Support multi-user configurations
            },
            {
                name: 'dummy_vector',
                data_type: DataType.FloatVector,
                dim: 2
            }
        ];

        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: schema,
            description: 'Agent response settings and configurations'
        });

        console.log('⚙️ [SETTINGS] Agent settings collection created');

        // Wait for collection to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create index
        try {
            await this.client.createIndex({
                collection_name: this.collectionName,
                field_name: 'dummy_vector',
                index_type: 'FLAT',
                metric_type: 'L2'
            });
            console.log('⚙️ [SETTINGS] Index created successfully');
        } catch (indexError) {
            console.warn('⚠️ [SETTINGS] Index creation warning:', indexError.message);
        }
    }

    /**
     * Update or insert a setting (upsert operation)
     */
    async updateSetting(settingKey, settingValue, settingType = 'general', userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Load collection
            await this.client.loadCollection({ collection_name: this.collectionName });

            // Create a signature system - attach user code to settings
            const userCode = userId && typeof userId === 'string' ? userId.substring(0, 8) : 'default';
            
            // Add user signature to setting key for identification
            const signedSettingKey = `${settingKey}_user_${userCode}`;

            const data = [{
                setting_key: signedSettingKey,  // Include user code in the key itself
                setting_value: typeof settingValue === 'object' ? JSON.stringify(settingValue) : settingValue,
                setting_type: settingType,
                updated_at: new Date().toISOString(),
                user_id: userId,
                dummy_vector: [0.1, 0.2]  // Placeholder vector
            }];

            console.log(`⚙️ [SETTINGS] Updating setting with signature: ${signedSettingKey} (user: ${userCode})`);

            await this.client.upsert({
                collection_name: this.collectionName,
                data: data
            });

            console.log(`✅ [SETTINGS] Setting updated with user signature: ${signedSettingKey}`);
            return { success: true };

        } catch (error) {
            console.error('❌ [SETTINGS] Failed to update setting:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific setting
     */
    async getSetting(settingKey, userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            await this.client.loadCollection({ collection_name: this.collectionName });

            const searchResult = await this.client.search({
                collection_name: this.collectionName,
                vectors: [[0.1, 0.2]],
                search_params: { nprobe: 10 },
                limit: 100,
                output_fields: ['setting_key', 'setting_value', 'setting_type', 'updated_at', 'user_id']
            });

            if (searchResult.results && searchResult.results.length > 0) {
                for (const result of searchResult.results) {
                    if (result.setting_key === settingKey && result.user_id === userId) {
                        let value = result.setting_value;
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            // Keep as string if not valid JSON
                        }
                        
                        console.log(`📖 [SETTINGS] Retrieved setting: ${settingKey}`);
                        return { success: true, value: value, updated_at: result.updated_at };
                    }
                }
            }

            console.log(`📖 [SETTINGS] Setting not found: ${settingKey}`);
            return { success: false, error: 'Setting not found' };

        } catch (error) {
            console.error('❌ [SETTINGS] Failed to get setting:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all settings for a user
     */
    async getAllSettings(userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            await this.client.loadCollection({ collection_name: this.collectionName });

            const searchResult = await this.client.search({
                collection_name: this.collectionName,
                vectors: [[0.1, 0.2]],
                search_params: { nprobe: 10 },
                limit: 100,
                output_fields: ['setting_key', 'setting_value', 'setting_type', 'updated_at', 'user_id']
            });

            const settings = {};
            if (searchResult.results && searchResult.results.length > 0) {
                for (const result of searchResult.results) {
                    if (result.user_id === userId) {
                        let value = result.setting_value;
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            // Keep as string if not valid JSON
                        }
                        
                        settings[result.setting_key] = {
                            value: value,
                            type: result.setting_type,
                            updated_at: result.updated_at
                        };
                    }
                }
            }

            console.log(`📖 [SETTINGS] Retrieved ${Object.keys(settings).length} settings for user: ${userId}`);
            return { success: true, settings: settings };

        } catch (error) {
            console.error('❌ [SETTINGS] Failed to get all settings:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Initialize default settings for a new user
     */
    async initializeDefaultSettings(userId = 'default') {
        const defaultSettings = {
            company_info: {
                name: "Your Company",
                product_name: "Your Product/Service",
                value_props: [
                    "Key benefit #1",
                    "Key benefit #2", 
                    "Key benefit #3"
                ],
                calendar_link: "https://calendly.com/yourname/meeting"
            },
            response_style: {
                tone: "professional_friendly",
                meeting_pushiness: "soft",
                technical_depth: "medium",
                followup_frequency: "balanced"
            },
            knowledge_base: {
                technical_answers: {
                    "how it works": "Our solution provides...",
                    "integration": "Integration typically involves...",
                    "performance": "Performance benefits include..."
                },
                pricing_guidance: {
                    "cost_model": "Our pricing is based on...",
                    "roi_message": "Clients typically see ROI within..."
                }
            },
            meeting_triggers: {
                question_threshold: 2,
                positive_sentiment_immediate: true,
                technical_complexity_escalation: true
            }
        };

        console.log(`⚙️ [SETTINGS] Initializing default settings for user: ${userId}`);

        for (const [key, value] of Object.entries(defaultSettings)) {
            await this.updateSetting(key, value, key, userId);
        }

        console.log(`✅ [SETTINGS] Default settings initialized for user: ${userId}`);
        return { success: true };
    }

    /**
     * Get all settings formatted for the UI
     */
    async getSettings(userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const settings = await this.getAllSettings(userId);
            
            // Convert to the format expected by the frontend
            const formattedSettings = {};
            for (const [key, value] of Object.entries(settings)) {
                formattedSettings[key] = value;
            }

            console.log(`⚙️ [SETTINGS] Retrieved settings for user: ${userId}`, formattedSettings);
            return formattedSettings;
        } catch (error) {
            console.error('❌ [SETTINGS] Error getting settings:', error);
            throw error;
        }
    }

    /**
     * Update multiple settings at once (bulk update)
     */
    async updateSettings(settingsObject, userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`⚙️ [SETTINGS] Updating settings for user: ${userId}`, settingsObject);
            
            // Update each setting
            for (const [key, value] of Object.entries(settingsObject)) {
                await this.updateSetting(key, value, key, userId);
            }

            // Return the updated settings
            const updatedSettings = await this.getSettings(userId);
            
            console.log(`✅ [SETTINGS] Successfully updated settings for user: ${userId}`);
            return { 
                success: true, 
                settings: updatedSettings 
            };
        } catch (error) {
            console.error('❌ [SETTINGS] Error updating settings:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * Reset settings to defaults
     */
    async resetToDefaults(userId = 'default') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`⚙️ [SETTINGS] Resetting settings to defaults for user: ${userId}`);
            
            await this.initializeDefaultSettings(userId);
            const settings = await this.getSettings(userId);
            
            console.log(`✅ [SETTINGS] Successfully reset settings to defaults for user: ${userId}`);
            return { 
                success: true, 
                settings: settings 
            };
        } catch (error) {
            console.error('❌ [SETTINGS] Error resetting settings:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
}
