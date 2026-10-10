import { nanoid } from 'nanoid';
import { runInsert } from './db.js';
import type { AuditAction } from '../../shared/types.js';

interface AuditParams {
  actorId: string;
  actorName: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export function emit(params: AuditParams): string {
  const id = nanoid(10);
  const now = new Date().toISOString();

  runInsert(
    `INSERT INTO audit (id, actorId, actorName, action, targetType, targetId, summary, metadata, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.actorId, params.actorName, params.action, params.targetType,
     params.targetId, params.summary, params.metadata ? JSON.stringify(params.metadata) : null, now],
  );

  return id;
}
