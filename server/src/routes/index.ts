import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDb, resetDatabase, clearArtifacts } from '../db.js';
import * as audit from '../audit.js';
import { nanoid } from 'nanoid';
import { validateOperationSafety, scoreRisk, PatchOperationSchema } from '../../../shared/validation.js';
import { z } from 'zod';
import { runScan } from '../scanner.js';

export const apiRouter = Router();

function getUserFromHeader(req: Request) {
  const userId = req.headers['x-user-id'] as string || 'asha';
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  return user || { id: 'asha', name: 'Asha', role: 'DEVELOPER' };
}

function jsonCol(val: unknown) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

function rowToObj(row: any) {
  if (!row) return null;
  const out: any = { ...row };
  const jsonFields = [
    'summary', 'fingerprint', 'evidence', 'riskReasons', 'operations',
    'healthDetail', 'patchIds', 'bundle', 'steps', 'metadata',
    'detail', 'resolution',
  ];
  for (const f of jsonFields) {
    if (f in out) out[f] = jsonCol(out[f]);
  }
  if ('autoRollback' in out) out.autoRollback = !!out.autoRollback;
  return out;
}

// GET /api/me
apiRouter.get('/me', (req, res) => {
  res.json(getUserFromHeader(req));
});

// GET /api/users
apiRouter.get('/users', (_req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// GET /api/overview
apiRouter.get('/overview', (req, res) => {
  const db = getDb();
  const site = rowToObj(db.prepare('SELECT * FROM site LIMIT 1').get());
  if (!site) return res.json({ site: null });

  const liveRelease = site.liveReleaseId
    ? rowToObj(db.prepare('SELECT * FROM releases WHERE id = ?').get(site.liveReleaseId))
    : null;

  const issueCount = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE status != 'DISMISSED'").get() as any).c;
  const dismissedCount = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE status = 'DISMISSED'").get() as any).c;
  const severityRows = db.prepare("SELECT severity, COUNT(*) as c FROM issues WHERE status != 'DISMISSED' GROUP BY severity").all() as any[];
  const issueSeverity: Record<string, number> = {};
  for (const r of severityRows) issueSeverity[r.severity] = r.c;

  const awaitingReview = (db.prepare("SELECT COUNT(*) as c FROM patches WHERE status = 'IN_REVIEW'").get() as any).c;
  const openConflicts = (db.prepare("SELECT COUNT(*) as c FROM conflicts WHERE status = 'OPEN'").get() as any).c;
  const brokenPatches = (db.prepare("SELECT COUNT(*) as c FROM patches WHERE health = 'BROKEN'").get() as any).c;
  const driftedPatches = (db.prepare("SELECT COUNT(*) as c FROM patches WHERE health = 'DRIFTED'").get() as any).c;

  const lastVerification = rowToObj(db.prepare("SELECT * FROM testruns ORDER BY startedAt DESC LIMIT 1").get());

  const recentReleases = db.prepare('SELECT * FROM releases ORDER BY version DESC LIMIT 5').all().map(rowToObj);

  const healthRows = db.prepare("SELECT health, COUNT(*) as c FROM patches WHERE status NOT IN ('REJECTED','REVERTED') GROUP BY health").all() as any[];
  const healthSummary: Record<string, number> = {};
  for (const r of healthRows) healthSummary[r.health] = r.c;

  const recentActivity = db.prepare('SELECT * FROM audit ORDER BY createdAt DESC LIMIT 8').all().map(rowToObj);

  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const autoRollbackRecent = rowToObj(
    db.prepare("SELECT * FROM audit WHERE action = 'AUTO_ROLLBACK_TRIGGERED' AND createdAt > ? ORDER BY createdAt DESC LIMIT 1").get(oneDayAgo)
  );

  res.json({
    site, liveRelease, issueCount, dismissedCount, issueSeverity,
    awaitingReview, openConflicts, brokenPatches, driftedPatches,
    lastVerification, recentReleases, healthSummary, recentActivity,
    autoRollbackRecent,
  });
});

// GET /api/site
apiRouter.get('/site', (_req, res) => {
  const db = getDb();
  const site = rowToObj(db.prepare('SELECT * FROM site LIMIT 1').get());
  res.json(site);
});

// POST /api/site/settings
apiRouter.post('/site/settings', (req, res) => {
  const db = getDb();
  const { autoRollback, name, baseUrl, siteKey } = req.body;
  if (autoRollback !== undefined) {
    db.prepare('UPDATE site SET autoRollback = ?').run(autoRollback ? 1 : 0);
  }
  if (name !== undefined) {
    db.prepare('UPDATE site SET name = ?').run(String(name).trim());
  }
  if (baseUrl !== undefined) {
    db.prepare('UPDATE site SET baseUrl = ?').run(String(baseUrl).trim());
  }
  if (siteKey !== undefined) {
    db.prepare('UPDATE site SET siteKey = ?').run(String(siteKey).trim());
  }
  res.json({ ok: true });
});

// POST /api/system/reset & POST /api/reset
const handleSystemReset = (req: Request, res: Response) => {
  const user = getUserFromHeader(req);
  try {
    resetDatabase();
    clearArtifacts();

    audit.emit({
      actorId: user.id,
      actorName: user.name,
      action: 'SYSTEM_RESET',
      targetType: 'site',
      targetId: 'site-main',
      summary: `${user.name} performed a global system reset (restored database and artifacts to factory defaults)`,
    });

    res.json({ ok: true, message: 'System reset to clean initial state.' });
  } catch (err: any) {
    console.error('System reset error:', err);
    res.status(500).json({ error: { code: 'RESET_FAILED', message: err.message || 'System reset failed' } });
  }
};

apiRouter.post('/system/reset', handleSystemReset);
apiRouter.post('/reset', handleSystemReset);

// Scans
apiRouter.get('/scans', (_req, res) => {
  const db = getDb();
  const scans = db.prepare('SELECT * FROM scans ORDER BY createdAt DESC').all().map(rowToObj);
  res.json(scans);
});

apiRouter.get('/scans/:id', (req, res) => {
  const db = getDb();
  const scan = rowToObj(db.prepare('SELECT * FROM scans WHERE id = ?').get(req.params.id));
  if (!scan) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });
  res.json(scan);
});

