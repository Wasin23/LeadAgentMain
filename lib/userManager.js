// User authentication and settings management
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import AWSManager from '../utils/awsManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths for user data
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'user_settings.json');

// Initialize managers
const awsManager = new AWSManager();

// Master password for AI personality editor (you should change this)
const MASTER_PASSWORD_HASH = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"; // "password" - CHANGE THIS!

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Load users - now uses AWS with JSON fallback during migration
async function loadUsers() {
  try {
    // Try AWS first (future default)
    // For now, we'll implement user-by-user loading in the specific functions
    // This function is kept for backward compatibility but will be phased out
    
    await ensureDataDirectory();
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save users to file
async function saveUsers(users) {
  await ensureDataDirectory();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// Load user settings
async function loadUserSettings(userId) {
  await ensureDataDirectory();
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const allSettings = JSON.parse(data);
    const userSettings = allSettings[userId];
    
    if (userSettings) {
      // Merge user settings with defaults to ensure all properties exist
      const defaults = getDefaultSettings();
      return {
        ...defaults,
        ...userSettings,
        aiPersonality: { ...defaults.aiPersonality, ...userSettings.aiPersonality },
        preferences: { ...defaults.preferences, ...userSettings.preferences },
        vectorStore: { ...defaults.vectorStore, ...userSettings.vectorStore }
      };
    }
    
    return getDefaultSettings();
  } catch {
    return getDefaultSettings();
  }
}

// Save user settings
async function saveUserSettings(userId, settings) {
  await ensureDataDirectory();
  let allSettings = {};
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    allSettings = JSON.parse(data);
  } catch {
    // File doesn't exist, start with empty object
  }
  
  allSettings[userId] = settings;
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(allSettings, null, 2));
}

// Default settings
function getDefaultSettings() {
  return {
    aiPersonality: {
      systemPrompt: `You are an expert AI sales and research assistant for Meridian. You help users research leads, analyze companies, and generate personalized sales outreach.

Your personality:
- Professional but friendly
- Highly knowledgeable about sales and marketing
- Detail-oriented and thorough
- Proactive in suggesting improvements
- Always aim to provide actionable insights

When researching companies, focus on:
- Business growth initiatives and expansion
- Recent funding or growth signals  
- Hiring patterns and team scaling
- Leadership quotes about business transformation
- Competitive positioning and market opportunitiesProvide specific, contextual recommendations for sales outreach based on your research findings.`,
      temperature: 0.7,
      maxTokens: 2000
    },
    preferences: {
      theme: 'dark',
      emailSignature: '',
      defaultLeadLimit: 10,
      autoSaveInterval: 300000, // 5 minutes
      defaultUseGmail: false // Default Gmail sending for new agents
    }
  };
}

// Default agent-specific settings
function getDefaultAgentSettings() {
  return {
    agentName: "Lead Generation Agent",
    isActive: false,
    pauseTimeActive: false,
    pauseBetweenEmails: 60000, // 1 minute
    dailyEmailLimit: 50,
    emailsPerBatch: 5,
    emailTemplate: {
      subject: "Quick question about {{company}}",
      body: `Hi {{firstName}},

I noticed {{company}} has been growing rapidly. I wanted to reach out to see if you might be interested in learning about how we've helped similar companies scale their operations.

Would you be open to a brief conversation?

Best regards,
{{senderName}}`
    },
    leadCriteria: {
      industries: [],
      companySizes: [],
      locations: []
    },
    emailSettings: {
      fromName: "",
      fromEmail: "",
      replyTo: ""
    },
    trackingSettings: {
      enableTracking: true,
      trackOpens: true,
      trackClicks: true
    },
    createdAt: new Date().toISOString(),
    version: "2.0"
  };
}

