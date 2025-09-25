// Migrate lead agent settings to Zilliz lead_agent_settings collection
import { zillizSettingsManager } from './utils/zillizSettingsManager.js';
import fs from 'fs/promises';
import path from 'path';

async function migrateLeadAgentSettings() {
  console.log('🚀 Starting lead agent settings migration to Zilliz...');
  
  try {
    // 1. Read users.json to get user IDs
    console.log('\n👤 Reading user data from users.json...');
    
    const usersPath = path.join(process.cwd(), 'lib', 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    // 2. Read existing user settings for lead contact settings
    const userSettingsPath = path.join(process.cwd(), 'lib', 'data', 'user_settings.json');
    let userSettingsData = {};
    try {
      const data = await fs.readFile(userSettingsPath, 'utf8');
      userSettingsData = JSON.parse(data);
    } catch (error) {
      console.log('  No existing user_settings.json found');
      return;
    }
    
    // 3. Migrate lead agent settings for each user
    for (const [username, userData] of Object.entries(users)) {
      const userId = userData.id;
      console.log(`\n🎯 Migrating lead agent settings for user: ${username} (${userId.substring(0, 8)}...)`);
      
      // Get lead contact settings for this user
      const userSettings = userSettingsData[userId];
      if (!userSettings || !userSettings.leadContactSettings) {
        console.log(`  ❌ No lead contact settings found for ${username}`);
        continue;
      }
      
      const leadContactSettings = userSettings.leadContactSettings;
      
      try {
        // Create comprehensive lead_settings as a single JSON object
        const lead_settings = {
          // User Information
          userId: userId,
          username: userData.username,
          
          // Company Branding Section
          companyBranding: {
            agentName: leadContactSettings.companyBranding?.agentName || 'ExaMark',
            companyName: leadContactSettings.companyBranding?.companyName || 'Exabits',
            agentTitle: leadContactSettings.companyBranding?.agentTitle || 'AI Assistant',
            primaryService: leadContactSettings.companyBranding?.primaryService || 'AI-powered High-Performance Computing Solutions',
            coreOffering: leadContactSettings.companyBranding?.coreOffering || 'Custom AI infrastructure with NVIDIA H100/H200 GPU clusters',
            keyAdvantages: leadContactSettings.companyBranding?.keyAdvantages || 'AI-HPC specialization, better performance-per-dollar vs general cloud, expert support',
            expertiseArea: leadContactSettings.companyBranding?.expertiseArea || 'Deep understanding of AI/ML compute requirements'
          },
          
          // Company Criteria Section
          companyCriteria: {
            companySizeMin: leadContactSettings.companySizeMin || 200,
            companySizeMax: leadContactSettings.companySizeMax || 300,
            companyIndustries: leadContactSettings.companyIndustries || [],
            companyKeywords: leadContactSettings.companyKeywords || []
          },
          
          // Contact Person Criteria Section
          contactCriteria: {
            targetPositions: leadContactSettings.targetPositions || [
              'CTO', 'Chief Technology Officer', 'VP of Engineering', 'IT Director',
              'CEO', 'Chief Executive Officer', 'Founder'
            ],
            seniorityLevel: leadContactSettings.seniorityLevel || 'senior',
            departments: leadContactSettings.departments || []
          },
          
          // Geographic & Search Settings Section
          geographicSettings: {
            targetLocations: leadContactSettings.targetLocations || ['United States'],
            leadLimit: leadContactSettings.leadLimit || 10,
            excludeKeywords: leadContactSettings.excludeKeywords || []
          },
          
          // Advanced Criteria Section
          advancedCriteria: {
            fundingStage: leadContactSettings.fundingStage || 'any',
            technologyStack: leadContactSettings.technologyStack || [],
            contactIntent: leadContactSettings.contactIntent || []
          },
          
          // Research Focus Section
          researchFocus: {
            focusAreas: leadContactSettings.researchFocus || [
              'Employee communication challenges and workforce management',
              'HR technology adoption and digital transformation initiatives',
              'Company growth, expansion, or operational scaling',
              'Recent hiring trends and workforce developments',
              'Communication infrastructure and employee engagement',
              'Industry-specific operational challenges',
              'Leadership quotes about employee experience or workplace efficiency'
            ]
          },
          
          // Email Builder AI Prompt Section
          emailBuilder: {
            customPrompt: leadContactSettings.emailBuilderPrompt || `You are a sales AI assistant helping to craft personalized outreach emails for {{COMPANY_NAME}}.

Your role: {{AGENT_NAME}}, {{AGENT_TITLE}} at {{COMPANY_NAME}}

Company Info:
- Service: {{PRIMARY_SERVICE}}
- Core Offering: {{CORE_OFFERING}}
- Key Advantages: {{KEY_ADVANTAGES}}
- Expertise: {{EXPERTISE_AREA}}

Create compelling, personalized sales emails that:
1. Reference specific company research and pain points
2. Connect their challenges to our solutions
3. Use a professional but conversational tone
4. Include a clear, specific call-to-action
5. Keep emails under 150 words
6. Avoid generic sales language

Research Context: {RESEARCH_SUMMARY}
Company: {COMPANY_NAME}
Contact: {CONTACT_NAME}, {CONTACT_TITLE}

Generate a personalized email that feels human-written and highly relevant to their specific situation.`
          },
          
          // Metadata
          migratedAt: new Date().toISOString(),
          version: '2.0'
        };
        
        // Use the targeting_criteria field to store the complete lead_settings JSON
        const leadAgentSettings = {
          lead_settings: lead_settings
        };
        
        // Save to Zilliz lead_agent_settings collection
        await zillizSettingsManager.saveLeadAgentSettings(userId, leadAgentSettings);
        
        console.log(`  ✅ Migrated comprehensive lead agent settings for ${username}`);
        console.log(`     🤖 Agent: ${lead_settings.companyBranding.agentName} (${lead_settings.companyBranding.agentTitle})`);
        console.log(`     🏢 Company: ${lead_settings.companyBranding.companyName}`);
        console.log(`     📏 Company Size: ${lead_settings.companyCriteria.companySizeMin}-${lead_settings.companyCriteria.companySizeMax} employees`);
        console.log(`     🎯 Target Positions: ${lead_settings.contactCriteria.targetPositions.length} configured`);
        console.log(`     🏭 Industries: ${lead_settings.companyCriteria.companyIndustries.length} configured`);
        console.log(`     🌍 Locations: ${lead_settings.geographicSettings.targetLocations.length} configured`);
        console.log(`     📊 Lead Limit: ${lead_settings.geographicSettings.leadLimit}`);
        console.log(`     🔍 Seniority Level: ${lead_settings.contactCriteria.seniorityLevel}`);
        console.log(`     💰 Funding Stage: ${lead_settings.advancedCriteria.fundingStage}`);
        console.log(`     📧 Email Builder: ${lead_settings.emailBuilder.customPrompt ? 'Custom prompt configured' : 'Default only'}`);
        console.log(`     🔬 Research Areas: ${lead_settings.researchFocus.focusAreas.length} configured`);
        
      } catch (error) {
        console.error(`  ❌ Error migrating lead agent settings for ${username}:`, error.message);
      }
    }
    
    console.log('\n🎉 Lead agent settings migration completed successfully!');
    
    // 4. Verify migration
    console.log('\n🔍 Verifying lead agent settings migration...');
    await verifyLeadAgentMigration();
    
  } catch (error) {
    console.error('❌ Lead agent settings migration failed:', error);
  }
}

async function verifyLeadAgentMigration() {
  try {
    // Read users again to verify each one
    const usersPath = path.join(process.cwd(), 'lib', 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    for (const [username, userData] of Object.entries(users)) {
      const userId = userData.id;
      console.log(`\n📊 Verifying lead agent settings for: ${username}`);
      
      try {
        const retrievedSettings = await zillizSettingsManager.getLeadAgentSettings(userId);
        
        if (retrievedSettings) {
          console.log(`  ✅ Successfully retrieved comprehensive lead agent settings`);
          console.log(`  🆔 User ID: ${retrievedSettings.userId || 'Not found'}`);
          console.log(`  👤 Username: ${retrievedSettings.username || 'Not found'}`);
          console.log(`  🏢 Company: ${retrievedSettings.companyBranding?.companyName || 'Not found'}`);
          console.log(`  🤖 Agent: ${retrievedSettings.companyBranding?.agentName || 'Not found'}`);
          console.log(`  📏 Company Size: ${retrievedSettings.companyCriteria?.companySizeMin || 'Not found'}-${retrievedSettings.companyCriteria?.companySizeMax || 'Not found'}`);
          console.log(`  🎯 Positions: ${retrievedSettings.contactCriteria?.targetPositions?.length || 0} configured`);
          console.log(`  🏭 Industries: ${retrievedSettings.companyCriteria?.companyIndustries?.length || 0} configured`);
          console.log(`  🌍 Locations: ${retrievedSettings.geographicSettings?.targetLocations?.length || 0} configured`);
          console.log(`  📊 Lead Limit: ${retrievedSettings.geographicSettings?.leadLimit || 'Not found'}`);
          console.log(`  📧 Email Builder: ${retrievedSettings.emailBuilder?.customPrompt ? 'Custom prompt configured' : 'Default prompt'}`);
          console.log(`  🔍 Research Focus: ${retrievedSettings.researchFocus?.focusAreas?.length || 0} focus areas`);
          console.log(`  📅 Migrated: ${retrievedSettings.migratedAt || 'Not found'}`);
        } else {
          console.log(`  ❌ Lead agent settings not found for user ${username}`);
        }
      } catch (error) {
        console.error(`  ❌ Error retrieving lead agent settings for ${username}:`, error.message);
      }
    }
    
    // Check collection statistics
    console.log('\n📈 Lead Agent Settings Collection Statistics:');
    const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
    const client = new MilvusClient({
      address: process.env.ZILLIZ_ENDPOINT?.trim(),
      token: process.env.ZILLIZ_TOKEN?.trim(),
    });
    
    try {
      await client.loadCollection({ collection_name: 'lead_agent_settings' });
      const stats = await client.getCollectionStatistics({ collection_name: 'lead_agent_settings' });
      console.log(`  lead_agent_settings: ${stats.data.row_count || 0} entities`);
    } catch (error) {
      console.error('Error getting collection statistics:', error.message);
    }
    
  } catch (error) {
    console.error('Error verifying lead agent migration:', error);
  }
}

migrateLeadAgentSettings();