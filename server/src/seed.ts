import 'dotenv/config';
import { initDb, getDb } from './db.js';

function seed() {
  const db = getDb();

  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  if (existing.c > 0) {
    console.log('Database already seeded. Use "npm run reset" to wipe and re-seed.');
    return;
  }

  // Users
  db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run('asha', 'Asha', 'DEVELOPER');
  db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run('ravi', 'Ravi', 'REVIEWER');
  db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run('admin', 'Admin', 'ADMIN');

  // Site
  db.prepare('INSERT INTO site (id, name, baseUrl, siteKey, autoRollback) VALUES (?, ?, ?, ?, ?)').run(
    'site-main', 'Production Site', '', 'production-site', 1,
  );

  // Flows
  db.prepare('INSERT INTO flows (id, name, steps) VALUES (?, ?, ?)').run('flow-home', 'Homepage Smoke Check', JSON.stringify([
    { action: 'screenshot', name: 'home' },
  ]));

  console.log('Seed complete: 3 users, 1 site, 1 flow. No mock data.');
}

async function run() {
  await initDb();
  seed();
}

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