// User registration
export async function registerUser(username, email, password) {
  try {
    // Check if user already exists using AWS
    const existingUserByUsername = await awsManager.getUserByUsername(username);
    const existingUserByEmail = await awsManager.getUserByEmail(email);
    
    if (existingUserByUsername || existingUserByEmail) {
      throw new Error('User already exists');
    }
    
    const userId = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    
    // Create user in AWS
    await awsManager.createUser({
      userId,
      username,
      email,
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      activeAgents: [],
      trialCreditsUsed: 0,
      trialCreditsLimit: 25,
      paymentMethodAdded: false,
      stripeCustomerId: null,
      // CRM Integration fields
      crmConnected: false,
      crmAccountToken: null,
      crmIntegration: null,
      crmConnectedAt: null,
      crmAutoSync: true,
      // API Keys
      apiKeys: {
        openai: '',
        serper: '',
        apollo: '',
        mailgun: '',
        sendgrid: ''
      }
    });
    
    // Create default settings for new user
    await saveUserSettings(userId, getDefaultSettings());
    
    console.log(`✅ [USER] New user registered via AWS: ${username} (${userId})`);
    return { userId, username, email };
    
  } catch (error) {
    console.error('❌ [USER] Registration failed:', error.message);
    throw error;
  }
}

// User login
export async function loginUser(usernameOrEmail, password) {
  try {
    // Try to find user by username first, then by email using AWS
    let user = await awsManager.getUserByUsername(usernameOrEmail);
    
    if (!user) {
      // If not found by username, search by email
      user = await awsManager.getUserByEmail(usernameOrEmail.toLowerCase());
    }
    
    if (!user || user.passwordHash !== hashPassword(password)) {
      throw new Error('Invalid credentials');
    }
    
    // Update last login in AWS
    await awsManager.updateUser(user.userId, {
      lastLogin: new Date().toISOString()
    });
    
    console.log(`✅ [USER] User logged in via AWS: ${user.username} (${user.userId})`);
    return { userId: user.userId, username: user.username, email: user.email };
    
  } catch (error) {
    console.error('❌ [USER] Login failed:', error.message);
    throw error;
  }
}

// Verify master password for AI personality editor
export function verifyMasterPassword(password) {
  return hashPassword(password) === MASTER_PASSWORD_HASH;
}

// Get user settings
export async function getUserSettings(userId) {
  try {
    console.log(`[USER-MANAGER] Getting settings from DynamoDB for user: ${userId}`);
    const settings = await awsManager.getUserSettings(userId);
    console.log(`[USER-MANAGER] ✅ Retrieved settings from DynamoDB for user: ${userId}`);
    return settings || {};
  } catch (error) {
    console.error(`[USER-MANAGER] Error getting settings from DynamoDB for user ${userId}:`, error);
    // Fallback to JSON file if DynamoDB fails
    return await loadUserSettings(userId);
  }
}

// Update user settings
export async function updateUserSettings(userId, settings) {
  try {
    console.log(`[USER-MANAGER] Saving settings to DynamoDB for user: ${userId}`);
    await awsManager.saveUserSettings(userId, settings);
    console.log(`[USER-MANAGER] ✅ Settings saved to DynamoDB for user: ${userId}`);
    return settings;
  } catch (error) {
    console.error(`[USER-MANAGER] Error saving settings to DynamoDB for user ${userId}:`, error);
    // Fallback to JSON file if DynamoDB fails
    await saveUserSettings(userId, settings);
    return settings;
  }
}

// Update API keys
export async function updateApiKeys(userId, apiKeys) {
  const settings = await loadUserSettings(userId);
  settings.apiKeys = { ...settings.apiKeys, ...apiKeys };
  await saveUserSettings(userId, settings);
  return settings.apiKeys;
}

// Update AI personality (requires master password)
export async function updateAiPersonality(userId, masterPassword, aiPersonality) {
  if (!verifyMasterPassword(masterPassword)) {
    throw new Error('Invalid master password');
  }
  
  const settings = await loadUserSettings(userId);
  settings.aiPersonality = { ...settings.aiPersonality, ...aiPersonality };
  await saveUserSettings(userId, settings);
  return settings.aiPersonality;
}

// Get user's API keys for runtime use
export async function getUserApiKeys(userId) {
  console.log(`[getUserApiKeys] Loading API keys for userId: ${userId}`);
  const settings = await loadUserSettings(userId);
  console.log(`[getUserApiKeys] Loaded settings:`, settings);
  console.log(`[getUserApiKeys] API keys:`, settings.apiKeys);
  return settings.apiKeys;
}

