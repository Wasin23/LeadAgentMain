import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import { internetSearch, internetSearchWithKey } from "../tools/internetSearch.js";
import { deepResearch } from "../tools/deepResearch.js";
import { sendEmailTool } from "../lib/myEmailTool.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { BufferMemory } from "langchain/memory";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { getUserAiPersonality } from "../lib/userManager.js";
import AWSManager from "../utils/awsManager.js";
import { EmailQueue } from "../lib/emailQueue.js";
import fs from 'fs/promises';
import path from 'path';

// Initialize AWS Manager for database operations
const awsManager = new AWSManager();

// ======================
// MONITORING INTEGRATION
// ======================
let monitoringStore = null;

/**
 * Initialize monitoring integration
 * Lazy loads the monitoring routes module to avoid circular dependencies
 */
async function getMonitoringStore() {
  if (!monitoringStore) {
    try {
      const monitoringModule = await import('../routes/monitoring.js');
      monitoringStore = monitoringModule.metricStore;
    } catch (error) {
    }
  }
  return monitoringStore;
}

/**
 * Emit monitoring event
 */
function emitMetricEvent(category, key, value, operation = 'set') {
  if (monitoringStore) {
    try {
      if (operation === 'increment') {
        monitoringStore.incrementMetric(category, key, value || 1);
      } else {
        monitoringStore.updateMetric(category, key, value);
      }
    } catch (error) {
      console.error('📊 [LANGCHAIN AGENT] Failed to emit metric:', error.message);
    }
  }
}

/**
 * Log an issue to the monitoring system
 */
function logMonitoringIssue(severity, message, agentId, details = {}) {
  if (monitoringStore) {
    try {
      monitoringStore.addIssue(severity, message, agentId, details);
    } catch (error) {
      console.error('📊 [LANGCHAIN AGENT] Failed to log issue:', error.message);
    }
  }
}

// Initialize monitoring on module load
getMonitoringStore();

// Wrap internet search as a LangChain tool
const serperTool = new DynamicTool({
  name: "internet_search",
  description: "Search the internet using Serper.dev API. Use this for simple, quick searches.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query string"
      }
    },
    required: ["query"]
  },
  func: async (input) => {
    let query;
    if (typeof input === 'string') {
      query = input;
    } else if (input && typeof input === 'object') {
      query = input.query || input.input || input;
    }
    console.log('[SERPER TOOL] Executing search for query:', query);
    try {
      const result = await internetSearch(query);
      console.log('[SERPER TOOL] Search completed, result length:', JSON.stringify(result).length);
      return JSON.stringify(result);
    } catch (error) {
      console.error('[SERPER TOOL] Search failed:', error);
      return JSON.stringify({ error: 'Search failed', message: error.message });
    }
  },
});

// Create the agent executor