apiRouter.get('/scans/:id/issues', (req, res) => {
  const db = getDb();
  const issues = db.prepare('SELECT * FROM issues WHERE scanId = ? ORDER BY createdAt ASC').all(req.params.id).map(rowToObj);
  res.json(issues);
});

apiRouter.post('/scans', (req, res) => {
  const user = getUserFromHeader(req);
  let { url } = req.body;
  if (!url) return res.status(422).json({ error: { code: 'VALIDATION', message: 'URL is required' } });

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const db = getDb();
  let site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
  if (!site) {
    db.prepare(`
      INSERT INTO site (id, name, baseUrl, siteKey, autoRollback)
      VALUES ('site-main', 'Production Site', '', 'production-site', 1)
    `).run();
    site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
  }
  const id = nanoid(10);
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO scans (id, siteId, url, status, progress, createdAt) VALUES (?, ?, ?, 'RUNNING', 0, ?)`).run(id, site.id, url, now);
  db.prepare('UPDATE site SET baseUrl = ? WHERE id = ?').run(url, site.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'SCAN_STARTED', targetType: 'scan', targetId: id,
    summary: `${user.name} started a scan of ${url}`,
  });

  // Trigger Playwright scanner asynchronously
  runScan(id, url, user).catch((err) => {
    console.error('Asynchronous scan error:', err);
  });

  res.json({ id, status: 'RUNNING' });
});

apiRouter.delete('/scans/:id', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const scan = rowToObj(db.prepare('SELECT * FROM scans WHERE id = ?').get(req.params.id));
  if (!scan) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scan not found' } });

  if (scan.screenshotPath) {
    try {
      const fileName = path.basename(scan.screenshotPath);
      const artifactsDir = path.resolve(process.env.ARTIFACTS_DIR || './artifacts');
      const filePath = path.join(artifactsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn('Failed to delete screenshot file:', e);
    }
  }

  db.prepare("DELETE FROM patches WHERE issueId IN (SELECT id FROM issues WHERE scanId = ?) AND status = 'DRAFT'").run(scan.id);
  db.prepare('DELETE FROM issues WHERE scanId = ?').run(scan.id);
  db.prepare('DELETE FROM scans WHERE id = ?').run(scan.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'SCAN_DELETED', targetType: 'scan', targetId: scan.id,
    summary: `${user.name} deleted scan for ${scan.url}`,
  });

  res.json({ ok: true, deletedId: scan.id });
});

function handleDeleteScans(req: Request, res: Response) {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { scanIds, url, all } = (req.body || {}) as { scanIds?: string[]; url?: string; all?: boolean };
  const queryUrl = req.query.url as string | undefined;
  const targetUrl = url || queryUrl;

  let scansToDelete: any[] = [];
  if (all) {
    scansToDelete = db.prepare('SELECT * FROM scans').all();
  } else if (Array.isArray(scanIds) && scanIds.length > 0) {
    const placeholders = scanIds.map(() => '?').join(',');
    scansToDelete = db.prepare(`SELECT * FROM scans WHERE id IN (${placeholders})`).all(...scanIds);
  } else if (targetUrl) {
    scansToDelete = db.prepare('SELECT * FROM scans WHERE url = ?').all(targetUrl);
  }

  if (scansToDelete.length === 0) {
    return res.json({ ok: true, count: 0, deletedIds: [] });
  }

  const ids = scansToDelete.map((s: any) => s.id);
  const placeholders = ids.map(() => '?').join(',');

  const artifactsDir = path.resolve(process.env.ARTIFACTS_DIR || './artifacts');
  for (const s of scansToDelete) {
    if (s.screenshotPath) {
      try {
        const fileName = path.basename(s.screenshotPath);
        const filePath = path.join(artifactsDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  }

  db.prepare(`DELETE FROM patches WHERE issueId IN (SELECT id FROM issues WHERE scanId IN (${placeholders})) AND status = 'DRAFT'`).run(...ids);
  db.prepare(`DELETE FROM issues WHERE scanId IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM scans WHERE id IN (${placeholders})`).run(...ids);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'SCAN_DELETED', targetType: 'scan', targetId: ids.join(','),
    summary: `${user.name} deleted ${ids.length} scanned site record(s)`,
  });

  return res.json({ ok: true, count: ids.length, deletedIds: ids });
}

apiRouter.delete('/scans', handleDeleteScans);
apiRouter.post('/scans/batch-delete', handleDeleteScans);

// Issues
apiRouter.get('/issues', (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM issues WHERE 1=1';
  const params: any[] = [];

  if (req.query.scanId) { query += ' AND scanId = ?'; params.push(req.query.scanId); }
  if (req.query.severity) { query += ' AND severity = ?'; params.push(req.query.severity); }
  if (req.query.category) { query += ' AND category = ?'; params.push(req.query.category); }
  if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
  if (req.query.hasPatch === 'true') { query += ' AND suggestedPatchId IS NOT NULL'; }
  if (req.query.hasPatch === 'false') { query += ' AND suggestedPatchId IS NULL'; }

  query += ' ORDER BY createdAt DESC';
  const issues = db.prepare(query).all(...params).map(rowToObj);
  res.json(issues);
});

apiRouter.get('/issues/:id', (req, res) => {
  const db = getDb();
  const issue = rowToObj(db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id));
  if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
  res.json(issue);
});

apiRouter.post('/issues/:id/accept-patch', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id) as any;
  if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
  if (!issue.suggestedPatchId) return res.status(409).json({ error: { code: 'NO_PATCH', message: 'No suggested patch' } });

  db.prepare("UPDATE issues SET status = 'PATCH_ACCEPTED' WHERE id = ?").run(issue.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_ACCEPTED', targetType: 'issue', targetId: issue.id,
    summary: `${user.name} accepted the suggested patch for "${issue.title}"`,
  });

  res.json({ ok: true });
});

apiRouter.post('/issues/:id/dismiss', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id) as any;
  if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });

  db.prepare("UPDATE issues SET status = 'DISMISSED' WHERE id = ?").run(issue.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'ISSUE_DISMISSED', targetType: 'issue', targetId: issue.id,
    summary: `${user.name} dismissed issue "${issue.title}"`,
  });

  res.json({ ok: true, issue: rowToObj(db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id)) });
});

apiRouter.post('/issues/:id/reopen', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id) as any;
  if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });

  const newStatus = issue.suggestedPatchId ? 'PATCH_SUGGESTED' : 'OPEN';
  db.prepare('UPDATE issues SET status = ? WHERE id = ?').run(newStatus, issue.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'ISSUE_REOPENED', targetType: 'issue', targetId: issue.id,
    summary: `${user.name} reopened issue "${issue.title}"`,
  });

  res.json({ ok: true, issue: rowToObj(db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id)) });
});

apiRouter.post('/issues/batch-dismiss', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { issueIds, scanId, all } = (req.body || {}) as { issueIds?: string[]; scanId?: string; all?: boolean };

  let targetIssues: any[] = [];
  if (all) {
    targetIssues = db.prepare("SELECT * FROM issues WHERE status != 'DISMISSED'").all();
  } else if (scanId) {
    targetIssues = db.prepare("SELECT * FROM issues WHERE scanId = ? AND status != 'DISMISSED'").all(scanId);
  } else if (Array.isArray(issueIds) && issueIds.length > 0) {
    const placeholders = issueIds.map(() => '?').join(',');
    targetIssues = db.prepare(`SELECT * FROM issues WHERE id IN (${placeholders})`).all(...issueIds);
  }

  if (targetIssues.length === 0) {
    return res.json({ ok: true, count: 0 });
  }

  const ids = targetIssues.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE issues SET status = 'DISMISSED' WHERE id IN (${placeholders})`).run(...ids);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'ISSUE_DISMISSED', targetType: 'issue', targetId: ids.join(','),
    summary: `${user.name} dismissed ${ids.length} issues`,
  });

  res.json({ ok: true, count: ids.length, dismissedIds: ids });
});

