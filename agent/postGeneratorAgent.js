import { ChatOpenAI } from "@langchain/openai";
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

class PostGeneratorAgent extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.postsGenerated = 0;
    this.stateFile = path.join(process.cwd(), 'agent', 'postGenerator_state.json');
    this.postsFile = path.join(process.cwd(), 'agent', 'generated_posts.json');
    
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.8, // Higher creativity for posts
      modelName: "gpt-4o",
    });
    
    console.log('[POST GENERATOR] AI Post Generator Agent initialized');
  }

  async generatePost(topic = null, tone = 'professional') {
    try {
      console.log(`[POST GENERATOR] Generating ${tone} post about: ${topic || 'AI/Tech industry'}`);
      
      const prompt = `You are ExaMark, the AI assistant for Exabits (AI-powered High-Performance Computing company). 

Generate a compelling LinkedIn post about: ${topic || 'AI, machine learning, or high-performance computing trends'}

POST REQUIREMENTS:
- Tone: ${tone} (professional, casual, educational, or inspiring)
- Length: 50-150 words (LinkedIn sweet spot)
- Include 1-2 relevant hashtags at the end
- Start with a hook (question, surprising fact, or bold statement)
- Focus on value for tech professionals and AI companies
- NO emoji spam - use sparingly (max 2-3)
- End with engagement question or call-to-action

TOPICS TO AVOID:
- Exabits company history or founders
- Generic motivational content
- Overly sales-y language

EXAMPLE STRUCTURE:
[Hook] → [Value/Insight] → [Brief explanation] → [CTA/Question] → [Hashtags]

Generate a single, engaging LinkedIn post:`;

      const response = await this.llm.invoke(prompt);
      const postContent = response.content.trim();
      
      // Save the generated post
      const post = {
        id: Date.now().toString(),
        content: postContent,
        topic: topic || 'AI/Tech',
        tone: tone,
        timestamp: new Date().toISOString(),
        status: 'generated', // generated, approved, posted, rejected
        engagement: {
          likes: 0,
          comments: 0,
          shares: 0
        }
      };
      
      await this.savePost(post);
      this.postsGenerated++;
      
      console.log(`[POST GENERATOR] ✅ Generated post: ${postContent.substring(0, 50)}...`);
      
      return {
        success: true,
        post: post
      };
      
    } catch (error) {
      console.error('[POST GENERATOR] Error generating post:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateMultiplePosts(count = 3, topics = [], tone = 'professional') {
    console.log(`[POST GENERATOR] Generating ${count} posts...`);
    
    const defaultTopics = [
      'AI infrastructure trends',
      'Machine learning compute requirements', 
      'GPU computing innovations',
      'Tech industry insights',
      'Cloud vs on-premise AI solutions',
      'Future of artificial intelligence'
    ];
    
    const allTopics = topics.length > 0 ? topics : defaultTopics;
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const randomTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
      const result = await this.generatePost(randomTopic, tone);
      
      if (result.success) {
        posts.push(result.post);
      }
      
      // Small delay between generations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`[POST GENERATOR] ✅ Generated ${posts.length} posts`);
    
    return {
      success: true,
      posts: posts,
      count: posts.length
    };
  }

  async getAllPosts() {
    try {
      const data = await fs.readFile(this.postsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async savePost(post) {
    try {
      const posts = await this.getAllPosts();
      posts.unshift(post); // Add to beginning
      
      // Keep only last 100 posts
      if (posts.length > 100) {
        posts.splice(100);
      }
      
      await fs.writeFile(this.postsFile, JSON.stringify(posts, null, 2));
      console.log('[POST GENERATOR] Post saved to database');
    } catch (error) {
      console.error('[POST GENERATOR] Error saving post:', error);
    }
  }

  async approvePost(postId) {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find(p => p.id === postId);
      
      if (post) {
        post.status = 'approved';
        post.approvedAt = new Date().toISOString();
        await fs.writeFile(this.postsFile, JSON.stringify(posts, null, 2));
        
        console.log(`[POST GENERATOR] ✅ Post approved: ${postId}`);
        return { success: true, message: 'Post approved' };
      }
      
      return { success: false, message: 'Post not found' };
    } catch (error) {
      console.error('[POST GENERATOR] Error approving post:', error);
      return { success: false, error: error.message };
    }
  }

  async rejectPost(postId) {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find(p => p.id === postId);
      
      if (post) {
        post.status = 'rejected';
        post.rejectedAt = new Date().toISOString();
        await fs.writeFile(this.postsFile, JSON.stringify(posts, null, 2));
        
        console.log(`[POST GENERATOR] ❌ Post rejected: ${postId}`);
        return { success: true, message: 'Post rejected' };
      }
      
      return { success: false, message: 'Post not found' };
    } catch (error) {
      console.error('[POST GENERATOR] Error rejecting post:', error);
      return { success: false, error: error.message };
    }
  }

  async getStats() {
    try {
      const posts = await this.getAllPosts();
      
      const stats = {
        total: posts.length,
        generated: posts.filter(p => p.status === 'generated').length,
        approved: posts.filter(p => p.status === 'approved').length,
        posted: posts.filter(p => p.status === 'posted').length,
        rejected: posts.filter(p => p.status === 'rejected').length,
        totalEngagement: posts.reduce((sum, p) => sum + p.engagement.likes + p.engagement.comments + p.engagement.shares, 0),
        recentPosts: posts.slice(0, 5) // Last 5 posts
      };
      
      return stats;
    } catch (error) {
      console.error('[POST GENERATOR] Error getting stats:', error);
      return {
        total: 0,
        generated: 0,
        approved: 0,
        posted: 0,
        rejected: 0,
        totalEngagement: 0,
        recentPosts: []
      };
    }
  }
}

// Export singleton instance
export const postGeneratorAgent = new PostGeneratorAgent();
