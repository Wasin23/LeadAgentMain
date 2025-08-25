# 🤖 Lead Contact Agent - Automated Lead Generation & Email Outreach

## Overview

The Lead Contact Agent is an intelligent automation system that continuously finds high-quality prospects for Exabits and sends them personalized marketing emails. It operates on a 12-hour cycle, sending 5 targeted emails per cycle while avoiding duplicates.

## 🎯 Features

### **Automated Lead Research**
- Searches multiple industries for companies needing AI/GPU infrastructure
- Uses Apollo API to find high-quality prospects with contact information
- Targets companies in: AI, ML, fintech, healthcare tech, autonomous vehicles, robotics, etc.
- Intelligent lead scoring and ranking system

### **Personalized Email Outreach**
- Generates custom emails tailored to each company's profile
- Includes 3 specific reasons why Exabits would benefit their business
- Professional messaging from ExaMark with Exabits company details
- Avoids generic marketing language

### **Smart Duplicate Prevention**
- Tracks all emailed companies in persistent database
- Ensures no company is contacted twice until ~95 others are contacted first
- Maintains lead queue and rotation system

### **Continuous Operation**
- Runs automatically every 12 hours
- Persistent state management - survives server restarts
- Start/stop controls with seamless resumption
- Real-time status monitoring and logging

## 🛠️ System Architecture

### **Core Components**

1. **LeadContactAgent** (`agent/leadContactAgent.js`)
   - Main agent class with cycle management
   - Lead research and ranking logic
   - Email generation and sending
   - State persistence and recovery

2. **API Routes** (`routes/leadAgent.js`)
   - RESTful endpoints for agent control
   - Status monitoring and reporting
   - Manual cycle triggering

3. **Frontend Interface** (in `public/index.html`)
   - Real-time status dashboard
   - Agent control buttons
   - Activity logging and monitoring

### **Data Storage**

- **State File**: `agent/leadAgent_state.json` - Tracks current cycle, running status
- **Leads Database**: `agent/leads_database.json` - All leads found and emailed companies list

## 🚀 Usage Guide

### **Starting the Agent**
1. Navigate to the Lead Contact Agent tab
2. Click "▶️ Start Agent"
3. Agent will immediately run first cycle and schedule subsequent cycles

### **Monitoring Status**
- **Status**: Shows if agent is running or stopped
- **Current Cycle**: Number of completed cycles
- **Companies Emailed**: Total companies contacted
- **Leads in Queue**: Available leads remaining
- **Next Cycle**: Time until next automatic cycle

### **Manual Controls**
- **🔄 Run Cycle Now**: Force immediate cycle execution
- **⏹️ Stop Agent**: Stop automatic cycles (preserves state)
- **🔄 Reset Agent**: Reset cycle count (keeps leads database)
- **🔄 Refresh**: Update status display

## ⚙️ Configuration

### **Target Industries**
```javascript
targetIndustries = [
  'artificial intelligence', 'machine learning', 'fintech',
  'healthcare tech', 'autonomous vehicles', 'robotics',
  'cryptocurrency', 'computer vision', 'data analytics',
  'cloud computing', 'gaming', 'scientific research',
  'biotechnology', 'pharmaceutical research'
]
```

### **Lead Scoring Criteria**
- **Company Size**: 50-1000 employees (preferred)
- **Industry Relevance**: AI/ML keywords in description
- **Contact Quality**: Decision maker titles (CTO, CEO, VP, etc.)
- **Email Availability**: Valid email addresses
- **Growth Indicators**: Recent funding mentions

### **Cycle Settings**
- **Production**: 12 hours between cycles
- **Testing**: 2 minutes between cycles (configurable)
- **Emails per Cycle**: 5 companies
- **Lead Research**: ~60 prospects per research session

## 📧 Email Template Strategy

### **Personalization Elements**
- Company name and industry-specific opening
- Contact's first name and title
- Company description analysis for relevance
- Tailored benefits based on company profile