apiRouter.post('/issues/batch-reopen', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { issueIds } = (req.body || {}) as { issueIds?: string[] };

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return res.json({ ok: true, count: 0 });
  }

  const placeholders = issueIds.map(() => '?').join(',');
  const targetIssues = db.prepare(`SELECT * FROM issues WHERE id IN (${placeholders}) AND status = 'DISMISSED'`).all(...issueIds);

  for (const issue of targetIssues) {
    const newStatus = issue.suggestedPatchId ? 'PATCH_SUGGESTED' : 'OPEN';
    db.prepare('UPDATE issues SET status = ? WHERE id = ?').run(newStatus, issue.id);
  }

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'ISSUE_REOPENED', targetType: 'issue', targetId: issueIds.join(','),
    summary: `${user.name} reopened ${targetIssues.length} issues`,
  });

  res.json({ ok: true, count: targetIssues.length });
});

apiRouter.delete('/issues/:id', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id) as any;
  if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });

  if (issue.suggestedPatchId) {
    db.prepare("DELETE FROM patches WHERE id = ? AND status = 'DRAFT'").run(issue.suggestedPatchId);
  }
  db.prepare('DELETE FROM issues WHERE id = ?').run(issue.id);

  res.json({ ok: true, deletedId: issue.id });
});

// Patches
apiRouter.get('/patches', (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM patches WHERE 1=1';
  const params: any[] = [];
  if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
  query += ' ORDER BY updatedAt DESC';
  res.json(db.prepare(query).all(...params).map(rowToObj));
});

apiRouter.get('/patches/:id', (req, res) => {
  const db = getDb();
  const patch = rowToObj(db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id));
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  res.json(patch);
});

apiRouter.post('/patches', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { title, description, targetPageUrlPattern, targetSelector, fingerprint, operations, issueId } = req.body;

  const parseResult = z.array(PatchOperationSchema).safeParse(operations);
  if (!parseResult.success) {
    return res.status(422).json({ error: { code: 'VALIDATION', message: parseResult.error.message } });
  }

  const safety = validateOperationSafety(operations);
  if (!safety.valid) {
    return res.status(422).json({ error: { code: 'UNSAFE_OPERATION', message: safety.errors.join('; ') } });
  }

  const risk = scoreRisk(operations, {
    targetTag: fingerprint?.tag,
    urlPattern: targetPageUrlPattern,
  });

  const id = nanoid(10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO patches (id, title, description, status, source, riskLevel, riskScore, riskReasons,
      issueId, authorId, targetPageUrlPattern, targetSelector, fingerprint, operations, createdAt, updatedAt)
    VALUES (?, ?, ?, 'DRAFT', 'MANUAL_EDITOR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, description, risk.level, risk.score, JSON.stringify(risk.reasons),
    issueId || null, user.id, targetPageUrlPattern, targetSelector,
    JSON.stringify(fingerprint), JSON.stringify(operations), now, now,
  );

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_CREATED', targetType: 'patch', targetId: id,
    summary: `${user.name} created patch "${title}"`,
  });

  res.json(rowToObj(db.prepare('SELECT * FROM patches WHERE id = ?').get(id)));
});

