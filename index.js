import express from 'express';
import axios from 'axios';
import canvasRoutes from './routes/canvasRoutes.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Permite requisições de qualquer origem (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api/canvas', canvasRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Spotify-Canvas-API',
    endpoints: {
      health: '/health',
      canvas: '/api/canvas?trackId={id}&title={titulo}&artist={artista}'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Spotify-Canvas-API', port: PORT, env: process.env.VERCEL ? 'vercel' : 'local' });
});

app.post('/api/config/sp_dc', async (req, res) => {
  const { sp_dc } = req.body;
  if (!sp_dc) return res.status(400).json({ error: 'sp_dc é obrigatório' });
  try {
    process.env.SP_DC = sp_dc;
    const fs = await import('fs');
    fs.writeFileSync('.env', `SP_DC=${sp_dc}\n`);
    console.log('[CANVAS-API] SP_DC atualizado via API com sucesso.');
    res.json({ status: 'ok', message: 'SP_DC atualizado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, function () {
    console.log(`[CANVAS-API] Rodando localmente em http://localhost:${PORT}`);
  });
}

export default app;