### **Core Messaging**
- Exabits company credentials (Founded 2021, San Mateo)
- Founders: Hoansoo Lee (CEO), Zachary Bright (CTO, Princeton)
- NVIDIA H100/H200 GPU specialization
- Performance advantages over general cloud providers
- AI-HPC expertise and custom solutions

### **Call-to-Action**
- Professional but approachable tone
- Clear value proposition
- Invitation for discussion about specific needs

## 🔧 API Endpoints

### **POST /api/lead-agent/start**
Start the Lead Contact Agent
```json
{
  "success": true,
  "message": "Lead Contact Agent started...",
  "data": {
    "currentCycle": 1,
    "nextCycleIn": "12 hours"
  }
}
```

### **POST /api/lead-agent/stop**
Stop the Lead Contact Agent
```json
{
  "success": true,
  "message": "Lead Contact Agent stopped successfully",
  "data": {
    "cyclesCompleted": 5
  }
}
```

### **GET /api/lead-agent/status**
Get current agent status
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "currentCycle": 3,
    "totalLeadsFound": 150,
    "companiesEmailed": 15,
    "remainingLeads": 135,
    "lastCycleTime": "2025-08-24T12:00:00Z",
    "nextCycleTime": "2025-08-25T00:00:00Z"
  }
}
```

### **POST /api/lead-agent/run-cycle**
Force run a cycle immediately
```json
{
  "success": true,
  "data": {
    "cycle": 4,
    "emailsSent": 5,
    "emailsFailed": 0,
    "selectedCompanies": ["TechCorp", "AI Innovations", "DataFlow Inc"]
  }
}
```

### **POST /api/lead-agent/reset**
Reset agent state (keep leads database)
```json
{
  "success": true,
  "message": "Agent reset successfully"
}
```

## 🧪 Testing & Development

### **Test Mode Configuration**
Change cycle interval in `leadContactAgent.js`:
```javascript
// For testing - 2 minutes
this.cycleInterval = 2 * 60 * 1000;

// For production - 12 hours  
this.cycleInterval = 12 * 60 * 60 * 1000;
```

### **Manual Testing**
1. Start agent in test mode
2. Use "Run Cycle Now" for immediate testing
3. Monitor activity logs for real-time feedback
4. Check email logs for sent messages

### **Debugging**
- Check console logs for detailed agent activity
- Monitor state files for persistence verification
- Use activity log for real-time status updates

## 🔒 Security & Best Practices

### **Rate Limiting**
- 2-second delays between Apollo API calls
- 1-second delays between email sends
- Respectful API usage patterns

### **Error Handling**
- Graceful failure recovery
- Continued operation despite individual failures
- Comprehensive error logging

### **Data Privacy**
- Secure handling of contact information
- Compliant email marketing practices
- Opt-out considerations for future enhancement

## 📈 Performance Metrics

### **Expected Output**
- **Daily**: 10 personalized emails (2 cycles)
- **Weekly**: 70 targeted prospects contacted
- **Monthly**: ~300 high-quality leads reached

### **Quality Metrics**
- Lead scoring ensures high-relevance prospects
- Personalized messaging improves engagement
- Duplicate prevention maintains professionalism

## 🚀 Future Enhancements

### **Planned Features**
- Email response tracking and follow-up automation
- A/B testing for email templates
- Integration with CRM systems
- Advanced analytics and reporting
- LinkedIn integration for additional contact discovery

### **Scalability**
- Multi-thread support for faster research
- Advanced lead qualification criteria
- Industry-specific email templates
- Automated follow-up sequences

## 🎯 Business Impact

The Lead Contact Agent transforms Exabits' sales process by:
- **Automating** time-consuming prospecting work
- **Scaling** outreach efforts without additional manual labor  
- **Personalizing** communications for higher engagement
- **Maintaining** consistent professional outreach schedule
- **Tracking** and optimizing lead generation performance

This system enables Exabits to reach hundreds of qualified prospects monthly while maintaining personalized, professional communication standards.