apiRouter.patch('/patches/:id', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });

  const { title, description, operations, targetSelector, targetPageUrlPattern, fingerprint } = req.body;
  const now = new Date().toISOString();

  if (operations) {
    const safety = validateOperationSafety(operations);
    if (!safety.valid) {
      return res.status(422).json({ error: { code: 'UNSAFE_OPERATION', message: safety.errors.join('; ') } });
    }
  }

  const ops = operations || JSON.parse(patch.operations);
  const fp = fingerprint ? JSON.parse(typeof fingerprint === 'string' ? fingerprint : JSON.stringify(fingerprint)) : JSON.parse(patch.fingerprint);
  const risk = scoreRisk(ops, {
    targetTag: fp?.tag,
    urlPattern: targetPageUrlPattern || patch.targetPageUrlPattern,
  });

  db.prepare(`
    UPDATE patches SET title = ?, description = ?, operations = ?, targetSelector = ?,
      targetPageUrlPattern = ?, fingerprint = ?, riskLevel = ?, riskScore = ?, riskReasons = ?,
      status = 'DRAFT', updatedAt = ? WHERE id = ?
  `).run(
    title || patch.title, description || patch.description,
    JSON.stringify(ops), targetSelector || patch.targetSelector,
    targetPageUrlPattern || patch.targetPageUrlPattern,
    JSON.stringify(fingerprint || JSON.parse(patch.fingerprint)),
    risk.level, risk.score, JSON.stringify(risk.reasons), now, req.params.id,
  );

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_EDITED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} edited patch "${title || patch.title}"`,
  });

  res.json(rowToObj(db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id)));
});

// Patch state transitions
apiRouter.post('/patches/:id/submit', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  if (patch.status !== 'DRAFT') return res.status(409).json({ error: { code: 'ILLEGAL_TRANSITION', message: `Cannot submit from ${patch.status}` } });

  const openConflicts = db.prepare("SELECT COUNT(*) as c FROM conflicts WHERE (patchAId = ? OR patchBId = ?) AND status = 'OPEN'").get(req.params.id, req.params.id) as any;
  if (openConflicts.c > 0) return res.status(409).json({ error: { code: 'OPEN_CONFLICT', message: 'Resolve conflicts before submitting' } });

  db.prepare("UPDATE patches SET status = 'IN_REVIEW', updatedAt = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_SUBMITTED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} submitted "${patch.title}" for review`,
  });

  res.json({ ok: true, status: 'IN_REVIEW' });
});

apiRouter.post('/patches/batch-approve', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();

  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only REVIEWER or ADMIN can approve patches' } });
  }

  const { patchIds, comment } = req.body || {};
  if (!Array.isArray(patchIds) || patchIds.length === 0) {
    return res.status(422).json({ error: { code: 'VALIDATION', message: 'patchIds array is required' } });
  }

  const approvedIds: string[] = [];
  const errors: any[] = [];
  const now = new Date().toISOString();

  for (const pid of patchIds) {
    const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(pid) as any;
    if (!patch) {
      errors.push({ id: pid, error: 'Patch not found' });
      continue;
    }
    if (!['DRAFT', 'IN_REVIEW'].includes(patch.status)) {
      errors.push({ id: pid, error: `Cannot approve from status ${patch.status}` });
      continue;
    }

    const openConflicts = db.prepare("SELECT COUNT(*) as c FROM conflicts WHERE (patchAId = ? OR patchBId = ?) AND status = 'OPEN'").get(pid, pid) as any;
    if (openConflicts && openConflicts.c > 0) {
      errors.push({ id: pid, error: 'Open conflict detected' });
      continue;
    }

    const reviewId = nanoid(10);
    db.prepare('INSERT INTO reviews (id, patchId, reviewerId, decision, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
      reviewId, pid, user.id, 'APPROVED', comment || 'Batch approved', now,
    );
    db.prepare("UPDATE patches SET status = 'APPROVED', updatedAt = ? WHERE id = ?").run(now, pid);

    audit.emit({
      actorId: user.id, actorName: user.name,
      action: 'PATCH_APPROVED', targetType: 'patch', targetId: pid,
      summary: `${user.name} approved "${patch.title}"`,
    });

    approvedIds.push(pid);
  }

  res.json({ ok: true, approvedCount: approvedIds.length, approvedIds, errors });
});

