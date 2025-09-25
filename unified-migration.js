import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import zillizSettingsManager from './utils/zillizSettingsManager.js';

async function migrateAllSettings() {
  console.log('🚀 Starting unified settings migration to simplified Zilliz collections...');

  try {
    // 1. Read user data
    console.log('\n👤 Reading user data from users.json...');
    const usersPath = path.join(process.cwd(), 'lib', 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);

    // 2. Read user settings data
    console.log('⚙️ Reading user settings from user_settings.json...');
    const userSettingsPath = path.join(process.cwd(), 'lib', 'data', 'user_settings.json');
    const userSettingsData = await fs.readFile(userSettingsPath, 'utf8');
    const userSettings = JSON.parse(userSettingsData);

    // 3. Migrate each user's settings
    for (const [username, userData] of Object.entries(users)) {
      const userId = userData.id;
      console.log(`\n🔄 Migrating settings for user: ${username} (${userId.substring(0, 8)}...)`);

      try {
        // === USER SETTINGS MIGRATION ===
        console.log('  📊 Migrating user preferences and AI personality...');
        
        const userSpecificData = userSettings[userId] || {};
        const userPreferences = userSpecificData.preferences || {};
        const aiPersonality = userSpecificData.aiPersonality || {};
        
        // Build complete user settings object
        const completeUserSettings = {
          preferences: {
            username: username,
            email: userData.email || '',
            notifications: userPreferences.notifications !== false, // Default to true
            theme: userPreferences.theme || 'light',
            ...userPreferences // Include any other preferences
          },
          aiPersonality: {
            tone: aiPersonality.tone || 'professional',
            style: aiPersonality.style || 'concise', 
            creativity: aiPersonality.creativity || 'balanced',
            ...aiPersonality // Include any other AI personality settings
          },
          // Migration metadata
          migratedAt: new Date().toISOString(),
          version: '2.0'
        };

        await zillizSettingsManager.saveUserSettings(userId, completeUserSettings);
        console.log('    ✅ User settings migrated successfully');

        // === LEAD AGENT SETTINGS MIGRATION ===
        const userSpecificSettings = userSettings[userId];
        const leadContactSettings = userSpecificSettings?.leadContactSettings;
        
        if (leadContactSettings) {
          console.log('  🤖 Migrating lead agent settings...');
          
          // Build complete lead agent settings object
          const completeLeadSettings = {
            // Company Branding
            companyBranding: {
              agentName: leadContactSettings.agentName || 'ExaMark',
              agentTitle: leadContactSettings.agentTitle || 'AI Assistant',
              companyName: leadContactSettings.companyName || 'Exabits',
              companyWebsite: leadContactSettings.companyWebsite || '',
              companyDescription: leadContactSettings.companyDescription || ''
            },
            
            // Company Criteria
            companyCriteria: {
              companySizeMin: leadContactSettings.companySizeMin || 200,
              companySizeMax: leadContactSettings.companySizeMax || 300,
              companyIndustries: leadContactSettings.companyIndustries || [],
              excludedCompanies: leadContactSettings.excludedCompanies || [],
              companyKeywords: leadContactSettings.companyKeywords || []
            },
            
            // Contact Criteria
            contactCriteria: {
              targetPositions: leadContactSettings.targetPositions || [],
              seniorityLevel: leadContactSettings.seniorityLevel || 'senior',
              excludedTitles: leadContactSettings.excludedTitles || [],
              contactKeywords: leadContactSettings.contactKeywords || []
            },
            
            // Geographic Settings
            geographicSettings: {
              targetLocations: leadContactSettings.targetLocations || [],
              excludedLocations: leadContactSettings.excludedLocations || [],
              leadLimit: leadContactSettings.leadLimit || 10,
              timezone: leadContactSettings.timezone || 'UTC'
            },
            
            // Advanced Criteria
            advancedCriteria: {
              fundingStage: leadContactSettings.fundingStage || 'any',
              fundingAmount: leadContactSettings.fundingAmount || '',
              growthStage: leadContactSettings.growthStage || 'any',
              technologiesUsed: leadContactSettings.technologiesUsed || [],
              recentNews: leadContactSettings.recentNews || false
            },
            
            // Research Focus
            researchFocus: {
              focusAreas: leadContactSettings.focusAreas || [],
              researchDepth: leadContactSettings.researchDepth || 'standard',
              includeCompanyNews: leadContactSettings.includeCompanyNews || false,
              includePersonalInfo: leadContactSettings.includePersonalInfo || false,
              includeSocialMedia: leadContactSettings.includeSocialMedia || false
            },
            
            // Email Builder
            emailBuilder: {
              emailTemplate: leadContactSettings.emailTemplate || 'professional',
              customPrompt: leadContactSettings.customPrompt || '',
              tone: leadContactSettings.tone || 'professional',
              length: leadContactSettings.length || 'medium',
              callToAction: leadContactSettings.callToAction || 'meeting',
              personalization: leadContactSettings.personalization || 'high'
            },
            
            // Migration metadata
            migratedAt: new Date().toISOString(),
            version: '2.0'
          };

          await zillizSettingsManager.saveLeadAgentSettings(userId, completeLeadSettings);
          console.log('    ✅ Lead agent settings migrated successfully');
          console.log(`      🤖 Agent: ${completeLeadSettings.companyBranding.agentName} (${completeLeadSettings.companyBranding.agentTitle})`);
          console.log(`      🏢 Company: ${completeLeadSettings.companyBranding.companyName}`);
          console.log(`      🎯 Positions: ${completeLeadSettings.contactCriteria.targetPositions.length} configured`);
          console.log(`      🌍 Locations: ${completeLeadSettings.geographicSettings.targetLocations.length} configured`);
        } else {
          console.log('    ℹ️ No lead agent settings found for this user');
        }

      } catch (error) {
        console.error(`  ❌ Error migrating settings for ${username}:`, error.message);
      }
    }

    console.log('\n🎉 Unified settings migration completed successfully!');

    // 4. Verify migration
    console.log('\n🔍 Verifying migration results...');
    await verifyMigration();

  } catch (error) {
    console.error('❌ Unified settings migration failed:', error);
  }
}

