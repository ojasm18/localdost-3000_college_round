import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { apiRouter } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/artifacts', express.static(path.resolve(process.env.ARTIFACTS_DIR || './artifacts')));
app.use('/runtime', express.static(path.resolve(__dirname, '../public')));

async function start() {
  await initDb();
  app.use('/api', apiRouter);

  app.listen(PORT, () => {
    console.log(`PATCHWORK server on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start PATCHWORK server:', err);
  process.exit(1);
});