// Get user's AI personality settings
export async function getUserAiPersonality(userId) {
  const settings = await loadUserSettings(userId);
  return settings.aiPersonality;
}

// Generate password reset token
export async function generatePasswordResetToken(email) {
  try {
    // Find user by email using AWS
    const user = await awsManager.getUserByEmail(email.toLowerCase());
    if (!user) {
      throw new Error('No account found with that email address');
    }
    
    // Generate a 6-digit reset token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    
    // Update user with reset token in AWS
    console.log(`🔄 [USER] Updating user ${user.userId} with token: ${token}`);
    await awsManager.updateUser(user.userId, {
      resetToken: token,
      resetTokenExpiry: tokenExpiry.toISOString()
    });
    
    console.log(`✅ [USER] Password reset token generated for: ${user.username} (Token: ${token})`);
    return {
      token,
      username: user.username,
      expiry: tokenExpiry
    };
    
  } catch (error) {
    console.error('❌ [USER] Password reset token generation failed:', error.message);
    throw error;
  }
}

// Verify password reset token
export async function verifyPasswordResetToken(token) {
  try {
    // Find user with this reset token using AWS
    const user = await awsManager.getUserByResetToken(token);
    if (!user) {
      return { success: false, error: 'Invalid reset token' };
    }
    
    // Check if token is expired
    const now = new Date();
    const expiry = new Date(user.resetTokenExpiry);
    if (now > expiry) {
      return { success: false, error: 'Reset token has expired' };
    }
    
    return { 
      success: true, 
      email: user.email,
      username: user.username
    };
    
  } catch (error) {
    console.error('❌ [USER] Password reset token verification failed:', error.message);
    return { success: false, error: 'Token verification failed' };
  }
}

// Reset password using token
export async function resetPassword(token, newPassword) {
  try {
    // Find user with this reset token using AWS
    const user = await awsManager.getUserByResetToken(token);
    if (!user) {
      throw new Error('Invalid reset token');
    }
    
    // Check if token is expired
    const now = new Date();
    const expiry = new Date(user.resetTokenExpiry);
    if (now > expiry) {
      throw new Error('Reset token has expired');
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    // Update password and clear reset token in AWS
    await awsManager.updateUser(user.userId, {
      passwordHash: hashPassword(newPassword),
      lastPasswordReset: new Date().toISOString(),
      resetToken: null,
      resetTokenExpiry: null
    });
    
    console.log(`✅ [USER] Password reset completed for: ${user.username}`);
    return {
      username: user.username,
      email: user.email
    };
    
  } catch (error) {
    console.error('❌ [USER] Password reset failed:', error.message);
    throw error;
  }
}

// Get user by email
export async function getUserByEmail(email) {
  try {
    return await awsManager.getUserByEmail(email.toLowerCase());
  } catch (error) {
    console.error('❌ [USER] Error getting user by email:', error.message);
    return null;
  }
}

// Add agent to user
export async function addAgentToUser(userId, agentData) {
  try {
    // Add agent to user's agent list
    await awsManager.addAgentToUser(userId, agentData);
    
    // Create default agent-specific settings
    const defaultSettings = getDefaultAgentSettings();
    if (agentData.name) {
      defaultSettings.agentName = agentData.name;
    }
    
    await awsManager.saveLeadAgentSettings(userId, agentData.agentId, defaultSettings);
    
    console.log(`✅ [USER] Agent ${agentData.agentId} added to user ${userId} with default settings`);
    return true;
  } catch (error) {
    console.error('❌ [USER] Error adding agent to user:', error.message);
    throw error;
  }
}

// Remove agent from user
export async function removeAgentFromUser(userId, agentId) {
  try {
    await awsManager.removeAgentFromUser(userId, agentId);
    console.log(`✅ [USER] Agent ${agentId} removed from user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ [USER] Error removing agent from user:', error.message);
    throw error;
  }
}

// Get user by ID
export async function getUserById(userId) {
  try {
    return await awsManager.getUserById(userId);
  } catch (error) {
    console.error('❌ [USER] Error getting user by ID:', error.message);
    return null;
  }
}
