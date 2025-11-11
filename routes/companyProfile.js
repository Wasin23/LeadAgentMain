import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import OpenAI from 'openai';
import AWSManager from '../utils/awsManager.js';

const router = express.Router();
router.use(authenticateToken);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Check if user has a company profile
 */
router.get('/check', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    // Check if company profile exists
    const hasProfile = !!(userSettings?.companyProfile && userSettings.companyProfile.companyName);
    
    console.log(`[COMPANY PROFILE] Check for user ${userId}: hasProfile=${hasProfile}`);
    
    res.json({
      success: true,
      hasProfile,
      profile: userSettings?.companyProfile || null
    });
  } catch (error) {
    console.error('Error checking company profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Analyze uploaded document and extract company profile
 */
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, fileName, isImage } = req.body;

    console.log(`[COMPANY PROFILE] Analyzing document for user ${userId}: ${fileName} (isImage: ${isImage})`);

    // Prepare messages based on file type
    let messages;
    
    if (isImage) {
      // For images, use vision model with base64 image
      messages = [{
        role: 'system',
        content: `You are an expert business analyst. Your job is to analyze COMPANY documents (whitepapers, pitch decks, company descriptions, marketing materials) from images.

IMPORTANT: First, determine if this is a COMPANY document or a PERSONAL document (resume, CV, personal bio).

If it's a PERSONAL document (resume/CV), return:
{
  "isPersonalDocument": true,
  "error": "This appears to be a personal resume or CV. Please upload a company document such as a whitepaper, pitch deck, or company description instead."
}

If it's a COMPANY document, analyze it and return a JSON object with:
- companyName: The company name
- industry: Primary industry/sector
- services: Description of products/services offered
- targetMarket: Who their ideal customers are
- companySize: Estimated company size (1-10, 11-50, 51-200, 201-500, 501+)
- description: Brief company description

Also generate recommended agent settings:
- targetIndustries: Array of 3-5 industries they should target for leads
- targetPositions: Array of 5-7 job titles/positions to target
- companySizeMin: Minimum company size to target (number)
- companySizeMax: Maximum company size to target (number)
- leadLimit: Recommended leads per cycle (5-15 based on company size)

Return as JSON: {profile: {...}, recommendedPreset: {...}}`
      }, {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this company document image:'
          },
          {
            type: 'image_url',
            image_url: {
              url: content
            }
          }
        ]
      }];
    } else {
      // For text documents
      messages = [{
        role: 'system',
        content: `You are an expert business analyst. Your job is to analyze COMPANY documents (whitepapers, pitch decks, company descriptions, marketing materials).

IMPORTANT: First, determine if this is a COMPANY document or a PERSONAL document (resume, CV, personal bio).

If it's a PERSONAL document (resume/CV), return:
{
  "isPersonalDocument": true,
  "error": "This appears to be a personal resume or CV. Please upload a company document such as a whitepaper, pitch deck, or company description instead."
}

If it's a COMPANY document, analyze it and return a JSON object with:
- companyName: The company name
- industry: Primary industry/sector
- services: Description of products/services offered
- targetMarket: Who their ideal customers are
- companySize: Estimated company size (1-10, 11-50, 51-200, 201-500, 501+)
- description: Brief company description

Also generate recommended agent settings:
- targetIndustries: Array of 3-5 industries they should target for leads
- targetPositions: Array of 5-7 job titles/positions to target
- companySizeMin: Minimum company size to target (number)
- companySizeMax: Maximum company size to target (number)
- leadLimit: Recommended leads per cycle (5-15 based on company size)

Return as JSON: {profile: {...}, recommendedPreset: {...}}`
      }, {
        role: 'user',
        content: `Analyze this document:\n\n${content.substring(0, 10000)}`
      }];
    }

    // Use GPT-4 with vision for images, regular GPT-4 for text
    const completion = await openai.chat.completions.create({
      model: isImage ? 'gpt-4o' : 'gpt-4o',
      messages: messages,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // Check if it's a personal document
    if (result.isPersonalDocument) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    console.log('[COMPANY PROFILE] Analysis complete:', result.profile);

    res.json({
      success: true,
      profile: result.profile,
      recommendedPreset: result.recommendedPreset
    });
  } catch (error) {
    console.error('Error analyzing document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Chat interface for building company profile
 */
router.post('/chat', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messages } = req.body;

    console.log(`[COMPANY PROFILE] Chat for user ${userId}, messages: ${messages.length}`);

    // Use GPT-4 to have a conversation
    const systemPrompt = `You are a friendly business consultant helping a user create their company profile for an AI lead generation platform. 

Your job is to:
1. Ask about their company name, industry, services, target market, and company size
2. Be conversational and ask one question at a time
3. When you have enough information, extract it into a structured format

After gathering information, respond with JSON in this format:
{
  "message": "your response to the user",
  "profileComplete": true/false,
  "profile": {
    "companyName": "...",
    "industry": "...",
    "services": "...",
    "targetMarket": "...",
    "companySize": "...",
    "description": "..."
  },
  "recommendedPreset": {
    "targetIndustries": ["..."],
    "targetPositions": ["..."],
    "companySizeMin": 100,
    "companySizeMax": 5000,
    "leadLimit": 10
  }
}

If the profile is not complete yet, just return {"message": "your next question", "profileComplete": false}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    console.log('[COMPANY PROFILE] Chat response:', result.message?.substring(0, 100));

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Save company profile to user settings
 */
router.post('/save', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { profile, recommendedPreset } = req.body;

    console.log(`[COMPANY PROFILE] Saving profile for user ${userId}:`, profile.companyName);

    const awsManager = new AWSManager();
    
    // Get existing user settings
    let userSettings = await awsManager.getUserSettings(userId) || {};
    
    // Add company profile and recommended preset
    userSettings.companyProfile = profile;
    userSettings.recommendedAgentPreset = recommendedPreset;
    
    // Save back to DynamoDB
    await awsManager.saveUserSettings(userId, userSettings);

    console.log('[COMPANY PROFILE] Profile saved successfully');

    res.json({
      success: true,
      message: 'Company profile saved successfully'
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get company profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    const userSettings = await awsManager.getUserSettings(userId);
    
    res.json({
      success: true,
      profile: userSettings?.companyProfile || null,
      recommendedPreset: userSettings?.recommendedAgentPreset || null
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete company profile (reset account data)
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const awsManager = new AWSManager();
    
    console.log(`[COMPANY PROFILE] Resetting account data for user ${userId}`);
    
    // Get user settings
    const userSettings = await awsManager.getUserSettings(userId);
    
    if (userSettings) {
      // Clear company profile
      delete userSettings.companyProfile;
      delete userSettings.recommendedAgentPreset;
      
      // Save updated settings
      await awsManager.updateUserSettings(userId, userSettings);
      
      console.log(`[COMPANY PROFILE] Account data reset successfully for user ${userId}`);
      
      res.json({
        success: true,
        message: 'Account data reset successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User settings not found'
      });
    }
  } catch (error) {
    console.error('Error resetting account data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
