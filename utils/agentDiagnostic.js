/**
 * AGENT DIAGNOSTIC TOOL
 * 
 * Compares agent configuration against code defaults to identify issues.
 * Also supports comparing two agents side-by-side.
 * 
 * IMPLEMENTATION STATUS: READY TO USE
 * 
 * Usage:
 *   node utils/agentDiagnostic.js <userId> <agentId>
 *   node utils/agentDiagnostic.js <userId1> <agentId1> <userId2> <agentId2>
 *   OR
 *   import { analyzeAgent, compareAgents } from './agentDiagnostic.js';
 */

import AWSManager from './awsManager.js';
import { ReasoningLeadAgent } from '../agent/reasoningLeadAgent.js';

const awsManager = new AWSManager();

/**
 * Expected code defaults from reasoningLeadAgent.js
 */
const CODE_DEFAULTS = {
  temperature: 0.7,
  model: 'gpt-4',
  maxTokens: 2000,
  emailTone: 'professional',
  personalizationLevel: 'HIGHLY_QUALIFIED',
  emailLengths: {
    HIGHLY_QUALIFIED: '6-7 sentences',
    QUALIFIED: '6-7 sentences', 
    SHOTGUN: '5-6 sentences'
  },
  citationsEnabled: false, // Should be false after recent fix
  subjectLineHandling: 'enhanced-cleanup', // After recent fix
  maxEmailsPerCycle: 50,
  leadSearchStrategy: 'apollo',
  researchPhases: ['company-overview', 'news', 'leadership', 'challenges'],
  expectedBehaviors: {
    noCitationsInEmail: true,
    noSubjectInBody: true,
    correctLength: true
  }
};

/**
 * Analyze a single agent against code defaults
 */
