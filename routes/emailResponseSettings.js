// Email Response Settings API Route
import express from 'express';
import { authenticateToken } from '../middleware/jwt.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const router = express.Router();

// Apply JWT authentication to ALL routes in this router
router.use(authenticateToken);

// AWS DynamoDB client setup
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// GET /api/email-response-settings
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId; // Get from JWT token
    console.log(`[EMAIL-RESPONSE] Getting settings for user: ${userId}`);
    
    const tableName = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { userId: userId }
    });

    const result = await dynamodb.send(command);
    
    if (!result.Item || !result.Item.emailResponseSettings) {
      // Return default settings
      const defaultSettings = {
        calendar_id: 'primary',
        company_name: '',
        timezone: 'America/Los_Angeles',
        response_tone: 'professional_friendly',
        ai_assistant_name: '',
        product_name: '',
        value_propositions: [],
        meeting_pushiness: 'balanced',
        technical_depth: 'medium',
        show_ai_disclaimer: false
      };
      
      res.json({
        success: true,
        userId: userId,
        settings: defaultSettings,
        isDefault: true
      });
      return;
    }
    
    res.json({
      success: true,
      userId: userId,
      settings: result.Item.emailResponseSettings,
      updated_at: result.Item.emailResponseSettings.updated_at || null,
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
    
    console.log(`[EMAIL-RESPONSE] Saving settings for user: ${userId}`);
    console.log('[EMAIL-RESPONSE] Settings:', settings);
    
    const tableName = process.env.AWS_DYNAMODB_USERS_TABLE || 'meridian-users';
    const now = new Date().toISOString();
    
    // Add timestamp to settings
    const settingsWithTimestamp = {
      ...settings,
      updated_at: now
    };
    
    // First, get the current user data to preserve other fields
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { userId: userId }
    });

    const currentData = await dynamodb.send(getCommand);
    
    // Update user record with email response settings
    const putCommand = new PutCommand({
      TableName: tableName,
      Item: {
        ...currentData.Item, // Preserve existing data
        userId: userId,
        emailResponseSettings: settingsWithTimestamp
      }
    });
    
    await dynamodb.send(putCommand);
    
    console.log(`[EMAIL-RESPONSE] Settings saved successfully to AWS DynamoDB for user ${userId}`);
    
    res.json({
      success: true,
      userId: userId,
      settings: settingsWithTimestamp,
      updated_at: now,
      message: 'Email response settings updated successfully in AWS'
    });
    
  } catch (error) {
    console.error('[EMAIL-RESPONSE] Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