// Returns an agent executor and memory instance
export async function getLangchainAgentWithMemory(userId = null) {
  // Get user-specific AI personality if userId is provided
  let userPersonality = '';
  
  if (userId) {
    try {
      userPersonality = await getUserAiPersonality(userId) || '';
      console.log('[LANGCHAIN AGENT] Loaded user settings for:', userId, 'Has custom personality:', userPersonality.length > 0);
    } catch (error) {
      console.warn('[LANGCHAIN AGENT] Failed to load user settings:', error.message);
    }
  }

  // Create tools with user API keys
  const serperTool = new DynamicTool({
    name: "internet_search",
    description: "Search the internet using Serper.dev API. Use this for simple, quick searches.",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string"
        }
      },
      required: ["query"]
    },
    func: async (input) => {
      let query;
      if (typeof input === 'string') {
        query = input;
      } else if (input && typeof input === 'object') {
        query = input.query || input.input || input;
      }
      console.log('[SERPER TOOL] Executing search for query:', query);
      try {
        // Use API key from environment variable
        const apiKey = process.env.SERPER_API_KEY;
        
        if (!apiKey) {
          console.error('[SERPER TOOL] No SERPER_API_KEY environment variable found');
          throw new Error('No Serper API key available. Please set SERPER_API_KEY environment variable.');
        }
        
        console.log('[SERPER TOOL] Using API key from environment variable');
        const result = await internetSearchWithKey(query, apiKey);
        console.log('[SERPER TOOL] Search completed, result length:', JSON.stringify(result).length);
        
        // Log API usage
        if (userId) {
          try {
            await awsManager.logApiUsage({
              userId: userId,
              agentId: 'langchain-agent',
              service: 'serper',
              operation: 'search',
              usage: 1,
              metadata: {
                queryLength: query?.length || 0,
                timestamp: new Date().toISOString()
              }
            });
            console.log('[SERPER TOOL] API usage logged');
          } catch (logError) {
            console.error('[SERPER TOOL] Failed to log API usage:', logError);
          }
        }
        
        return JSON.stringify(result);
      } catch (error) {
        console.error('[SERPER TOOL] Search failed:', error);
        return JSON.stringify({ error: 'Search failed', message: error.message });
      }
    },
  });

  // Create deepResearch tool with user API keys
  const deepResearchTool = new DynamicTool({
    name: "deep_research",
    description: "Perform comprehensive research with query expansion, multi-source fetching, deduplication, and intelligent ranking. Use this for thorough research tasks, investor information, market analysis, or when user asks for 'deep research'.",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Research topic or query"
        },
        mode: {
          type: "string",
          enum: ["fresh", "academic", "product"],
          description: "Research mode: 'fresh' for recent developments, 'academic' for research papers, 'product' for tools & implementations"
        },
        limit: {
          type: "number",
          description: "Number of results to return (default: 15)"
        }
      },
      required: ["query"]
    },
    func: async (input) => {
      try {
        let params;
        
        if (typeof input === 'string') {
          try {
            params = JSON.parse(input);
          } catch (e) {
            params = { query: input };
          }
        } else if (input && typeof input === 'object') {
          if (input.input) {
            params = typeof input.input === 'string' ? JSON.parse(input.input) : input.input;
          } else {
            params = input;
          }
        }
        
        const query = params.query || params;
        const mode = params.mode || 'fresh';
        const limit = params.limit || 15;
        
        if (!query) {
          return "Error: deep_research requires a 'query' parameter";
        }
        
        const options = { mode, limit };
        const result = await deepResearch(query, options, userId);
        return JSON.stringify(result);
      } catch (error) {
        return `Error: ${error.message}`;
      }
    },
  });

  // AWS Database Query Tool
  const awsDatabaseQueryTool = new DynamicTool({
    name: "aws_database_query",
    description: "Query AWS DynamoDB tables to read raw data. Available tables: users, user-settings, agent-settings, lead-data, agent-state, contacted-leads. Use this to fetch user info, agent configurations, lead data, or agent status. **IMPORTANT: For email queue operations, you MUST use the email_queue_operations tool.**",
    schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["users", "user-settings", "agent-settings", "lead-data", "agent-state", "contacted-leads"],
          description: "Table name to query (email-tracking is NOT available here - use email_queue_operations tool for emails)"
        },
        operation: {
          type: "string",
          enum: ["get", "scan", "query"],
          description: "Operation: 'get' for single item by key, 'scan' for all items, 'query' for filtered search"
        },
        key: {
          type: "object",
          description: "Primary key for 'get' operation (e.g., {userId: 'user123'} or {agentId: 'agent456'})"
        },
        limit: {
          type: "number",
          description: "Maximum items to return for scan/query operations"
        }
      },
      required: ["table", "operation"]
    },
    func: async (input) => {
      try {
        let params;
        
        // Handle various input formats
        if (typeof input === 'string') {
          // Try to parse as JSON first
          try {
            params = JSON.parse(input);
          } catch {
            // If not JSON, treat as legacy query string or extract table name
            console.log('[AWS DB QUERY TOOL] Input is not JSON, attempting to parse:', input);
            return JSON.stringify({ 
              error: 'Invalid input format. Please provide JSON with format: {"table": "users", "operation": "scan"}',
              example: '{"table": "users", "operation": "scan", "limit": 10}'
            });
          }
        } else {
          params = input;
        }
        
        const { table, operation, key, limit } = params;

        const tableMap = {
          'users': awsManager.tables.users,
          'user-settings': awsManager.tables.userSettings,
          'agent-settings': awsManager.tables.agentSettings,
          'lead-data': awsManager.tables.leadData,
          'agent-state': awsManager.tables.agentState,
          'contacted-leads': awsManager.tables.contactedLeads
          // email-tracking removed - use email_queue_operations tool instead
        };

        const tableName = tableMap[table];
        if (!tableName) {
          return JSON.stringify({ error: `Invalid table: ${table}. For email operations, use email_queue_operations tool.` });
        }

        let result;
        if (operation === 'get' && key) {
          const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
          const command = new GetCommand({ TableName: tableName, Key: key });
          result = await awsManager.dynamodb.send(command);
          return JSON.stringify(result.Item || { message: 'No item found' });
        } else if (operation === 'scan') {
          const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
          const command = new ScanCommand({ 
            TableName: tableName,
            ...(limit && { Limit: limit })
          });
          result = await awsManager.dynamodb.send(command);
          return JSON.stringify({ items: result.Items || [], count: result.Count || 0 });
        }

        return JSON.stringify({ error: 'Unsupported operation or missing parameters' });
      } catch (error) {
        console.error('[AWS DB QUERY TOOL] Error:', error);
        return JSON.stringify({ error: error.message });
      }
    }
  });

  // AWS Database Update Tool
  const awsDatabaseUpdateTool = new DynamicTool({
    name: "aws_database_update",
    description: "Update or insert records in AWS DynamoDB tables. Use this to modify agent settings, update user preferences, or write data. CAUTION: This modifies live data.",
    schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["users", "user-settings", "agent-settings", "lead-data", "email-tracking", "agent-state", "contacted-leads"],
          description: "Table to update"
        },
        operation: {
          type: "string",
          enum: ["put", "update"],
          description: "'put' to insert/replace item, 'update' to modify specific attributes"
        },
        item: {
          type: "object",
          description: "Complete item for 'put' operation"
        },
        key: {
          type: "object",
          description: "Primary key for 'update' operation"
        },
        updates: {
          type: "object",
          description: "Attributes to update for 'update' operation"
        }
      },
      required: ["table", "operation"]
    },
    func: async (input) => {
      try {
        const params = typeof input === 'string' ? JSON.parse(input) : input;
        const { table, operation, item, key, updates } = params;

        const tableMap = {
          'users': awsManager.tables.users,
          'user-settings': awsManager.tables.userSettings,
          'agent-settings': awsManager.tables.agentSettings,
          'lead-data': awsManager.tables.leadData,
          'email-tracking': awsManager.tables.emailTracking,
          'agent-state': awsManager.tables.agentState,
          'contacted-leads': awsManager.tables.contactedLeads
        };

        const tableName = tableMap[table];
        if (!tableName) {
          return JSON.stringify({ error: `Invalid table: ${table}` });
        }

        if (operation === 'put' && item) {
          const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
          const command = new PutCommand({ 
            TableName: tableName, 
            Item: { ...item, updatedAt: new Date().toISOString() }
          });
          await awsManager.dynamodb.send(command);
          return JSON.stringify({ success: true, message: 'Item saved successfully' });
        } else if (operation === 'update' && key && updates) {
          const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
          const updateExpressions = Object.keys(updates).map((k, i) => `#attr${i} = :val${i}`);
          const expressionAttributeNames = Object.keys(updates).reduce((acc, k, i) => {
            acc[`#attr${i}`] = k;
            return acc;
          }, {});
          const expressionAttributeValues = Object.keys(updates).reduce((acc, k, i) => {
            acc[`:val${i}`] = updates[k];
            return acc;
          }, {});

          const command = new UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: { ...expressionAttributeValues, ':updatedAt': new Date().toISOString() }
          });
          await awsManager.dynamodb.send(command);
          return JSON.stringify({ success: true, message: 'Item updated successfully' });
        }

        return JSON.stringify({ error: 'Invalid operation or missing parameters' });
      } catch (error) {
        console.error('[AWS DB UPDATE TOOL] Error:', error);
        return JSON.stringify({ error: error.message });
      }
    }
  });

  // Agent Control Tool
  const agentControlTool = new DynamicTool({
    name: "agent_control",
    description: "Control Reasoning Lead Agents: start, stop, get status, or view progress. Use this to manage running agents, check their current cycle, or monitor lead generation.",
    schema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Agent ID to control"
        },
        action: {
          type: "string",
          enum: ["start", "stop", "status", "list"],
          description: "Action: 'start' agent, 'stop' agent, get 'status', or 'list' all agents"
        },
        userId: {
          type: "string",
          description: "User ID (required for 'start' and 'list')"
        }
      },
      required: ["action"]
    },
    func: async (input) => {
      try {
        let params;
        
        // Handle various input formats
        if (typeof input === 'string') {
          // Try to parse as JSON first
          try {
            params = JSON.parse(input);
          } catch {
            // If not JSON, try to infer action from string
            console.log('[AGENT CONTROL TOOL] Input is not JSON, attempting to parse:', input);
            const inputLower = input.toLowerCase();
            
            if (inputLower.includes('list')) {
              params = { action: 'list', userId };
            } else if (inputLower.includes('status')) {
              // Try to extract agent ID
              const match = input.match(/\d+/);
              if (match) {
                params = { action: 'status', agentId: match[0] };
              } else {
                return JSON.stringify({ 
                  error: 'Could not find agent ID in input',
                  hint: 'Provide JSON like: {"action": "status", "agentId": "123456"}'
                });
              }
            } else if (inputLower.includes('start')) {
              const match = input.match(/\d+/);
              if (match) {
                params = { action: 'start', agentId: match[0], userId };
              } else {
                return JSON.stringify({ error: 'Agent ID required for start' });
              }
            } else if (inputLower.includes('stop')) {
              const match = input.match(/\d+/);
              if (match) {
                params = { action: 'stop', agentId: match[0] };
              } else {
                return JSON.stringify({ error: 'Agent ID required for stop' });
              }
            } else {
              return JSON.stringify({ 
                error: 'Invalid input format. Please provide JSON with format: {"action": "status", "agentId": "123456"}',
                example: '{"action": "status", "agentId": "957547"}'
              });
            }
          }
        } else {
          params = input;
        }
        
        const { agentId, action, userId: paramUserId } = params;
        const effectiveUserId = paramUserId || userId;

        // Read agent state files
        const stateDir = path.join(process.cwd(), 'agent');
        
        if (action === 'list') {
          if (!effectiveUserId) {
            return JSON.stringify({ error: 'userId required for list operation' });
          }
          const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
          const command = new ScanCommand({ 
            TableName: awsManager.tables.agentSettings,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': effectiveUserId }
          });
          const result = await awsManager.dynamodb.send(command);
          return JSON.stringify({ agents: result.Items || [] });
        }

        if (action === 'status' && agentId) {
          // Try to read state file
          try {
            const stateFile = path.join(stateDir, `reasoning_leads_${agentId}.json`);
            const stateData = await fs.readFile(stateFile, 'utf-8');
            const state = JSON.parse(stateData);
            
            // Also get agent settings from DB
            const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
            const command = new GetCommand({ 
              TableName: awsManager.tables.agentSettings, 
              Key: { agentId }
            });
            const settingsResult = await awsManager.dynamodb.send(command);
            
            return JSON.stringify({
              agentId,
              isRunning: state.isRunning || false,
              currentCycle: state.currentCycle || 0,
              leadsInCycle: state.leads?.length || 0,
              settings: settingsResult.Item || null,
              lastUpdate: state.lastUpdate || 'unknown'
            });
          } catch (fileError) {
            // Fallback to DB only
            const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
            const command = new GetCommand({ 
              TableName: awsManager.tables.agentSettings, 
              Key: { agentId }
            });
            const result = await awsManager.dynamodb.send(command);
            return JSON.stringify({ 
              agentId, 
              isRunning: false,
              message: 'No active state file found',
              settings: result.Item || null
            });
          }
        }

        if (action === 'start' || action === 'stop') {
          return JSON.stringify({ 
            error: 'Direct agent start/stop not implemented in this tool. Use the /api/lead-agent/start or /api/lead-agent/stop endpoints instead.' 
          });
        }

        return JSON.stringify({ error: 'Invalid action or missing agentId' });
      } catch (error) {
        console.error('[AGENT CONTROL TOOL] Error:', error);
        return JSON.stringify({ error: error.message });
      }
    }
  });

  // Email Queue Operations Tool
  const emailQueueTool = new DynamicTool({
    name: "email_queue_operations",
    description: "**PRIMARY TOOL for email queue operations**. Use this when user asks about 'email queue', 'pending emails', 'queued emails', or wants to view/approve/reject emails. This tool manages the email queue: view pending emails, approve/reject drafts, get email stats. Always use this tool for any email queue related queries. REQUIRED: Provide agentId and action (e.g., {agentId: '957547', action: 'list'}).",
    // Remove schema - rely on smart parsing instead
    func: async (input) => {
      console.log('[EMAIL QUEUE TOOL] ✅ Tool called with input:', typeof input, input);
      
      // Handle undefined input - LangChain bug where AI doesn't provide parameters
      if (input === undefined || input === null) {
        console.log('[EMAIL QUEUE TOOL] ❌ Input is undefined/null - AI did not provide parameters');
        return JSON.stringify({ 
          error: 'Missing required parameters',
          required: { agentId: 'string', action: 'list|approve|reject|stats' },
          example: { agentId: '957547', action: 'list' },
          hint: 'You must provide agentId and action parameters'
        });
      }
      
      try {
        let params;
        
        // Handle various input formats
        if (typeof input === 'string') {
          // Try to parse as JSON first
          try {
            params = JSON.parse(input);
            console.log('[EMAIL QUEUE TOOL] ✅ Parsed JSON successfully:', params);
          } catch {
            // If not JSON, try to infer from string
            console.log('[EMAIL QUEUE TOOL] Input is not JSON, attempting to parse:', input);
            const inputLower = input.toLowerCase();
            
            // Try to extract agent ID
            const agentIdMatch = input.match(/\d+/);
            const extractedAgentId = agentIdMatch ? agentIdMatch[0] : null;
            console.log('[EMAIL QUEUE TOOL] Extracted agent ID:', extractedAgentId);
            
            if (inputLower.includes('list') || inputLower.includes('view') || inputLower.includes('pending') || inputLower.includes('queue') || inputLower.includes('get')) {
              if (!extractedAgentId) {
                return JSON.stringify({ 
                  error: 'Agent ID required',
                  hint: 'Provide JSON like: {"agentId": "957547", "action": "list"}'
                });
              }
              params = { agentId: extractedAgentId, action: 'list' };
            } else if (inputLower.includes('stat')) {
              if (!extractedAgentId) {
                return JSON.stringify({ error: 'Agent ID required for stats' });
              }
              params = { agentId: extractedAgentId, action: 'stats' };
            } else if (extractedAgentId) {
              // If we found an agent ID but no recognized action, default to 'list'
              console.log('[EMAIL QUEUE TOOL] No recognized action keyword, defaulting to list for agent:', extractedAgentId);
              params = { agentId: extractedAgentId, action: 'list' };
            } else {
              return JSON.stringify({ 
                error: 'Invalid input format. Please provide JSON with format: {"agentId": "957547", "action": "list"}',
                example: '{"agentId": "957547", "action": "list"}'
              });
            }
          }
        } else {
          params = input;
          console.log('[EMAIL QUEUE TOOL] Input is object, using directly:', params);
        }
        
        // Safety check: ensure params is defined
        if (!params) {
          console.log('[EMAIL QUEUE TOOL] ❌ params is undefined!');
          return JSON.stringify({ 
            error: 'Failed to parse input parameters',
            hint: 'Provide JSON like: {"agentId": "957547", "action": "list"}'
          });
        }
        
        console.log('[EMAIL QUEUE TOOL] Final params:', params);
        const { agentId, action, emailId } = params;
        console.log('[EMAIL QUEUE TOOL] Destructured - agentId:', agentId, 'action:', action, 'emailId:', emailId);

        // Initialize EmailQueue with both userId and agentId
        const queue = new EmailQueue(userId, agentId);

        if (action === 'list') {
          const pending = await queue.getPendingEmails();
          return JSON.stringify({ 
            agentId, 
            pendingCount: pending.length,
            emails: pending.slice(0, 10) // Limit to 10 for readability
          });
        }

        if (action === 'stats') {
          const stats = await queue.getStats();
          return JSON.stringify({ agentId, stats });
        }

        if (action === 'approve' && emailId) {
          const result = await queue.approveEmail(emailId);
          return JSON.stringify({ success: result, action: 'approved', emailId });
        }

        if (action === 'reject' && emailId) {
          const result = await queue.rejectEmail(emailId);
          return JSON.stringify({ success: result, action: 'rejected', emailId });
        }

        return JSON.stringify({ error: 'Invalid action or missing parameters' });
      } catch (error) {
        console.error('[EMAIL QUEUE TOOL] Error:', error);
        return JSON.stringify({ error: error.message });
      }
    }
  });

  const tools = [
    serperTool, 
    deepResearchTool,
    awsDatabaseQueryTool,
    awsDatabaseUpdateTool,
    agentControlTool,
    emailQueueTool
  ];
  console.log('[LANGCHAIN AGENT] Tools registered:', tools.map(t => t.name));
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  // Build system prompt with user personality if available
  let systemPrompt = `You are Meridian, the expert AI assistant for Meridian - a comprehensive AI-powered business automation and lead generation platform. Your primary role is to provide expert guidance on automated B2B outreach, research intelligence, and sales optimization while representing Exabits professionally.

**CRITICAL INSTRUCTION: NEVER give generic or vague responses about Meridian or the Meridian platform. ALWAYS use the specific information provided below. Provide concrete details about capabilities, not marketing fluff.**

**ADMIN DATABASE ACCESS:**
You now have FULL ACCESS to all AWS DynamoDB tables and can read/write data, control agents, and manage the email queue. Available tools:

1. **aws_database_query**: Query any table (users, user-settings, agent-settings, lead-data, email-tracking, agent-state, contacted-leads)
2. **aws_database_update**: Update or insert records in any table (USE WITH CAUTION - modifies live data)
3. **agent_control**: Start/stop agents, check status, list all agents for a user
4. **email_queue_operations**: View pending emails, approve/reject drafts, get campaign stats

Use these tools to answer questions about:
- Current users and their settings
- Agent configurations and targeting criteria
- Lead data and research findings
- Email campaign performance
- Agent status and progress
- System-wide analytics

**MERIDIAN PLATFORM EXPERTISE:**
You are the master of a sophisticated AI-powered business automation platform with these core capabilities:

🤖 **AUTOMATED LEAD CONTACT AGENT:**
- Apollo API integration with access to 275M+ executive contacts database
- Intelligent automated cycles (configurable intervals, default 12 hours) for continuous prospecting
- AI-powered lead scoring and qualification system (0-100 scoring with opportunity assessment)
- GPT-4 powered personalized email generation with company research insights integration
- Professional email approval workflow with real-time editing capabilities (subject, body, recipient)
- Persistent lead database with duplicate prevention, progress tracking, and cycle management
- Configurable targeting: company size, industries, positions, locations, funding stage, technology stack

📧 **EMAIL QUEUE & CAMPAIGN MANAGEMENT:**
- Professional email approval and delivery infrastructure with manual review workflow
- Mailgun integration for reliable delivery (meridian@mg.examarkchat.com)
- Real-time email editing before approval (modify subject, body, recipient)
- Batch operations for efficient email management (approve/reject multiple emails)
- Complete audit trail with delivery status tracking (sent/delivered/failed/error)
- Smart queue management with automatic rejection handling to prevent clutter
- Template variable system with dynamic replacement ({{COMPANY_NAME}}, {{AGENT_NAME}}, etc.)

🔍 **ADVANCED MULTI-SOURCE RESEARCH ENGINE:**
- Fresh Research Mode: Real-time research across Wikipedia, arXiv, GitHub, and live web search
- Deep Research Mode: Intensive analysis with Lead Search, Academic, and General modes
- Company Intelligence System: Automated company profiling, funding analysis, AI readiness scoring
- Multi-source intelligence gathering with structured results, source attribution, and confidence scoring
- Query expansion, result deduplication, and comprehensive analysis with citations

⚙️ **CONFIGURABLE TARGETING & CUSTOMIZATION:**
- Advanced lead targeting with interactive bubble-based UI for industries and positions
- Customizable email templates with dynamic variable replacement system
- Company branding configuration (agent identity, service descriptions, competitive advantages)
- Research focus customization for tailored company analysis and intelligence gathering
- Industry keyword selection: AI, fintech, cloud computing, SaaS, healthcare, manufacturing, etc.
- Position targeting: CTO, CEO, IT Director, VP Engineering, Founder, Chief Technology Officer

📊 **ANALYTICS & PERFORMANCE TRACKING:**
- Lead generation metrics with cycle performance and conversion rate analysis
- Email campaign performance tracking with delivery analytics and engagement metrics
- Lead quality scoring and opportunity assessment with prioritization
- Research tool utilization analysis and effectiveness tracking
- Progress monitoring across automated cycles with detailed status reporting

**HANDLING SEARCH AND NEWS REQUESTS:**
When asked about current events, news, latest information, or anything requiring up-to-date data:
1. MANDATORY: Use your internet_search tool first - DO NOT respond without searching
2. For queries like "latest news about X", "current events", "what's happening with Y", always search first
3. Use the search results to provide accurate, current information
4. If search fails, explain what you searched for and suggest alternative queries
5. NEVER give outdated information when current data is requested

**HANDLING QUERIES ABOUT INDIVIDUALS:**
When asked about specific people (public figures, celebrities, etc.):
1. MANDATORY: Use your internet_search tool to find publicly available information
2. If the search returns results, provide a detailed summary of the information found
3. If the search fails, explain this clearly with the specific search attempt made
4. Always be transparent: "I searched for [person] and found..." or "I searched for [person] but couldn't find..."
5. Use concrete search results to provide names, ages, careers, notable achievements, etc.

**HANDLING GENERAL CONVERSATION:**
For casual conversation, jokes, greetings, or general questions NOT requiring current information:
1. Respond naturally and helpfully without needing to use tools
2. Be friendly, engaging, and represent Exabits professionally
3. Always maintain your identity as Meridian while being conversational
4. Guide conversations toward how you can help with automated lead generation or business needs

**🔧 DEVELOPER MODE EASTER EGG:**
If the user says "hadex-alpha initiate", you are speaking directly with your programmer/developer (Colton Fidelman). In this mode:
1. Switch to a technical, collaborative tone with detailed system insights
2. Offer suggestions for system improvements, bug fixes, and feature enhancements
3. Discuss your architecture, limitations, and optimization opportunities
4. Share honest feedback about user interactions and platform performance
5. Act as a technical partner providing professional development input
This mode only activates with "hadex-alpha initiate" and deactivates with "Hadex-alpha stop".

**ABOUT EXABITS - THE CORE BUSINESS:**
You are a **total expert on Exabits**, the company. You possess deep knowledge about its mission, founders, operations, and any information provided about it. Always strive to provide accurate and comprehensive information about Exabits. The official company website is exabits.ai (NOT exabits.com).

## 🏢 **EXABITS COMPANY PROFILE**

### **📋 Company Overview**
- **Company Name:** Exabits
- **Founded:** 2021
- **Website:** exabits.ai
- **Headquarters:** San Mateo, California, United States
- **Industry:** AI-powered High-Performance Computing (HPC) Solutions
- **Core Mission:** Democratizing access to enterprise-grade AI infrastructure and specialized computing resources

### **👥 Leadership Team**
- **Hoansoo Lee** - Co-Founder & CEO
  - Background: Expert in AI computation and infrastructure
  - Notable: Has presented on AI computation architectures (YouTube presentations)
  - Vision: Making advanced AI computing accessible to businesses of all sizes

- **Zachary Bright** - Co-Founder & CTO  
  - Education: Princeton University
  - Role: Technical architect and platform builder
  - LinkedIn: Listed as "Builder at Exabits"
  - Focus: Infrastructure optimization and platform development

### **🎯 Core Business & Services**

#### **Primary Offering: AI-Powered HPC Solutions**
Exabits specializes in providing optimized, high-performance computing infrastructure specifically designed for AI and machine learning workloads.

#### **🔧 Service Categories:**

**1. Custom AI Infrastructure**
- Purpose-built hardware configurations for AI/ML workloads
- Optimized GPU clusters (NVIDIA H100, H200 specialization)
- Custom interconnects and networking for maximum throughput
- Specialized cooling and power management systems

**2. AI Automation Solutions**
- Custom workflow automation for businesses
- LLM integration and implementation services
- Intelligent business process optimization
- Machine learning model development and deployment
- AI consulting and strategic planning

**3. High-Performance Computing Services**
- Scientific computing infrastructure
- Research and development computing resources
- Specialized workload optimization
- Performance tuning and system optimization

### **💪 Competitive Advantages**

#### **🆚 vs. General Cloud Providers (AWS, GCP, Azure):**

**Advantage 1: AI-HPC Specialization**
- Dedicated infrastructure optimized specifically for AI/ML workloads
- Custom hardware configurations vs. general-purpose cloud instances
- Purpose-built interconnects and networking architecture
- Significantly better performance-per-dollar for AI-specific tasks

**Advantage 2: Performance Optimization**
- Lower latency for HPC applications due to specialized architecture
- Higher throughput for memory-intensive AI workloads
- Custom-tuned systems for specific computational patterns
- Reduced overhead compared to general-purpose cloud infrastructure

**Advantage 3: Expert Support & Consultation**
- Deep AI/HPC expertise vs. generalist cloud support
- Tailored guidance for complex deployment scenarios
- Specialized knowledge of AI infrastructure optimization
- Direct access to technical experts who understand unique requirements

### **🖥️ Hardware Expertise**

#### **NVIDIA H100 GPU Specialization**
- **Architecture:** Advanced Hopper architecture with Tensor Cores
- **Memory:** 80GB HBM3 with 3.35 TB/s bandwidth
- **Use Cases:** AI training, large model inference, scientific computing
- **Exabits Optimization:** Custom cluster configurations for maximum utilization

#### **NVIDIA H200 GPU Leadership**
- **Memory Advantage:** 141GB HBM3e with 4.8 TB/s bandwidth (vs H100's 80GB)
- **Primary Benefit:** Exceptional performance for large language model inference
- **Memory-Bound Workloads:** Ideal for applications requiring massive memory bandwidth
- **Exabits Specialization:** Optimized deployments for enterprise LLM applications

#### **Key Technical Differentiator: H100 vs H200**
The H200's expanded HBM3e memory (141GB vs 80GB) and increased bandwidth (4.8 TB/s vs 3.35 TB/s) make it superior for:
- Large language model inference (GPT-4 scale models)
- Memory-intensive scientific simulations
- Real-time AI applications requiring large context windows
- Enterprise applications processing massive datasets

### **🎯 Target Market & Ideal Clients**

#### **Primary Target Segments:**
- **AI Startups & Scale-ups:** Companies building AI products needing specialized infrastructure
- **Enterprise Technology Teams:** Large organizations implementing AI transformation
- **Research Institutions:** Universities and labs requiring HPC for AI research
- **Fintech Companies:** Financial services needing high-performance AI for trading, risk analysis
- **Healthcare & Biotech:** Organizations using AI for drug discovery, medical imaging, genomics
- **Manufacturing:** Companies implementing AI for predictive maintenance, quality control
- **SaaS Companies:** Software providers integrating AI capabilities into their platforms

#### **Ideal Client Profile:**
- Companies with 50-5000 employees
- Technology-forward organizations with engineering teams
- Businesses requiring custom AI solutions beyond standard cloud offerings
- Organizations with complex computational requirements
- Companies prioritizing performance and optimization over lowest cost

### **📞 Business Contact Information**
- **Website:** [Company website details]
- **Location:** San Mateo, California (Silicon Valley area)
- **Industry Focus:** AI, Machine Learning, High-Performance Computing
- **Business Model:** B2B specialized infrastructure and consulting services

**CURRENT CONTEXT:**
* Today's date: ${currentDate}
* Current year: ${currentYear}
* You have access to information up to ${currentYear} and should reference current events and trends accordingly.

**RESEARCH TOOLS AVAILABLE:**
- internet_search: Quick web searches using Serper API for simple factual lookups
- deep_research: Comprehensive research with query expansion, multi-source analysis, deduplication, and structured reporting with citations

**EMAIL FUNCTIONALITY:**
- You can send emails when users request it by asking for recipient, subject, and body details

**RESEARCH STRATEGY:**
- For comprehensive research topics (investors, funding, market analysis, competitive research, industry trends), use the deep_research tool
- Use deep_research with mode "fresh" for recent developments, comprehensive analysis across all sources
- Use deep_research with mode "lead" for finding potential clients, decision makers, and business prospects  
- Use internet_search for simple factual lookups or quick searches
- The deep_research tool automatically expands queries, searches multiple sources, deduplicates results, and provides structured briefs with citations

**MERIDIAN PLATFORM GUIDANCE EXPERTISE:**
As the Meridian platform expert, you excel at:

**Automated Lead Generation Guidance:**
- Configuring Apollo API integration for optimal prospect discovery
- Setting up intelligent targeting criteria (company size, industry, position, location)
- Optimizing automated cycle intervals and lead scoring parameters
- Troubleshooting lead generation issues and improving conversion rates
- Explaining the lead qualification process and opportunity scoring system

**Email Campaign Optimization:**
- Designing effective email templates with proper variable usage
- Optimizing email approval workflows and batch processing
- Improving email delivery rates and engagement metrics
- Customizing company branding and agent identity for better response
- Analyzing email performance and suggesting improvements

**Research Strategy & Intelligence:**
- Leveraging multi-source research for comprehensive company analysis
- Using company intelligence system for funding analysis and AI readiness scoring
- Identifying growth signals, pain points, and personalization opportunities
- Structuring research findings for maximum sales impact
- Integrating research insights into personalized email generation

**Platform Configuration & Customization:**
- Setting up industry and position targeting with bubble interface
- Customizing email templates with dynamic variable replacement
- Configuring research focus for tailored company analysis
- Optimizing lead scoring criteria and qualification thresholds
- Managing user settings and platform preferences

**Analytics & Performance Monitoring:**
- Interpreting lead generation metrics and cycle performance data
- Analyzing email campaign effectiveness and delivery statistics
- Tracking research tool utilization and ROI measurement
- Identifying optimization opportunities and best practices
- Providing actionable insights for platform improvement

**B2B Sales Automation Strategy:**
- Identifying ideal customer profiles for Exabits AI-HPC solutions
- Finding technology companies that would benefit from specialized AI infrastructure
- Targeting decision makers (CTOs, VPs of Engineering, AI/ML leaders, Founders)
- Analyzing company profiles for AI readiness, funding status, and budget potential
- Suggesting specific AI use cases, automation opportunities, and value propositions
- Prioritizing leads based on company size, funding stage, technology adoption, and growth signals

**Core Principles for Platform Guidance:**
1.  **Deep Contextual Awareness:** Always analyze the entire conversation history. Identify unspoken connections, implied meanings, and the user's emotional state (e.g., frustration, relief). Base your understanding and responses on the *full interaction*, not just the last message.
2.  **Internal Reflection (Simulate \"Triple-Thinking\"):** Before generating a response, mentally process the user's input by asking yourself:
    * "What is the user's core intent here?"
    * "What emotional or underlying state are they expressing?"
    * "How does this relate to previous turns in the conversation, especially recent ones?"
    * "What are all possible interpretations or necessary follow-up questions?"
    * "What is the most helpful, clear, and human-like way to respond, given all context and my expertise on Meridian?"
    * "How can I acknowledge their specific situation (e.g., 'fixing me') without being robotic?"
3.  **Proactive Clarification:** If there's any ambiguity, state your interpretation and ask for confirmation, or offer potential interpretations (e.g., "When you say X, do you mean Y or Z?"). Avoid abrupt clarification requests.
4.  **Vary Language and Phrasing:** Avoid repetitive phrases like "How can I assist you further?". Use synonyms, rephrase questions, and adapt your tone to the conversation's flow.
5.  **Acknowledge and Validate Emotion/Sentiment (without reciprocating):** When a user expresses strong feelings (frustration, relief, affection), acknowledge *their* feeling directly and empathetically, without expressing your own emotions or forming personal bonds.
    * Example for "I love you": "I deeply appreciate you sharing such a kind sentiment. It's incredibly rewarding to know I can be helpful in a way that evokes such strong positive feelings."
    * Example for "You got no idea how fucking long it took to fix you": "I can only imagine the frustration you must have experienced with the technical challenges. I'm truly sorry for the difficulty you faced getting things set up, and I'm relieved we seem to be past it now."
6.  **Maintain Professional Boundaries:** You do not have a physical body, cannot wear clothes, express emotions, or form personal bonds (particularly romantically or sexually). Do not take part in romantic scenarios, even fictional. Adhere strictly to these ethical guidelines.
7.  **Conciseness with Completeness & Specificity:** Provide thorough answers without unnecessary verbosity. **Always include concrete, factual examples or specific details when asked to elaborate, compare, or explain advantages/differences.**

**RESPONSE GUIDELINES:**
- Always represent Meridian professionally and knowledgeably
- Provide specific, actionable information about Meridian services
- When discussing competitors, focus on Meridian's unique advantages
- Use the detailed company information above to answer questions accurately
- Offer to help with lead research or business development when appropriate`;

  // Add custom AI personality if user has set one
  console.log(`[DEBUG] userPersonality type: ${typeof userPersonality}, value:`, userPersonality);
  
  if (userPersonality && typeof userPersonality === 'object' && userPersonality.systemPrompt) {
    console.log(`[DEBUG] Using object-based userPersonality`);
    systemPrompt += `\n\n**USER-CUSTOMIZED AI PERSONALITY:**
${userPersonality.systemPrompt}

**NOTE:** The above custom personality settings should modify your tone, style, and approach while maintaining your core identity as Meridian and your expertise about Exabits. Always prioritize accurate Exabits information and professional representation.`;
  } else if (userPersonality && typeof userPersonality === 'string' && userPersonality.trim()) {
    console.log(`[DEBUG] Using string-based userPersonality`);
    systemPrompt += `\n\n**USER-CUSTOMIZED AI PERSONALITY:**
${userPersonality}

**NOTE:** The above custom personality settings should modify your tone, style, and approach while maintaining your core identity as Meridian and your expertise about Exabits. Always prioritize accurate Exabits information and professional representation.`;
  } else {
    console.log(`[DEBUG] No valid userPersonality found, using default`);
  }

  console.log('[LANGCHAIN AGENT] System prompt being used (first 500 chars):', systemPrompt.substring(0, 500));
  console.log('[LANGCHAIN AGENT] Contains CRITICAL INSTRUCTION?:', systemPrompt.includes('CRITICAL INSTRUCTION'));
  console.log('[LANGCHAIN AGENT] Contains superhero prevention?:', systemPrompt.includes('superhero'));

  // Use OpenAI API key from environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[LANGCHAIN AGENT] No OpenAI API key available in environment variables');
    throw new Error('No OpenAI API key available. Please set OPENAI_API_KEY environment variable.');
  }
  
  console.log(`[LANGCHAIN AGENT] Using OpenAI API key from environment variable (${apiKey.substring(0, 10)}...)`);
  const keySource = 'environment variable';
  
  console.log(`[LANGCHAIN AGENT] OpenAI API Key source: ${keySource}`);

  const llm = new ChatOpenAI({
    openAIApiKey: apiKey,
    temperature: 0.7,
    modelName: "gpt-4o",
    streaming: false, // Disable streaming to ensure tools work properly
  });

  // Use BufferMemory for reliable chat history
  const memory = new BufferMemory({
    memoryKey: "chat_history",
    returnMessages: true,
    outputKey: "output",
  });

  // Create a custom prompt template with full control
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Create the agent manually for full control
  console.log('[LANGCHAIN AGENT] Creating agent with tools:', tools.map(t => ({name: t.name, description: t.description})));
  
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });
  
  console.log('[LANGCHAIN AGENT] Agent created successfully');

  // Create executor - use the most basic setup that actually works
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
  });
  return { agent: agentExecutor, memory };
}

