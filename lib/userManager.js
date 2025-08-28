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
    lastLogin: null
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
  const settings = await loadUserSettings(userId);
  return settings.apiKeys;
}

// Get user's AI personality settings
export async function getUserAiPersonality(userId) {
  const settings = await loadUserSettings(userId);
  return settings.aiPersonality;
}