async function verifyMigration() {
  try {
    // Read users to verify each one
    const usersPath = path.join(process.cwd(), 'lib', 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);

    for (const [username, userData] of Object.entries(users)) {
      const userId = userData.id;
      console.log(`\n📊 Verifying settings for: ${username}`);

      try {
        // Verify user settings
        const userSettings = await zillizSettingsManager.getUserSettings(userId);
        if (userSettings) {
          console.log('  ✅ User settings retrieved successfully');
          console.log(`    👤 Username: ${userSettings.preferences?.username || 'Not set'}`);
          console.log(`    📧 Email: ${userSettings.preferences?.email || 'Not set'}`);
          console.log(`    🎨 Theme: ${userSettings.preferences?.theme || 'Not set'}`);
          console.log(`    🤖 AI Tone: ${userSettings.aiPersonality?.tone || 'Not set'}`);
        } else {
          console.log('  ❌ User settings not found');
        }

        // Verify lead agent settings
        const leadSettings = await zillizSettingsManager.getLeadAgentSettings(userId);
        if (leadSettings) {
          console.log('  ✅ Lead agent settings retrieved successfully');
          console.log(`    🏢 Company: ${leadSettings.companyBranding?.companyName || 'Not set'}`);
          console.log(`    🤖 Agent: ${leadSettings.companyBranding?.agentName || 'Not set'}`);
          console.log(`    🎯 Positions: ${leadSettings.contactCriteria?.targetPositions?.length || 0} configured`);
          console.log(`    🌍 Locations: ${leadSettings.geographicSettings?.targetLocations?.length || 0} configured`);
        } else {
          console.log('  ℹ️ No lead agent settings found (may be normal)');
        }

      } catch (error) {
        console.error(`  ❌ Error verifying settings for ${username}:`, error.message);
      }
    }

    // Check collection statistics
    console.log('\n📈 Collection Statistics:');
    const stats = await zillizSettingsManager.getCollectionStats();
    console.log(`  📊 user_settings: ${stats.user_settings} entities`);
    console.log(`  🤖 lead_agent_settings: ${stats.lead_agent_settings} entities`);

  } catch (error) {
    console.error('Error verifying migration:', error);
  }
}

migrateAllSettings();