apiRouter.post('/patches/:id/approve', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  if (!['DRAFT', 'IN_REVIEW'].includes(patch.status)) {
    return res.status(409).json({ error: { code: 'ILLEGAL_TRANSITION', message: `Cannot approve patch in ${patch.status} state` } });
  }

  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only REVIEWER or ADMIN can approve patches' } });
  }

  const openConflicts = db.prepare("SELECT COUNT(*) as c FROM conflicts WHERE (patchAId = ? OR patchBId = ?) AND status = 'OPEN'").get(req.params.id, req.params.id) as any;
  if (openConflicts && openConflicts.c > 0) {
    return res.status(409).json({ error: { code: 'OPEN_CONFLICT', message: 'Resolve open conflicts before approving' } });
  }

  const { comment } = req.body || {};
  const reviewId = nanoid(10);
  const now = new Date().toISOString();

  db.prepare('INSERT INTO reviews (id, patchId, reviewerId, decision, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    reviewId, req.params.id, user.id, 'APPROVED', comment || '', now,
  );

  db.prepare("UPDATE patches SET status = 'APPROVED', updatedAt = ? WHERE id = ?").run(now, req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_APPROVED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} approved "${patch.title}"`,
  });

  res.json({ ok: true, status: 'APPROVED', patch: rowToObj(db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id)) });
});

apiRouter.post('/patches/:id/request-changes', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  if (!['DRAFT', 'IN_REVIEW'].includes(patch.status)) {
    return res.status(409).json({ error: { code: 'ILLEGAL_TRANSITION', message: `Cannot request changes from ${patch.status}` } });
  }

  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only REVIEWER or ADMIN can request changes' } });
  }

  const { comment } = req.body || {};
  const reviewId = nanoid(10);
  const now = new Date().toISOString();

  db.prepare('INSERT INTO reviews (id, patchId, reviewerId, decision, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    reviewId, req.params.id, user.id, 'CHANGES_REQUESTED', comment || 'Changes requested', now,
  );

  db.prepare("UPDATE patches SET status = 'DRAFT', updatedAt = ? WHERE id = ?").run(now, req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_CHANGES_REQUESTED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} requested changes on "${patch.title}"`,
  });

  res.json({ ok: true, status: 'DRAFT', patch: rowToObj(db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id)) });
});

apiRouter.post('/patches/:id/review', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  if (!['DRAFT', 'IN_REVIEW'].includes(patch.status)) {
    return res.status(409).json({ error: { code: 'ILLEGAL_TRANSITION', message: `Cannot review from ${patch.status}` } });
  }

  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only REVIEWER or ADMIN can review' } });
  }

  const { decision, comment } = req.body;
  if (!['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(decision)) {
    return res.status(422).json({ error: { code: 'VALIDATION', message: 'Invalid decision' } });
  }

  if (decision === 'APPROVED') {
    const openConflicts = db.prepare("SELECT COUNT(*) as c FROM conflicts WHERE (patchAId = ? OR patchBId = ?) AND status = 'OPEN'").get(req.params.id, req.params.id) as any;
    if (openConflicts && openConflicts.c > 0) {
      return res.status(409).json({ error: { code: 'OPEN_CONFLICT', message: 'Resolve open conflicts before approving' } });
    }
  }

  const reviewId = nanoid(10);
  const now = new Date().toISOString();

  db.prepare('INSERT INTO reviews (id, patchId, reviewerId, decision, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    reviewId, req.params.id, user.id, decision, comment || '', now,
  );

  let newStatus = patch.status;
  let auditAction: string = 'PATCH_APPROVED';

  if (decision === 'APPROVED') {
    newStatus = 'APPROVED';
    auditAction = 'PATCH_APPROVED';
  } else if (decision === 'CHANGES_REQUESTED') {
    newStatus = 'DRAFT';
    auditAction = 'PATCH_CHANGES_REQUESTED';
  } else if (decision === 'REJECTED') {
    newStatus = 'REJECTED';
    auditAction = 'PATCH_REJECTED';
  }

  db.prepare('UPDATE patches SET status = ?, updatedAt = ? WHERE id = ?').run(newStatus, now, req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: auditAction as any, targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} ${decision.toLowerCase().replace('_', ' ')} "${patch.title}"`,
  });

  res.json({ ok: true, status: newStatus });
});

apiRouter.post('/patches/:id/reject', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });
  if (!['DRAFT', 'IN_REVIEW'].includes(patch.status)) {
    return res.status(409).json({ error: { code: 'ILLEGAL_TRANSITION', message: `Cannot reject from ${patch.status}` } });
  }

  db.prepare("UPDATE patches SET status = 'REJECTED', updatedAt = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_REJECTED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} rejected "${patch.title}"`,
  });

  res.json({ ok: true, status: 'REJECTED' });
});

// Comments
apiRouter.get('/patches/:id/comments', (req, res) => {
  const db = getDb();
  const comments = db.prepare('SELECT * FROM comments WHERE patchId = ? ORDER BY createdAt ASC').all(req.params.id);
  res.json(comments);
});

apiRouter.post('/patches/:id/comments', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { body } = req.body;
  const id = nanoid(10);
  const now = new Date().toISOString();

  db.prepare('INSERT INTO comments (id, patchId, authorId, body, createdAt) VALUES (?, ?, ?, ?, ?)').run(
    id, req.params.id, user.id, body, now,
  );

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'COMMENT_ADDED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} commented on a patch`,
  });

  res.json({ id, patchId: req.params.id, authorId: user.id, body, createdAt: now });
});

// Conflicts
apiRouter.get('/conflicts', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM conflicts ORDER BY createdAt DESC').all().map(rowToObj));
});

apiRouter.get('/conflicts/:id', (req, res) => {
  const db = getDb();
  const conflict = rowToObj(db.prepare('SELECT * FROM conflicts WHERE id = ?').get(req.params.id));
  if (!conflict) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conflict not found' } });
  res.json(conflict);
});

apiRouter.post('/conflicts/:id/resolve', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const conflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(req.params.id) as any;
  if (!conflict) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conflict not found' } });

  const { strategy } = req.body;
  if (!['KEEP_A', 'KEEP_B'].includes(strategy)) {
    return res.status(422).json({ error: { code: 'VALIDATION', message: 'Strategy must be KEEP_A or KEEP_B' } });
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE conflicts SET status = 'RESOLVED', resolution = ?, createdAt = ? WHERE id = ?").run(
    JSON.stringify({ strategy, resolvedBy: user.id }), now, conflict.id,
  );

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'CONFLICT_RESOLVED', targetType: 'conflict', targetId: conflict.id,
    summary: `${user.name} resolved conflict using ${strategy}`,
  });

  res.json({ ok: true });
});

