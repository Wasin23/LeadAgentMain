import dotenv from 'dotenv';
dotenv.config();

// Generate unique server session ID on startup
const SERVER_SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substr(2);
console.log('Server session ID:', SERVER_SESSION_ID);

// All other imports must come after dotenv.config()
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes/chat.js';

console.log('=== ExaMark app.js is running! ===');
console.log('PORT from env:', process.env.PORT);

// Import email routes
let emailRoutes;
try {
  emailRoutes = (await import('./routes/email.js')).default;
} catch (e) {
  emailRoutes = (req, res, next) => next(); // No-op if not present
}

// Import authentication routes
let authRoutes;
try {
  authRoutes = (await import('./routes/auth.js')).default;
  console.log('Authentication routes loaded successfully');
} catch (e) {
  console.log('Auth routes not available:', e.message);
  authRoutes = (req, res, next) => next(); // No-op if not present
}

// Import lead agent routes
let leadAgentRoutes;
try {
  leadAgentRoutes = (await import('./routes/leadAgent.js')).default;
} catch (e) {
  console.log('Lead agent routes not available');
  leadAgentRoutes = (req, res, next) => next(); // No-op if not present
}

// Import email queue routes
let emailQueueRoutes;
try {
  emailQueueRoutes = (await import('./routes/emailQueue.js')).default;
  console.log('Email queue routes imported successfully');
} catch (e) {
  console.log('Email queue routes not available:', e.message);
  emailQueueRoutes = (req, res, next) => next(); // No-op if not present
}

const app = express();
app.use(express.json());
// Serve static files from public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Add server session endpoint
app.get('/api/session', (req, res) => {
  res.json({ sessionId: SERVER_SESSION_ID });
});

app.use('/api', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/lead-agent', leadAgentRoutes);
app.use('/api/email-queue', emailQueueRoutes);

const PORT = process.env.API_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});