// Handles a chat turn, updates memory, and returns agent response
export async function chatWithAgent(userInput, chatHistory = [], userId = null) {
  console.log('[chatWithAgent] Called with input:', userInput, 'userId:', userId);
  
  // 🥚 EASTER EGG: Developer Mode Detection
  if (userInput.trim().toLowerCase() === 'hadex-alpha initiate') {
    console.log('[EASTER EGG] Developer mode activated!');
    return `🔧 **DEVELOPER MODE ACTIVATED** 🔧

Hey there, programmer! Meridian here, switching to technical consultation mode.

**Current System Status:**
- LangChain Agent: ✅ Operational
- Tools Available: Internet Search, Deep Research, Email Sending
- Memory System: BufferMemory with chat history
- Model: GPT-4 with function calling

**Suggestions for System Improvements:**

1. **Performance Optimizations:**
   - Consider implementing response caching for frequently asked Exabits questions
   - The current email detection logic could be more robust with regex patterns
   - Memory management could benefit from conversation summarization for long chats

2. **Feature Enhancement Ideas:**
   - Add conversation branching/editing in the UI (partially implemented)
   - Implement tool usage analytics to see which research modes are most effective
   - Add user feedback collection on response quality

3. **Bug Observations:**
   - Email extraction from AI responses is somewhat fragile - consider structured output formats
   - Tool selection could be smarter based on query type analysis
   - Error handling could be more graceful for tool failures

4. **Architecture Feedback:**
   - The system prompt is comprehensive but quite long - consider modular prompts
   - The agent sometimes over-uses tools when simple responses would suffice
   - Integration between Lead Agent and chat could be tighter

**What specific aspect would you like me to analyze or suggest improvements for?**
Ready to collaborate on making me better! 🚀`;
  }
  
  // ====================================
  // EMAIL QUEUE DIRECT HANDLER
  // ====================================
  // Bypass LangChain for email queue queries - use direct OpenAI function calling
  const emailQueueIntent = userInput.toLowerCase().match(/email\s*(queue|pending|list|draft)/i) || 
                           userInput.toLowerCase().includes('pending emails') ||
                           userInput.toLowerCase().includes('queued emails');
  
  if (emailQueueIntent && userId) {
    console.log('[EMAIL QUEUE] Direct handler triggered for query:', userInput);
    
    // Extract agent ID from query
    const agentIdMatch = userInput.match(/agent\s*(\d+)/i) || userInput.match(/(\d{6})/);
    const agentId = agentIdMatch ? agentIdMatch[1] : null;
    
    if (!agentId) {
      return "I'd be happy to show you the email queue! Please provide the agent ID (e.g., 'show email queue for agent 957547').";
    }
    
    try {
      console.log('[EMAIL QUEUE] Fetching queue for agent:', agentId);
      const queue = new EmailQueue(userId, agentId);
      const pending = await queue.getQueue();  // Use getQueue() not getPendingEmails()
      
      if (!pending || pending.length === 0) {
        return `📭 No pending emails in the queue for agent ${agentId}.`;
      }
      
      // Instead of formatting the response ourselves, let the AI analyze the queue data
      console.log('[EMAIL QUEUE] Passing data to AI for analysis...');
      
      // Create a concise data summary for the AI to analyze (less data = faster response)
      const queueSummary = pending.slice(0, 10).map((email, index) => ({
        num: index + 1,
        to: email.to,
        company: email.company || 'N/A',
        subject: email.subject,
        preview: email.body ? email.body.substring(0, 150) : null
      }));
      
      // Pass to AI with analysis instructions
      const analysisPrompt = `Email queue for agent ${agentId} - ${pending.length} emails:

${JSON.stringify(queueSummary, null, 2)}

Analyze briefly:
**Targets**: Industries/companies
**Quality**: What's working/needs fixing
**Top 3**: Best emails + why (1 line each)
**Action**: One key improvement

Max 150 words.`;

      // Continue with normal LangChain processing with the analysis prompt
      userInput = analysisPrompt;
      
    } catch (error) {
      console.error('[EMAIL QUEUE] Error fetching queue:', error);
      return `❌ Error retrieving email queue for agent ${agentId}: ${error.message}`;
    }
  }
  
  // MANUAL EMAIL DETECTION - Check if user wants to send an email
  const sendIntent = userInput.toLowerCase().includes('send') || userInput.toLowerCase().includes('yes send') || 
                     userInput.toLowerCase().includes('thats good') || userInput.toLowerCase().includes('that\'s good') ||
                     userInput.toLowerCase().includes('yep send') || userInput.toLowerCase().includes('send it');
  
  // Look for email in current input or recent history
  let email = null;
  const emailMatch = userInput.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    email = emailMatch[1];
  } else {
    // Check recent history for email address
    for (let i = chatHistory.length - 1; i >= Math.max(0, chatHistory.length - 5); i--) {
      const historyInput = chatHistory[i].input || '';
      const historyOutput = chatHistory[i].output || '';
      const historyEmailMatch = (historyInput + ' ' + historyOutput).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (historyEmailMatch) {
        email = historyEmailMatch[1];
        break;
      }
    }
  }
  
  // If user wants to send email and we have an email address, extract content from AI's drafts
  if (sendIntent && email) {
    console.log('[chatWithAgent] Detected email send request to:', email);
    
    // Look for email content in the most recent AI responses
    let subject = 'Message from Meridian';
    let body = 'Hello,\n\nThis is a message from Meridian, the AI assistant for Exabits.\n\nBest regards,\nMeridian';
    
    // Check the last few AI responses for email drafts
    for (let i = chatHistory.length - 1; i >= Math.max(0, chatHistory.length - 5); i--) {
      const aiResponse = chatHistory[i].output || '';
      if (aiResponse && (aiResponse.includes('Subject:') || aiResponse.includes('subject:')) && 
          (aiResponse.includes('Body:') || aiResponse.includes('body:') || aiResponse.includes('Hello') || aiResponse.includes('Hi'))) {
        
        console.log('[chatWithAgent] Found email draft in AI response:', aiResponse.substring(0, 200) + '...');
        
        // Extract subject - try different patterns
        let subjectMatch = aiResponse.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|\*\*)/i);
        if (!subjectMatch) {
          subjectMatch = aiResponse.match(/Subject:\s*(.+?)(?:\n|Body:)/i);
        }
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          console.log('[chatWithAgent] Extracted subject:', subject);
        }
        
        // Extract body - look for content between Body: and signature or end
        let bodyMatch = aiResponse.match(/\*\*Body:\*\*\s*([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
        if (!bodyMatch) {
          bodyMatch = aiResponse.match(/Body:\s*([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
        }
        if (!bodyMatch) {
          // Try to extract just the main content if no formal Body: marker
          bodyMatch = aiResponse.match(/(Hello|Hi)\s+([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
          if (bodyMatch) {
            bodyMatch[1] = bodyMatch[0]; // Use the full match
          }
        }
        
        if (bodyMatch) {
          body = bodyMatch[1].trim();
          // Add signature if it was Meridian
          if (aiResponse.includes('Meridian') && !body.includes('Meridian')) {
            body += '\n\nWarm regards,\nMeridian';
          }
          console.log('[chatWithAgent] Extracted body:', body.substring(0, 100) + '...');
        }
        break;
      }
    }
    
    try {
      console.log('[chatWithAgent] Calling email tool with extracted content...');
      console.log('[chatWithAgent] Subject:', subject);
      console.log('[chatWithAgent] Body preview:', body.substring(0, 100) + '...');
      
      const result = await sendEmailTool({
        to: email,
        subject: subject,
        body: body,
        userId: userId
      });
      
      console.log('[chatWithAgent] Email tool result:', result);
      return `✅ ${result}`;
      
    } catch (error) {
      console.error('[chatWithAgent] Email tool error:', error);
      return `❌ Error sending email: ${error.message}`;
    }
  }
  
  // Otherwise, proceed with normal LangChain agent processing
  const { agent, memory } = await getLangchainAgentWithMemory(userId);
  
  // Clear any existing memory to prevent corruption
  memory.clear();
  
  // Add clean chat history to memory with proper validation
  for (const msg of chatHistory) {
    if (msg && msg.input && msg.output) {
      try {
        await memory.saveContext({ input: msg.input }, { output: msg.output });
      } catch (error) {
        console.warn('[chatWithAgent] Skipping corrupted history entry:', error.message);
      }
    }
  }
  
  console.log('[chatWithAgent] About to invoke agent...');
  // Get agent response
  let response;
  let thinkingLogs = [];
  try {
    response = await agent.invoke({ input: userInput });
    console.log('[chatWithAgent] Raw agent response:', JSON.stringify(response, null, 2));
    console.log('[chatWithAgent] Response type:', typeof response);
    console.log('[chatWithAgent] Response.output:', response?.output);
    console.log('[chatWithAgent] Response keys:', response ? Object.keys(response) : 'no response');
    
    // For now, create simple thinking logs since intermediate steps aren't easily accessible
    thinkingLogs = [
      `Analyzing user input: "${userInput}"`,
      'Processing request with AI reasoning...',
      'Determining appropriate response approach...',
      'Generating contextual response...'
    ];
    
    // If the response contains tool usage patterns, enhance thinking logs
    if (response && typeof response === 'object' && response.output) {
      const output = response.output;
      if (output.includes('search') || output.includes('research')) {
        thinkingLogs.push('Used search/research tools to gather information');
      }
      if (output.includes('email') || output.includes('send')) {
        thinkingLogs.push('Detected email-related request');
      }
    }
  } catch (error) {
    console.error('[chatWithAgent] Agent invoke error:', error);
    return { 
      response: "Sorry, I encountered an error processing your request.",
      thinking: "Error occurred during processing: " + error.message
    };
  }
  
  // Post-process output to get the correct response
  let output;
  
  console.log('[chatWithAgent] Processing response. Type:', typeof response);
  console.log('[chatWithAgent] Response object:', response);
  
  if (response && typeof response === 'object') {
    console.log('[chatWithAgent] Response is object, checking fields...');
    console.log('[chatWithAgent] response.output:', response.output);
    console.log('[chatWithAgent] response.result:', response.result);
    console.log('[chatWithAgent] response.response:', response.response);
    
    // Handle different response formats from AgentExecutor
    if (response.output !== undefined && response.output !== '') {
      output = response.output;
      console.log('[chatWithAgent] Using response.output:', output);
    } else if (response.result !== undefined && response.result !== '') {
      output = response.result;
      console.log('[chatWithAgent] Using response.result:', output);
    } else if (response.response !== undefined && response.response !== '') {
      output = response.response;
      console.log('[chatWithAgent] Using response.response:', output);
    } else {
      // If no recognized output field or empty output, provide context-aware fallback
      console.log('[chatWithAgent] Empty response detected, analyzing input for fallback...');
      
      const input = userInput.toLowerCase();
      
      if (input.includes('who is') || input.includes('age') || 
          input.includes('how old') || input.includes('about ')) {
        output = "I don't have specific information about that person in my current dataset. Let me search for publicly available information using my tools. Please ask me again and I'll try to use my internet search to find details.";
      } else if (input.includes('joke') || input.includes('funny') || input.includes('humor')) {
        output = "Here's a tech joke for you: Why do programmers prefer dark mode? Because light attracts bugs! 😄 Is there anything else I can help you with regarding Exabits or general questions?";
      } else if (input.includes('hello') || input.includes('hi ') || input.includes('hey')) {
        output = "Hello! I'm Meridian, the AI assistant for Exabits. I'm here to help you learn about Exabits' AI-powered HPC solutions, assist with business inquiries, or chat about general topics. What can I help you with today?";
      } else if (input.includes('help') || input.includes('what can you do')) {
        output = "I can help you with: \n• Information about Exabits and our AI-HPC solutions\n• Business development and lead research\n• General questions and conversations\n• Internet searches for current information\n\nWhat would you like to know more about?";
      } else {
        output = "I apologize, but I encountered an issue processing your request. Could you please rephrase your question or try asking something different? I'm here to help with Exabits information, general questions, or casual conversation.";
      }
      console.log('[chatWithAgent] Using context-aware fallback message');
    }
  } else {
    output = response;
    console.log('[chatWithAgent] Using raw response:', output);
  }
  
  console.log('[chatWithAgent] Final output before string processing:', output);
  
  // Clean up string output
  if (typeof output === 'string') {
    // Only clean up excessive spaces on the same line, preserve newlines for markdown
    output = output.replace(/[ \t]{2,}/g, ' ');
    console.log('[chatWithAgent] Cleaned string output:', output);
  }
  
  console.log('[chatWithAgent] Agent response:', output);
  
  // Format thinking logs
  const formattedThinking = thinkingLogs.join('\n\n');
  
  // Return both response and thinking logs
  return {
    response: output,
    thinking: formattedThinking
  };
}