// Previews
apiRouter.post('/previews', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { patchIds } = req.body;
  const id = nanoid(10);
  const token = nanoid(20);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
  const baseUrl = site?.baseUrl || '';

  db.prepare('INSERT INTO previews (id, token, patchIds, createdById, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, token, JSON.stringify(patchIds), user.id, expiresAt, now,
  );

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PREVIEW_CREATED', targetType: 'preview', targetId: id,
    summary: `${user.name} created a preview with ${patchIds.length} patches`,
  });

  const previewUrl = baseUrl ? `${baseUrl}/?pw_preview=${token}` : `/?pw_preview=${token}`;
  res.json({ id, token, previewUrl, expiresAt });
});

// Test Runs
apiRouter.get('/test-runs', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM testruns ORDER BY startedAt DESC').all().map(rowToObj));
});

apiRouter.get('/test-runs/:id', (req, res) => {
  const db = getDb();
  const run = rowToObj(db.prepare('SELECT * FROM testruns WHERE id = ?').get(req.params.id));
  if (!run) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Test run not found' } });

  const steps = db.prepare('SELECT * FROM teststeps WHERE testRunId = ? ORDER BY stepIndex ASC').all(req.params.id).map(rowToObj);
  res.json({ ...run, steps });
});

// Releases
apiRouter.get('/releases', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM releases ORDER BY version DESC').all().map(rowToObj));
});

apiRouter.get('/releases/:id', (req, res) => {
  const db = getDb();
  const release = rowToObj(db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.id));
  if (!release) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Release not found' } });
  res.json(release);
});

apiRouter.post('/releases', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const { patchIds, note } = req.body;

  const site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
  const nextVersion = ((db.prepare('SELECT MAX(version) as v FROM releases').get() as any)?.v || 0) + 1;

  // Build cumulative bundle
  const existingBundle: any[] = [];
  if (site.liveReleaseId) {
    const liveRelease = db.prepare('SELECT * FROM releases WHERE id = ?').get(site.liveReleaseId) as any;
    if (liveRelease?.bundle) {
      existingBundle.push(...JSON.parse(liveRelease.bundle));
    }
  }

  const newPatches = db.prepare(
    `SELECT * FROM patches WHERE id IN (${patchIds.map(() => '?').join(',')})`,
  ).all(...patchIds).map(rowToObj);

  const newEntries = newPatches.map((p: any) => ({
    patchId: p.id,
    operations: p.operations,
    targetPageUrlPattern: p.targetPageUrlPattern,
    targetSelector: p.targetSelector,
    fingerprint: p.fingerprint,
    title: p.title,
  }));

  const existingIds = new Set(existingBundle.map((e: any) => e.patchId));
  const merged = [...existingBundle.filter((e: any) => !patchIds.includes(e.patchId)), ...newEntries];

  const bundleJson = JSON.stringify(merged);
  const bundleHash = crypto.createHash('sha256').update(bundleJson).digest('hex');

  const id = nanoid(10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO releases (id, version, status, note, bundle, bundleHash, parentReleaseId, createdAt)
    VALUES (?, ?, 'BUILDING', ?, ?, ?, ?, ?)
  `).run(id, nextVersion, note || '', bundleJson, bundleHash, site.liveReleaseId, now);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'RELEASE_CREATED', targetType: 'release', targetId: id,
    summary: `${user.name} created Release v${nextVersion} with ${patchIds.length} new patches`,
  });

  res.json(rowToObj(db.prepare('SELECT * FROM releases WHERE id = ?').get(id)));
});

apiRouter.post('/releases/:id/deploy', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.id) as any;
  if (!release) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Release not found' } });

  const { override, reason } = req.body || {};

  if (override) {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only ADMIN can force deploy' } });
    }
    if (!reason) {
      return res.status(422).json({ error: { code: 'VALIDATION', message: 'Reason required for override' } });
    }
    audit.emit({
      actorId: user.id, actorName: user.name,
      action: 'DEPLOY_OVERRIDE', targetType: 'release', targetId: release.id,
      summary: `${user.name} force-deployed Release v${release.version}: ${reason}`,
    });
  }

  const now = new Date().toISOString();

  const deploy = db.transaction(() => {
    const site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
    if (site.liveReleaseId) {
      db.prepare("UPDATE releases SET status = 'SUPERSEDED' WHERE id = ?").run(site.liveReleaseId);
    }

    db.prepare("UPDATE releases SET status = 'LIVE', deployedById = ?, deployedAt = ? WHERE id = ?").run(user.id, now, release.id);
    db.prepare('UPDATE site SET liveReleaseId = ?').run(release.id);

    const bundle = JSON.parse(release.bundle || '[]');
    for (const entry of bundle) {
      db.prepare("UPDATE patches SET status = 'DEPLOYED', updatedAt = ? WHERE id = ?").run(now, entry.patchId);
    }
  });

  deploy();

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'RELEASE_DEPLOYED', targetType: 'release', targetId: release.id,
    summary: `${user.name} deployed Release v${release.version}`,
  });

  res.json({ ok: true, status: 'LIVE' });
});

apiRouter.post('/releases/:id/rollback', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.id) as any;
  if (!release) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Release not found' } });

  const { reason } = req.body;
  const targetId = release.parentReleaseId;

  const now = new Date().toISOString();

  const rollback = db.transaction(() => {
    db.prepare("UPDATE releases SET status = 'ROLLED_BACK' WHERE id = ?").run(release.id);

    if (targetId) {
      db.prepare("UPDATE releases SET status = 'LIVE' WHERE id = ?").run(targetId);
      db.prepare('UPDATE site SET liveReleaseId = ?').run(targetId);
    } else {
      db.prepare('UPDATE site SET liveReleaseId = NULL').run();
    }

    const currentBundle = JSON.parse(release.bundle || '[]');
    const targetBundle = targetId
      ? JSON.parse((db.prepare('SELECT bundle FROM releases WHERE id = ?').get(targetId) as any)?.bundle || '[]')
      : [];
    const targetPatchIds = new Set(targetBundle.map((e: any) => e.patchId));

    for (const entry of currentBundle) {
      if (!targetPatchIds.has(entry.patchId)) {
        db.prepare("UPDATE patches SET status = 'REVERTED', updatedAt = ? WHERE id = ?").run(now, entry.patchId);
      }
    }
  });

  rollback();

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'RELEASE_ROLLED_BACK', targetType: 'release', targetId: release.id,
    summary: `${user.name} rolled back Release v${release.version}${reason ? ': ' + reason : ''}`,
  });

  res.json({ ok: true });
});

// Audit
apiRouter.get('/audit', (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM audit WHERE 1=1';
  const params: any[] = [];

  if (req.query.actor) { query += ' AND actorId = ?'; params.push(req.query.actor); }
  if (req.query.group) {
    const groupMap: Record<string, string[]> = {
      Scans: ['SCAN_STARTED', 'SCAN_COMPLETED', 'SCAN_FAILED'],
      Patches: ['PATCH_SUGGESTED', 'PATCH_CREATED', 'PATCH_EDITED', 'PATCH_ACCEPTED', 'PATCH_REJECTED', 'PATCH_SUBMITTED'],
      Reviews: ['PATCH_APPROVED', 'PATCH_CHANGES_REQUESTED', 'COMMENT_ADDED', 'CONFLICT_DETECTED', 'CONFLICT_RESOLVED'],
      Releases: ['RELEASE_CREATED', 'RELEASE_DEPLOYED', 'DEPLOY_OVERRIDE', 'RELEASE_ROLLED_BACK', 'AUTO_ROLLBACK_TRIGGERED'],
      Health: ['PATCH_HEALTH_CHANGED', 'PATCH_RELOCATED', 'PATCH_BROKEN'],
    };
    const actions = groupMap[req.query.group as string];
    if (actions) {
      query += ` AND action IN (${actions.map(() => '?').join(',')})`;
      params.push(...actions);
    }
  }

  query += ' ORDER BY createdAt DESC LIMIT 100';
  if (req.query.cursor) { /* pagination placeholder */ }

  res.json(db.prepare(query).all(...params).map(rowToObj));
});

// Health
apiRouter.get('/health', (_req, res) => {
  const db = getDb();
  const patches = db.prepare("SELECT * FROM patches WHERE status NOT IN ('REJECTED', 'REVERTED') ORDER BY updatedAt DESC").all().map(rowToObj);
  res.json(patches);
});

apiRouter.post('/patches/:id/accept-location', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  const patch = db.prepare('SELECT * FROM patches WHERE id = ?').get(req.params.id) as any;
  if (!patch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch not found' } });

  const healthDetail = JSON.parse(patch.healthDetail || '{}');
  if (healthDetail.newLocation) {
    const newFingerprint = JSON.parse(patch.fingerprint);
    newFingerprint.cssSelector = healthDetail.newLocation.selector || newFingerprint.cssSelector;
    newFingerprint.domPath = healthDetail.newLocation.domPath || newFingerprint.domPath;
    newFingerprint.rect = healthDetail.newLocation.rect || newFingerprint.rect;

    db.prepare("UPDATE patches SET fingerprint = ?, health = 'HEALTHY', healthDetail = NULL, updatedAt = ? WHERE id = ?").run(
      JSON.stringify(newFingerprint), new Date().toISOString(), req.params.id,
    );
  }

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_HEALTH_CHANGED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} accepted new location for "${patch.title}"`,
  });

  res.json({ ok: true });
});

