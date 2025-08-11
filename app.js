import dotenv from 'dotenv';
dotenv.config();

// All other imports must come after dotenv.config()
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes/chat.js';

console.log('=== ExaMark app.js is running! ===');
console.log('PORT from env:', process.env.PORT);

// If you have emailRoutes, import them as well
let emailRoutes;
try {
  emailRoutes = (await import('./routes/email.js')).default;
} catch (e) {
  emailRoutes = (req, res, next) => next(); // No-op if not present
}

const app = express();
app.use(express.json());
// Serve static files from public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', emailRoutes);
app.use('/api', chatRoutes);

const PORT = process.env.API_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});
