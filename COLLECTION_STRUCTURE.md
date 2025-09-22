# ExaMark Collection Structure - FINAL

## ✅ Current Zilliz Collections (Post-Cleanup)

### 1. **email_tracking_events** (MAIN COLLECTION)
- **Purpose**: All email tracking events (opens, clicks, replies, AI responses)
- **Used by**: Netlify webhook, local server, polling system
- **Event Types**: 
  - `email_open` - When someone opens an email
  - `lead_message` - When someone replies to an email  
  - `ai_reply` - When AI generates a response
- **Tracking ID Format**: `tracking-76e84c79_1234567890_abc123`
- **User Code**: `76e84c79` (first 8 chars of user ID)

### 2. **agent_settings** (SETTINGS COLLECTION)  
- **Purpose**: User-specific AI agent settings
- **Used by**: Netlify webhook for personalized responses
- **Setting Format**: `setting_key_user_76e84c79`
- **Examples**:
  - `calendar_id_user_76e84c79` = `colton.fidd@gmail.com`
  - `company_name_user_76e84c79` = `Exabits`
  - `response_tone_user_76e84c79` = `professional_friendly`

## ❌ Removed Collections (Cleanup)

### ~~email_reply_events~~ (REMOVED)
- **Was**: Redundant local reply tracking
- **Problem**: Created duplicate tracking system
- **Solution**: Consolidated into `email_tracking_events`

## 🔄 Tracking ID Flow

1. **Local Email**: `tracking-76e84c79_1758505035574_85cb82e0`
2. **Lead Replies**: Netlify extracts `76e84c79` user code
3. **Settings Lookup**: Finds `calendar_id_user_76e84c79`
4. **AI Response**: `ai-response-tracking-76e84c79_1758505035574_85cb82e0-1758505200000`
5. **Calendar Event**: Created in `colton.fidd@gmail.com` calendar

## ✅ Benefits of Single Collection System

- **Consistency**: All events in one place
- **No Duplication**: Single source of truth
- **Better Performance**: No cross-collection queries
- **Simpler Maintenance**: One schema to manage
- **User Code Support**: Full multi-user capability

---
*Updated: September 22, 2025*
*Status: Production Ready ✅*