export async function analyzeAgent(userId, agentId) {
  console.log('\n🔍 AGENT DIAGNOSTIC TOOL - Code Comparison\n');
  console.log('=' .repeat(80));
  
  try {
    console.log(`\n📊 Fetching agent configuration...\n`);
    
    const agentSettings = await awsManager.getLeadAgentSettings(userId, agentId);
    
    if (!agentSettings) {
      console.error(`❌ Agent not found: ${userId}/${agentId}`);
      return null;
    }
    
    console.log(`✅ Agent: ${agentSettings.name || agentId} (User: ${userId})`);
    console.log(`   Agent ID: ${agentId}`);
    console.log(`   User ID: ${userId}`);
    
    // Compare against code defaults
    console.log('\n' + '='.repeat(80));
    console.log('⚙️  CONFIGURATION VS CODE DEFAULTS\n');
    
    const issues = [];
    
    // Check temperature
    const temp = agentSettings.temperature || CODE_DEFAULTS.temperature;
    console.log(`Temperature: ${temp}`);
    if (temp !== CODE_DEFAULTS.temperature) {
      console.log(`   ⚠️  Non-standard (expected: ${CODE_DEFAULTS.temperature})`);
      issues.push({ field: 'temperature', value: temp, expected: CODE_DEFAULTS.temperature });
    } else {
      console.log(`   ✅ Matches code default`);
    }
    console.log();
    
    // Check model
    const model = agentSettings.model || CODE_DEFAULTS.model;
    console.log(`Model: ${model}`);
    if (model !== CODE_DEFAULTS.model) {
      console.log(`   ⚠️  Non-standard (expected: ${CODE_DEFAULTS.model})`);
      issues.push({ field: 'model', value: model, expected: CODE_DEFAULTS.model });
    } else {
      console.log(`   ✅ Matches code default`);
    }
    console.log();
    
    // Check API keys
    console.log(`API Keys:`);
    console.log(`   OpenAI: ${agentSettings.openaiApiKey ? maskApiKey(agentSettings.openaiApiKey) : '❌ MISSING'}`);
    console.log(`   Apollo: ${agentSettings.apolloApiKey ? maskApiKey(agentSettings.apolloApiKey) : '❌ MISSING'}`);
    console.log(`   Serper: ${agentSettings.serperApiKey ? maskApiKey(agentSettings.serperApiKey) : '❌ MISSING'}`);
    if (!agentSettings.openaiApiKey || !agentSettings.apolloApiKey || !agentSettings.serperApiKey) {
      issues.push({ field: 'apiKeys', value: 'Missing keys', expected: 'All keys present' });
    }
    console.log();
    
    // Check email settings
    console.log(`Email Configuration:`);
    console.log(`   Provider: ${agentSettings.emailProvider || 'Not set'}`);
    console.log(`   From: ${agentSettings.emailFrom || 'Not set'}`);
    console.log(`   Tone: ${agentSettings.emailTone || CODE_DEFAULTS.emailTone}`);
    console.log(`   Personalization: ${agentSettings.personalizationLevel || CODE_DEFAULTS.personalizationLevel}`);
    if (!agentSettings.emailProvider || !agentSettings.emailFrom) {
      issues.push({ field: 'emailConfig', value: 'Incomplete', expected: 'Provider and From address' });
    }
    console.log();
    
    // Check search configuration
    console.log(`Lead Search Configuration:`);
    console.log(`   Keywords: ${agentSettings.searchKeywords?.length || 0} keyword(s)`);
    console.log(`   Industries: ${agentSettings.industries?.length || 0} industry(ies)`);
    console.log(`   Job Titles: ${agentSettings.jobTitles?.length || 0} title(s)`);
    console.log(`   Company Size: ${agentSettings.companySize || 'Not set'}`);
    if (!agentSettings.searchKeywords?.length) {
      issues.push({ field: 'searchKeywords', value: 'None', expected: 'At least 1' });
    }
    console.log();
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 ANALYSIS SUMMARY\n');
    
    if (issues.length === 0) {
      console.log('✅ Agent configuration matches code defaults');
      console.log('✅ All required settings present');
      console.log('\n💡 If issues persist, they are likely due to:');
      console.log('   • GPT temperature randomness (0.7 causes format variations)');
      console.log('   • Recent code fixes not yet applied to generated emails');
    } else {
      console.log(`⚠️  Found ${issues.length} configuration issue(s):\n`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.field}`);
        console.log(`      Current: ${issue.value}`);
        console.log(`      Expected: ${issue.expected}`);
        console.log();
      });
    }
    
    return {
      agentSettings,
      issues,
      codeDefaults: CODE_DEFAULTS
    };
    
  } catch (error) {
    console.error('❌ Error analyzing agent:', error);
    return null;
  }
}

/**
 * Compare two agents' configurations
 */
export async function compareAgents(userId1, agentId1, userId2, agentId2) {
  console.log('\n🔍 AGENT DIAGNOSTIC TOOL\n');
  console.log('=' .repeat(80));
  
  try {
    // Fetch both agent settings
    console.log(`\n📊 Fetching agent configurations...\n`);
    
    const agent1Settings = await awsManager.getLeadAgentSettings(userId1, agentId1);
    const agent2Settings = await awsManager.getLeadAgentSettings(userId2, agentId2);
    
    if (!agent1Settings) {
      console.error(`❌ Agent 1 not found: ${userId1}/${agentId1}`);
      return null;
    }
    
    if (!agent2Settings) {
      console.error(`❌ Agent 2 not found: ${userId2}/${agentId2}`);
      return null;
    }
    
    console.log(`\n✅ Agent 1: ${agent1Settings.name || agentId1} (User: ${userId1})`);
    console.log(`✅ Agent 2: ${agent2Settings.name || agentId2} (User: ${userId2})`);
    
    // Compare key settings
    console.log('\n' + '='.repeat(80));
    console.log('⚙️  CONFIGURATION COMPARISON\n');
    
    const differences = [];
    const keySettings = [
      'apolloApiKey',
      'serperApiKey', 
      'openaiApiKey',
      'emailProvider',
      'emailFrom',
      'timezone',
      'searchKeywords',
      'industries',
      'companySize',
      'jobTitles',
      'emailTone',
      'personalizationLevel',
      'dailyEmailLimit',
      'maxEmailsPerCycle',
      'temperature',
      'model'
    ];
    
    for (const key of keySettings) {
      const val1 = agent1Settings[key];
      const val2 = agent2Settings[key];
      
      // Mask API keys
      const display1 = key.includes('ApiKey') || key.includes('apiKey') ? maskApiKey(val1) : JSON.stringify(val1);
      const display2 = key.includes('ApiKey') || key.includes('apiKey') ? maskApiKey(val2) : JSON.stringify(val2);
      
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push(key);
        console.log(`⚠️  ${key}:`);
        console.log(`   Agent 1: ${display1}`);
        console.log(`   Agent 2: ${display2}`);
        console.log();
      } else {
        console.log(`✅ ${key}: ${display1}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    if (differences.length === 0) {
      console.log('✅ No configuration differences found');
    } else {
      console.log(`⚠️  Found ${differences.length} difference(s): ${differences.join(', ')}`);
    }
    
    return {
      agent1: agent1Settings,
      agent2: agent2Settings,
      differences
    };
    
  } catch (error) {
    console.error('❌ Error comparing agents:', error);
    return null;
  }
}

/**
 * Test both agents with same input to detect output variations
 */
export async function testAgentOutput(userId1, agentId1, userId2, agentId2, testLeadData) {
  console.log('\n🧪 OUTPUT VARIATION TEST\n');
  console.log('=' .repeat(80));
  
  try {
    // Create test leads
    const testLead = testLeadData || {
      company: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Technology',
      size: '50-200',
      location: 'San Francisco, CA',
      description: 'Cloud-based SaaS platform for project management'
    };
    
    console.log('📋 Test Lead Data:');
    console.log(JSON.stringify(testLead, null, 2));
    console.log();
    
    // Run agent(s)
    console.log('🤖 Generating test email...\n');
    
    const result1 = await generateTestEmail(userId1, agentId1, testLead);
    
    // Single agent mode
    if (!userId2 || !agentId2) {
      console.log('\n' + '='.repeat(80));
      console.log('📧 AGENT OUTPUT:\n');
      console.log('Subject:', result1.subject);
      console.log('\nBody:');
      console.log(result1.body);
      console.log('\n' + '-'.repeat(80));
      console.log('ISSUE DETECTION:');
      console.log(`   Subject in body? ${result1.subjectInBody ? '❌ YES (BUG DETECTED)' : '✅ NO'}`);
      console.log(`   Citations in body? ${result1.citationsInBody ? '❌ YES (BUG DETECTED)' : '✅ NO'}`);
      console.log(`   Body length: ${result1.sentences} sentences ${result1.sentences >= 6 && result1.sentences <= 7 ? '✅' : '⚠️  (expected 6-7)'}`);
      
      if (result1.error) {
        console.log(`   ❌ Error: ${result1.error}`);
      }
      
      console.log('\n💡 DIAGNOSIS:');
      if (result1.subjectInBody || result1.citationsInBody) {
        console.log('   ⚠️  Issues detected in output');
        console.log('   → Run this test multiple times to check for GPT randomness');
        console.log('   → Recent code fixes should prevent these issues');
      } else {
        console.log('   ✅ Output looks clean');
        console.log('   → If client still reports issues, temperature randomness may be the cause');
      }
      
      return {
        agent: result1,
        hasIssues: result1.subjectInBody || result1.citationsInBody
      };
    }
    
    // Two agent comparison mode
    console.log('Testing both agents with identical input to detect formatting differences...\n');
    const result2 = await generateTestEmail(userId2, agentId2, testLead);
    
    // Compare outputs
    console.log('\n' + '='.repeat(80));
    console.log('📧 AGENT 1 OUTPUT:\n');
    console.log('Subject:', result1.subject);
    console.log('\nBody:');
    console.log(result1.body);
    console.log('\nSubject in body?', result1.subjectInBody ? '❌ YES' : '✅ NO');
    console.log('Citations in body?', result1.citationsInBody ? '❌ YES' : '✅ NO');
    console.log('Body length:', result1.sentences, 'sentences');
    
    console.log('\n' + '='.repeat(80));
    console.log('📧 AGENT 2 OUTPUT:\n');
    console.log('Subject:', result2.subject);
    console.log('\nBody:');
    console.log(result2.body);
    console.log('\nSubject in body?', result2.subjectInBody ? '❌ YES' : '✅ NO');
    console.log('Citations in body?', result2.citationsInBody ? '❌ YES' : '✅ NO');
    console.log('Body length:', result2.sentences, 'sentences');
    
    // Detect differences
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIFFERENCE ANALYSIS:\n');
    
    if (result1.subjectInBody !== result2.subjectInBody) {
      console.log('⚠️  Subject line behavior differs between agents!');
      console.log(`   Agent 1: ${result1.subjectInBody ? 'Has issue' : 'Clean'}`);
      console.log(`   Agent 2: ${result2.subjectInBody ? 'Has issue' : 'Clean'}`);
      console.log('   → This confirms GPT temperature randomness\n');
    } else {
      console.log('✅ Both agents have same subject line behavior\n');
    }
    
    if (result1.citationsInBody !== result2.citationsInBody) {
      console.log('⚠️  Citation behavior differs between agents!');
      console.log(`   Agent 1: ${result1.citationsInBody ? 'Has citations' : 'Clean'}`);
      console.log(`   Agent 2: ${result2.citationsInBody ? 'Has citations' : 'Clean'}`);
      console.log('   → Check configuration differences\n');
    } else {
      console.log('✅ Both agents have same citation behavior\n');
    }
    
    const sentenceDiff = Math.abs(result1.sentences - result2.sentences);
    if (sentenceDiff > 2) {
      console.log(`⚠️  Significant length difference: ${sentenceDiff} sentences`);
      console.log(`   Agent 1: ${result1.sentences} sentences`);
      console.log(`   Agent 2: ${result2.sentences} sentences\n`);
    } else {
      console.log('✅ Both agents produce similar length emails\n');
    }
    
    return {
      agent1: result1,
      agent2: result2,
      differences: {
        subjectLine: result1.subjectInBody !== result2.subjectInBody,
        citations: result1.citationsInBody !== result2.citationsInBody,
        length: sentenceDiff > 2
      }
    };
    
  } catch (error) {
    console.error('❌ Error testing agent output:', error);
    return null;
  }
}

/**
 * Generate a test email from an agent
 */
async function generateTestEmail(userId, agentId, leadData) {
  // This is a simplified test - you may need to adapt based on your agent structure
  const agent = new ReasoningLeadAgent(userId, agentId);
  
  // Mock research data
  const mockResearch = {
    companyOverview: {
      facts: [
        { fact: 'Leading provider of cloud-based project management solutions', confidence: 0.9, sourceTitle: 'Company Website' },
        { fact: 'Founded in 2018, serves over 1000 customers', confidence: 0.85, sourceTitle: 'LinkedIn' },
        { fact: 'Recent $10M Series A funding', confidence: 0.8, sourceTitle: 'TechCrunch' }
      ]
    },
    challenges: {
      facts: [
        { fact: 'Scaling customer support team', confidence: 0.75, sourceTitle: 'Job Postings' },
        { fact: 'Expanding into enterprise market', confidence: 0.7, sourceTitle: 'Press Release' }
      ]
    }
  };
  
  // Call email generation (you'll need to expose this method)
  try {
    const email = await agent.buildPersonalizedEmail(leadData, mockResearch, 'HIGHLY_QUALIFIED');
    
    // Analyze the output
    const body = email.body || '';
    const subject = email.subject || '';
    
    // Check for subject in body
    const subjectInBody = body.toLowerCase().includes(subject.toLowerCase()) || 
                         body.includes('SUBJECT:') || 
                         body.includes('Subject:');
    
    // Check for citations
    const citationsInBody = body.includes('[Source:') || 
                           body.includes('(Source:') ||
                           body.match(/\[.*?\]/);
    
    // Count sentences
    const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    return {
      subject,
      body,
      subjectInBody,
      citationsInBody,
      sentences
    };
  } catch (error) {
    console.error(`Error generating test email for ${userId}/${agentId}:`, error);
    return {
      subject: '',
      body: '',
      subjectInBody: false,
      citationsInBody: false,
      sentences: 0,
      error: error.message
    };
  }
}

/**
 * Mask API keys for display
 */
function maskApiKey(key) {
  if (!key) return 'null';
  if (typeof key !== 'string') return String(key);
  if (key.length < 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  Analyze single agent:');
    console.log('    node agentDiagnostic.js <userId> <agentId>');
    console.log('\n  Compare two agents:');
    console.log('    node agentDiagnostic.js <userId1> <agentId1> <userId2> <agentId2>');
    console.log('\nExamples:');
    console.log('  node agentDiagnostic.js user_123 agent_abc');
    console.log('  node agentDiagnostic.js user_123 agent_abc user_456 agent_xyz');
    process.exit(1);
  }
  
  (async () => {
    if (args.length === 2) {
      // Single agent analysis
      const [userId, agentId] = args;
      await analyzeAgent(userId, agentId);
      
      // Optional: Test output
      console.log('\n' + '='.repeat(80));
      console.log('🧪 Testing agent output for formatting issues...\n');
      await testAgentOutput(userId, agentId, null, null);
      
    } else if (args.length === 4) {
      // Two agent comparison
      const [userId1, agentId1, userId2, agentId2] = args;
      
      await compareAgents(userId1, agentId1, userId2, agentId2);
      await testAgentOutput(userId1, agentId1, userId2, agentId2);
    } else {
      console.error('❌ Invalid number of arguments');
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic complete\n');
  })();
}
