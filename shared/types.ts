// shared/types.ts — Single source of truth for all PATCHWORK types and enums.
// Written first per Section 5; imported by server, runtime, and frontend.

export type Role = 'ADMIN' | 'DEVELOPER' | 'REVIEWER';
export type IssueCategory = 'ACCESSIBILITY' | 'LAYOUT' | 'CONTENT' | 'INTERACTION' | 'BACKEND_SYMPTOM';
export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueStatus = 'OPEN' | 'PATCH_SUGGESTED' | 'PATCH_ACCEPTED' | 'DISMISSED' | 'REPORT_ONLY';
export type PatchStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'VERIFIED' | 'DEPLOYED' | 'REVERTED' | 'REJECTED';
export type PatchSource = 'SCANNER_RULE' | 'MANUAL_EDITOR';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type HealthStatus = 'HEALTHY' | 'DRIFTED' | 'BROKEN' | 'UNKNOWN';
export type ReleaseStatus = 'BUILDING' | 'LIVE' | 'SUPERSEDED' | 'FAILED' | 'ROLLED_BACK';
export type TestRunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
export type ConflictStatus = 'OPEN' | 'RESOLVED';

export type AuditAction =
  | 'SCAN_STARTED' | 'SCAN_COMPLETED' | 'SCAN_FAILED'
  | 'PATCH_SUGGESTED' | 'PATCH_CREATED' | 'PATCH_EDITED' | 'PATCH_ACCEPTED' | 'PATCH_REJECTED'
  | 'PATCH_SUBMITTED' | 'PATCH_APPROVED' | 'PATCH_CHANGES_REQUESTED'
  | 'COMMENT_ADDED' | 'CONFLICT_DETECTED' | 'CONFLICT_RESOLVED'
  | 'PREVIEW_CREATED' | 'TEST_RUN_STARTED' | 'TEST_RUN_COMPLETED'
  | 'RELEASE_CREATED' | 'RELEASE_DEPLOYED' | 'DEPLOY_OVERRIDE'
  | 'RELEASE_ROLLED_BACK' | 'AUTO_ROLLBACK_TRIGGERED'
  | 'PATCH_HEALTH_CHANGED' | 'PATCH_RELOCATED' | 'PATCH_BROKEN'
  | 'ISSUE_DISMISSED' | 'ISSUE_REOPENED' | 'SCAN_DELETED' | 'SYSTEM_RESET';

export interface ElementFingerprint {
  cssSelector: string;
  domPath: string;
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  textContent: string;
  nearbyText: string[];
  ancestors: { tag: string; id?: string; classes: string[] }[];
  rect: { x: number; y: number; width: number; height: number };
}

export type PatchOperation =
  | { op: 'SET_STYLE'; properties: Record<string, string>; important?: boolean }
  | { op: 'SET_ATTRIBUTE'; name: string; value: string }
  | { op: 'REMOVE_ATTRIBUTE'; name: string }
  | { op: 'SET_TEXT'; value: string }
  | { op: 'HIDE' }
  | {
      op: 'RUN_SCRIPT_TEMPLATE';
      template: 'RETRY_FETCH_ON_FAIL' | 'FALLBACK_MESSAGE_ON_FAIL';
      params: Record<string, string | number>;
    };

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Site {
  id: string;
  name: string;
  baseUrl: string;
  siteKey: string;
  liveReleaseId: string | null;
  autoRollback: boolean;
}

export interface Scan {
  id: string;
  siteId: string;
  url: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  summary: { total: number; bySeverity: Record<IssueSeverity, number>; byCategory: Record<IssueCategory, number> } | null;
  screenshotPath: string | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  scanId: string;
  ruleId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  description: string;
  pageUrl: string;
  selector: string | null;
  fingerprint: ElementFingerprint | null;
  evidence: Record<string, unknown> | null;
  suggestedPatchId: string | null;
  createdAt: string;
}

export interface Patch {
  id: string;
  title: string;
  description: string;
  status: PatchStatus;
  source: PatchSource;
  riskLevel: RiskLevel;
  riskScore: number;
  riskReasons: string[];
  issueId: string | null;
  authorId: string;
  targetPageUrlPattern: string;
  targetSelector: string;
  fingerprint: ElementFingerprint;
  operations: PatchOperation[];
  health: HealthStatus;
  healthDetail: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  patchId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Review {
  id: string;
  patchId: string;
  reviewerId: string;
  decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  patchAId: string;
  patchBId: string;
  type: 'SAME_TARGET_SAME_PROPERTY' | 'TARGET_HIDDEN';
  status: ConflictStatus;
  detail: Record<string, unknown>;
  resolution: Record<string, unknown> | null;
  createdAt: string;
}

export interface Preview {
  id: string;
  token: string;
  patchIds: string[];
  createdById: string;
  expiresAt: string;
  createdAt: string;
}

export interface Release {
  id: string;
  version: number;
  status: ReleaseStatus;
  note: string;
  bundle: BundleEntry[];
  bundleHash: string;
  parentReleaseId: string | null;
  deployedById: string | null;
  testRunId: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface BundleEntry {
  patchId: string;
  operations: PatchOperation[];
  targetPageUrlPattern: string;
  targetSelector: string;
  fingerprint: ElementFingerprint;
  title: string;
}

export interface TestRun {
  id: string;
  trigger: 'PRE_DEPLOY' | 'POST_DEPLOY' | 'MANUAL';
  status: TestRunStatus;
  releaseId: string | null;
  previewId: string | null;
  summary: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface TestStep {
  id: string;
  testRunId: string;
  flowName: string;
  stepIndex: number;
  action: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  error: string | null;
  baselineShot: string | null;
  currentShot: string | null;
  diffShot: string | null;
  diffPercent: number | null;
}

export type FlowStepAction =
  | { action: 'goto'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'expectVisible'; selector: string }
  | { action: 'expectUrlContains'; value: string }
  | { action: 'expectText'; selector: string; contains: string }
  | { action: 'screenshot'; name: string };

export interface Flow {
  id: string;
  name: string;
  steps: FlowStepAction[];
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface OverviewData {
  site: Site;
  liveRelease: Release | null;
  issueCount: number;
  issueSeverity: Record<IssueSeverity, number>;
  awaitingReview: number;
  openConflicts: number;
  brokenPatches: number;
  driftedPatches: number;
  lastVerification: TestRun | null;
  recentReleases: Release[];
  healthSummary: Record<HealthStatus, number>;
  recentActivity: AuditEntry[];
  autoRollbackRecent: AuditEntry | null;
}
