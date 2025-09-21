// Add this to your webhook function to handle multi-user settings

/**
 * Get user ID from email address for multi-user settings
 */
async function getUserIdFromEmail(emailAddress) {
  try {
    // For now, simple mapping - you can enhance this
    const emailToUserMap = {
      // Add your email mappings here
      'colto@exabits.com': 'colto',
      'admin@exabits.com': 'admin',
      // Add more users as needed
    };

    // Extract domain to handle multiple emails per user
    const domain = emailAddress.split('@')[1];
    const localPart = emailAddress.split('@')[0];

    // Check direct mapping first
    if (emailToUserMap[emailAddress]) {
      return emailToUserMap[emailAddress];
    }

    // Fallback: use local part as user ID for company domains
    if (domain === 'exabits.com') {
      return localPart; // e.g., colto@exabits.com → 'colto'
    }

    // Default fallback
    return 'default';
    
  } catch (error) {
    console.error('[USER MAPPING] Error getting user ID:', error);
    return 'default';
  }
}

// Update your loadAgentSettings call
async function loadAgentSettingsForEmail(emailAddress) {
  try {
    const userId = await getUserIdFromEmail(emailAddress);
    console.log(`[USER MAPPING] Email ${emailAddress} → User ${userId}`);
    
    // Load settings for this specific user
    const settings = await loadAgentSettings(userId);
    return { settings, userId };
    
  } catch (error) {
    console.error('[USER MAPPING] Error loading user settings:', error);
    // Fallback to default
    const settings = await loadAgentSettings('default');
    return { settings, userId: 'default' };
  }
}
