import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411';

console.log('🧹 Cleaning up nested data structures...');

async function cleanUpSettings() {
  try {
    // Get current settings
    const response = await docClient.send(new GetCommand({
      TableName: 'examark-agent-settings',
      Key: { userId, settingsType: 'lead-agent' }
    }));

    if (!response.Item) {
      console.log('❌ No settings found');
      return;
    }

    const currentSettings = response.Item.settings;
    console.log('📋 Current structure has these keys:', Object.keys(currentSettings));

    // Clean structure - only keep the main settings, remove all nested junk
    const cleanedSettings = {
      geographicSettings: {
        leadLimit: currentSettings.geographicSettings?.leadLimit || 50,
        excludedLocations: currentSettings.geographicSettings?.excludedLocations || [],
        targetLocations: currentSettings.geographicSettings?.targetLocations || ["United States"],
        timezone: currentSettings.geographicSettings?.timezone || "UTC"
      },
      companyBranding: {
        expertiseArea: currentSettings.companyBranding?.expertiseArea || "Business Development",
        primaryService: currentSettings.companyBranding?.primaryService || "Business Solutions", 
        companyName: currentSettings.companyBranding?.companyName || "Your Company",
        agentTitle: currentSettings.companyBranding?.agentTitle || "AI Assistant",
        keyAdvantages: currentSettings.companyBranding?.keyAdvantages || "Quality, Innovation, Reliability",
        companyDescription: currentSettings.companyBranding?.companyDescription || "",
        agentName: currentSettings.companyBranding?.agentName || "ExaMark",
        coreOffering: currentSettings.companyBranding?.coreOffering || "Professional Services",
        companyWebsite: currentSettings.companyBranding?.companyWebsite || ""
      },
      companyCriteria: {
        companyKeywords: currentSettings.companyCriteria?.companyKeywords || [],
        companySizeMin: currentSettings.companyCriteria?.companySizeMin || 50,
        excludedCompanies: currentSettings.companyCriteria?.excludedCompanies || [],
        companyIndustries: currentSettings.companyCriteria?.companyIndustries || [],
        companySizeMax: currentSettings.companyCriteria?.companySizeMax || 500
      },
      researchFocus: {
        includeCompanyNews: currentSettings.researchFocus?.includeCompanyNews || false,
        includePersonalInfo: currentSettings.researchFocus?.includePersonalInfo || false,
        includeSocialMedia: currentSettings.researchFocus?.includeSocialMedia || false,
        focusAreas: currentSettings.researchFocus?.focusAreas || [],
        researchDepth: currentSettings.researchFocus?.researchDepth || "standard"
      },
      emailBuilder: {
        length: currentSettings.emailBuilder?.length || "medium",
        personalization: currentSettings.emailBuilder?.personalization || "high",
        tone: currentSettings.emailBuilder?.tone || "professional",
        customPrompt: currentSettings.emailBuilder?.customPrompt || "You are {{AGENT_NAME}}, the AI assistant for {{COMPANY_NAME}}. Generate a professional marketing email for the following prospect:\\n\\nCompany: {{TARGET_COMPANY}}\\nContact: {{CONTACT_NAME}}\\nTitle: {{CONTACT_TITLE}}\\n\\nWrite a personalized email explaining how {{COMPANY_NAME}} can help their business.",
        emailTemplate: currentSettings.emailBuilder?.emailTemplate || "professional",
        callToAction: currentSettings.emailBuilder?.callToAction || "meeting"
      },
      contactCriteria: {
        seniorityLevel: currentSettings.contactCriteria?.seniorityLevel || "senior",
        contactKeywords: currentSettings.contactCriteria?.contactKeywords || [],
        targetPositions: currentSettings.contactCriteria?.targetPositions || [],
        excludedTitles: currentSettings.contactCriteria?.excludedTitles || []
      },
      advancedCriteria: {
        fundingStage: currentSettings.advancedCriteria?.fundingStage || "any",
        technologiesUsed: currentSettings.advancedCriteria?.technologiesUsed || [],
        fundingAmount: currentSettings.advancedCriteria?.fundingAmount || "",
        recentNews: currentSettings.advancedCriteria?.recentNews || false,
        growthStage: currentSettings.advancedCriteria?.growthStage || "any"
      },
      version: "2.0",
      updatedAt: new Date().toISOString()
    };

    console.log('');
    console.log('🧹 Cleaned structure:');
    console.log('  Keys:', Object.keys(cleanedSettings));
    console.log('  Company:', cleanedSettings.companyBranding.companyName);
    console.log('  Agent:', cleanedSettings.companyBranding.agentName);
    console.log('  Industries:', cleanedSettings.companyCriteria.companyIndustries.length);
    console.log('  Positions:', cleanedSettings.contactCriteria.targetPositions.length);
    console.log('  Company Size:', `${cleanedSettings.companyCriteria.companySizeMin}-${cleanedSettings.companyCriteria.companySizeMax}`);
    console.log('  Lead Limit:', cleanedSettings.geographicSettings.leadLimit);

    // Save cleaned settings
    await docClient.send(new PutCommand({
      TableName: 'examark-agent-settings',
      Item: {
        userId,
        settingsType: 'lead-agent',
        settings: cleanedSettings
      }
    }));

    console.log('');
    console.log('✅ Settings cleaned and saved!');
    console.log('🗑️  Removed all nested rawLeadContactSettings, rawEmailBuilder, and duplicate data');
    console.log('📊 Now only pulling clean data from AWS');

  } catch (error) {
    console.error('❌ Error cleaning settings:', error.message);
  }
}

cleanUpSettings();