apiRouter.post('/patches/:id/disable', (req, res) => {
  const user = getUserFromHeader(req);
  const db = getDb();
  db.prepare("UPDATE patches SET status = 'REVERTED', updatedAt = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);

  audit.emit({
    actorId: user.id, actorName: user.name,
    action: 'PATCH_HEALTH_CHANGED', targetType: 'patch', targetId: req.params.id,
    summary: `${user.name} disabled a broken patch`,
  });

  res.json({ ok: true });
});

// Runtime endpoints
apiRouter.get('/runtime/bundle/:siteKey', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM site WHERE siteKey = ?').get(req.params.siteKey) as any;
  if (!site || !site.liveReleaseId) return res.json({ patches: [] });

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(site.liveReleaseId) as any;
  if (!release) return res.json({ patches: [] });

  res.json({ patches: JSON.parse(release.bundle || '[]') });
});

// Runtime compatibility aliases
apiRouter.get('/sites/:siteId/active-patches', (_req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM site LIMIT 1').get() as any;
  if (!site || !site.liveReleaseId) return res.json({ patches: [] });

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(site.liveReleaseId) as any;
  if (!release) return res.json({ patches: [] });

  res.json({ patches: JSON.parse(release.bundle || '[]') });
});

apiRouter.get('/sites/:siteId', (req, res) => {
  const db = getDb();
  const site = rowToObj(db.prepare('SELECT * FROM site LIMIT 1').get());
  res.json(site || { id: req.params.siteId, name: 'Demo Site', autoRollback: true });
});


