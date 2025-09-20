// User authentication and settings management
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths for user data
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'user_settings.json');

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

// Load users from file
async function loadUsers() {
  await ensureDataDirectory();
  try {
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
    return allSettings[userId] || getDefaultSettings();
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
    apiKeys: {
      openai: '',
      serper: '',
      apollo: '',
      mailgun: '',
      sendgrid: ''
    },
    aiPersonality: {
      systemPrompt: `You are an expert AI sales and research assistant for ExaMark. You help users research leads, analyze companies, and generate personalized sales outreach.

Your personality:
- Professional but friendly
- Highly knowledgeable about sales and marketing
- Detail-oriented and thorough
- Proactive in suggesting improvements
- Always aim to provide actionable insights

When researching companies, focus on:
- AI/ML initiatives and expansion
- Recent funding or growth signals
- Technology hiring patterns
- Leadership quotes about digital transformation
- Competitive positioning in AI space

Provide specific, contextual recommendations for sales outreach based on your research findings.`,
      temperature: 0.7,
      maxTokens: 2000
    },
    preferences: {
      theme: 'dark',
      emailSignature: '',
      defaultLeadLimit: 10,
      autoSaveInterval: 300000 // 5 minutes
    }
  };
}

// User registration
export async function registerUser(username, email, password) {
  const users = await loadUsers();
  
  // Check if user already exists
  if (users[username] || Object.values(users).find(u => u.email === email)) {
    throw new Error('User already exists');
  }
  
  const userId = crypto.randomUUID();
  const hashedPassword = hashPassword(password);
  
  users[username] = {
    id: userId,
    username,
    email,
    passwordHash: hashedPassword,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    apiKeys: {
      openai: '',
      serper: '',
      apollo: '',
      mailgun: '',
      sendgrid: ''
    }
  };
  
  await saveUsers(users);
  
  // Create default settings for new user
  await saveUserSettings(userId, getDefaultSettings());
  
  return { userId, username, email };
}

// User login
export async function loginUser(username, password) {
  const users = await loadUsers();
  const user = users[username];
  
  if (!user || user.passwordHash !== hashPassword(password)) {
    throw new Error('Invalid credentials');
  }
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  await saveUsers(users);
  
  return { userId: user.id, username: user.username, email: user.email };
}

// Verify master password for AI personality editor
export function verifyMasterPassword(password) {
  return hashPassword(password) === MASTER_PASSWORD_HASH;
}

// Get user settings
export async function getUserSettings(userId) {
  return await loadUserSettings(userId);
}

// Update user settings
export async function updateUserSettings(userId, settings) {
  await saveUserSettings(userId, settings);
  return settings;
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
  const users = await loadUsers();
  
  // Find user by email
  const user = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error('No account found with that email address');
  }
  
  // Generate a 6-digit reset token
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
  
  // Clear any existing reset tokens for this user
  user.resetToken = token;
  user.resetTokenExpiry = tokenExpiry.toISOString();
  
  await saveUsers(users);
  
  return {
    token,
    username: user.username,
    expiry: tokenExpiry
  };
}

// Verify password reset token
export async function verifyPasswordResetToken(token) {
  const users = await loadUsers();
  
  // Find user with this token
  const user = Object.values(users).find(u => u.resetToken === token);
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
}

// Reset password using token
export async function resetPassword(token, newPassword) {
  const users = await loadUsers();
  
  // Find user with this token
  const userEntry = Object.entries(users).find(([_, u]) => u.resetToken === token);
  if (!userEntry) {
    throw new Error('Invalid reset token');
  }
  
  const [userId, user] = userEntry;
  
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
  
  // Update password and clear reset token
  user.password = hashPassword(newPassword);
  user.lastPasswordReset = new Date().toISOString();
  delete user.resetToken;
  delete user.resetTokenExpiry;
  
  await saveUsers(users);
  
  return {
    username: user.username,
    email: user.email
  };
}

// Get user by email
export async function getUserByEmail(email) {
  const users = await loadUsers();
  return Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
}