apiRouter.get('/runtime/preview/:token', (req, res) => {
  const db = getDb();
  const preview = db.prepare('SELECT * FROM previews WHERE token = ?').get(req.params.token) as any;
  if (!preview) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Preview not found' } });

  if (new Date(preview.expiresAt) < new Date()) {
    return res.status(410).json({ error: { code: 'EXPIRED', message: 'Preview expired' } });
  }

  const patchIds = JSON.parse(preview.patchIds);
  const patches = db.prepare(
    `SELECT * FROM patches WHERE id IN (${patchIds.map(() => '?').join(',')})`,
  ).all(...patchIds).map(rowToObj);

  const bundle = patches.map((p: any) => ({
    patchId: p.id,
    operations: p.operations,
    targetPageUrlPattern: p.targetPageUrlPattern,
    targetSelector: p.targetSelector,
    fingerprint: p.fingerprint,
    title: p.title,
  }));

  res.json({ patches: bundle });
});

// ─── Visual Editor HTML Proxy ───────────────────────────────────────
// Fetches the target URL, strips X-Frame-Options / CSP so it loads in
// an iframe, and injects a tiny element-picker script.
apiRouter.get('/proxy/html', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    new URL(targetUrl); // validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (WorkPatch Visual Editor)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';
    if (!contentType.includes('text/html')) {
      // Non-HTML — just pipe through
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set('Content-Type', contentType);
      return res.send(buf);
    }

    let html = await upstream.text();

    // Rewrite relative URLs to absolute
    const base = new URL(targetUrl);
    const baseTag = `<base href="${base.origin}${base.pathname.replace(/\/[^/]*$/, '/')}">`;

    // Inject <base> right after <head> so relative paths resolve
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head\s[^>]*>/, (m) => `${m}${baseTag}`);
    } else {
      html = `${baseTag}${html}`;
    }

    // Strip inline CSP / X-Frame-Options meta tags that block our injected picker
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, '');
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, '');

    // Inject the picker script before </body>
    const pickerScript = `
<script data-workpatch-picker>
(function() {
  var picking = false;
  var overlay = null;

  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el !== document.body && el !== document.documentElement) {
      var tag = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      var classes = Array.from(el.classList).filter(function(c) {
        return !c.startsWith('workpatch-');
      });
      var selector = tag;
      if (classes.length) selector += '.' + classes.map(CSS.escape).join('.');
      var parent = el.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(s) {
          return s.tagName === el.tagName;
        });
        if (siblings.length > 1) {
          selector += ':nth-child(' + (Array.from(parent.children).indexOf(el) + 1) + ')';
        }
      }
      parts.unshift(selector);
      el = parent;
    }
    return parts.join(' > ');
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'workpatch-picker-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #2DD4A8;background:rgba(45,212,168,0.08);z-index:999999;transition:all 0.15s ease;border-radius:3px;';
    document.body.appendChild(overlay);
    return overlay;
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'WORKPATCH_PICK_START') {
      picking = true;
      document.body.style.cursor = 'crosshair';
      ensureOverlay();
    }
    if (e.data && e.data.type === 'WORKPATCH_PICK_STOP') {
      picking = false;
      document.body.style.cursor = '';
      removeOverlay();
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!picking) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay) return;
    var rect = el.getBoundingClientRect();
    var ov = ensureOverlay();
    ov.style.top = rect.top + 'px';
    ov.style.left = rect.left + 'px';
    ov.style.width = rect.width + 'px';
    ov.style.height = rect.height + 'px';
  }, true);

  document.addEventListener('click', function(e) {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay) return;

    var rect = el.getBoundingClientRect();
    var computed = window.getComputedStyle(el);

    window.parent.postMessage({
      type: 'WORKPATCH_ELEMENT_PICKED',
      selector: getSelector(el),
      tag: el.tagName,
      text: (el.textContent || '').trim().substring(0, 120),
      classes: Array.from(el.classList),
      attributes: {
        id: el.id || '',
        role: el.getAttribute('role') || '',
        'aria-label': el.getAttribute('aria-label') || '',
        disabled: el.hasAttribute('disabled'),
      },
      computedStyle: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        display: computed.display,
        fontFamily: computed.fontFamily,
      },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }, '*');

    picking = false;
    document.body.style.cursor = '';
    removeOverlay();
  }, true);
})();
</script>`;

    if (html.includes('</body>')) {
      html = html.replace('</body>', `${pickerScript}</body>`);
    } else {
      html += pickerScript;
    }

    // Strip headers that block framing
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    return res.send(html);
  } catch (err: any) {
    return res.status(502).json({
      error: 'Failed to fetch target page',
      details: err?.message || String(err),
    });
  }
});

apiRouter.post('/runtime/ping', (_req, res) => { res.json({ ok: true }); });
apiRouter.post('/runtime/health', (_req, res) => { res.json({ ok: true }); });

// Target site proxies
apiRouter.post('/demo/switch', async (req, res) => {
  try {
    const site = getDb().prepare('SELECT baseUrl FROM site LIMIT 1').get() as any;
    const targetUrl = process.env.TARGET_SITE_URL || site?.baseUrl;
    if (!targetUrl) return res.status(404).json({ error: { code: 'NOT_CONFIGURED', message: 'No target site URL configured' } });
    const resp = await fetch(`${targetUrl}/__switch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await resp.json());
  } catch { res.status(502).json({ error: { code: 'UNAVAILABLE', message: 'Target site unreachable' } }); }
});

apiRouter.post('/demo/backend', async (req, res) => {
  try {
    const site = getDb().prepare('SELECT baseUrl FROM site LIMIT 1').get() as any;
    const targetUrl = process.env.TARGET_SITE_URL || site?.baseUrl;
    if (!targetUrl) return res.status(404).json({ error: { code: 'NOT_CONFIGURED', message: 'No target site URL configured' } });
    const resp = await fetch(`${targetUrl}/__backend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await resp.json());
  } catch { res.status(502).json({ error: { code: 'UNAVAILABLE', message: 'Target site unreachable' } }); }
});
