import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  History,
  Package,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Flame,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import {
  SeverityChip,
  HealthChip,
  ReleaseStatusChip,
  PatchStatusChip,
} from '../components/chips';
import { CardSkeleton, Skeleton } from '../components/Skeleton';

export const Overview: React.FC = () => {
  const navigate = useNavigate();

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/api/overview'),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const site = overview?.site;
  const liveRelease = overview?.liveRelease;
  const issueCount = overview?.issueCount || 0;
  const issueSeverity = overview?.issueSeverity || {};
  const awaitingReview = overview?.awaitingReview || 0;
  const openConflicts = overview?.openConflicts || 0;
  const brokenPatches = overview?.brokenPatches || 0;
  const driftedPatches = overview?.driftedPatches || 0;
  const lastVerification = overview?.lastVerification;
  const recentReleases = overview?.recentReleases || [];
  const healthSummary = overview?.healthSummary || {};
  const recentActivity = overview?.recentActivity || [];
  const autoRollbackRecent = overview?.autoRollbackRecent;

  // Format relative time helper
  const timeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return dateStr;
    }
  };

  const totalHealthy = healthSummary.HEALTHY || 0;
  const totalDrifted = healthSummary.DRIFTED || 0;
  const totalBroken = healthSummary.BROKEN || 0;
  const totalTracked = totalHealthy + totalDrifted + totalBroken || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Auto-Rollback Alert Banner (if triggered within 24h) */}
      {autoRollbackRecent && (
        <div className="p-4 rounded-lg bg-danger-soft border border-danger/40 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-danger/20 text-danger mt-0.5">
              <RotateCcw className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-semibold text-danger flex items-center gap-2">
                Automatic Rollback Triggered
                <span className="text-xs font-mono font-normal opacity-80">
                  ({timeAgo(autoRollbackRecent.createdAt)})
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 max-w-2xl leading-relaxed">
                {autoRollbackRecent.summary}. The live release was automatically reverted to the parent version
                to prevent customer-facing breakage.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/releases')}
            className="px-3 py-1.5 text-xs font-medium rounded bg-danger text-bg hover:bg-danger/90 transition-colors"
          >
            Inspect Release
          </button>
        </div>
      )}

      {/* Header bar with Site summary and quick actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            Mission Control
            <span className="text-xs font-mono font-normal text-text-faint px-2 py-0.5 rounded bg-surface-2 border border-border">
              {site?.name || 'Default Target'}
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time status of runtime patches, automated verifications, and visual deployments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text transition-colors"
            title="Refresh overview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Scan Page</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards (6 columns) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Live Release */}
        <div
          onClick={() => navigate('/releases')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>LIVE RELEASE</span>
            <Package className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-xl font-bold font-mono text-accent mt-2 flex items-center gap-2">
            {liveRelease ? `v${liveRelease.version}` : 'None'}
          </div>
          <div className="text-[11px] text-text-muted mt-1 truncate">
            {liveRelease ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                Active on site
              </span>
            ) : (
              'Deploy needed'
            )}
          </div>
        </div>

        {/* KPI 2: Open Issues */}
        <div
          onClick={() => navigate('/issues')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>OPEN ISSUES</span>
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          </div>
          <div className="text-xl font-bold font-mono text-text mt-2">{issueCount}</div>
          <div className="flex items-center gap-1 mt-1.5 h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
            <div
              style={{ width: `${((issueSeverity.CRITICAL || 0) / (issueCount || 1)) * 100}%` }}
              className="bg-danger h-full"
              title="Critical"
            />
            <div
              style={{ width: `${((issueSeverity.HIGH || 0) / (issueCount || 1)) * 100}%` }}
              className="bg-danger-soft h-full"
              title="High"
            />
            <div
              style={{ width: `${((issueSeverity.MEDIUM || 0) / (issueCount || 1)) * 100}%` }}
              className="bg-warning h-full"
              title="Medium"
            />
            <div
              style={{ width: `${((issueSeverity.LOW || 0) / (issueCount || 1)) * 100}%` }}
              className="bg-info h-full"
              title="Low"
            />
          </div>
        </div>

        {/* KPI 3: Awaiting Review */}
        <div
          onClick={() => navigate('/patches')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>IN REVIEW</span>
            <GitPullRequest className="w-3.5 h-3.5 text-info" />
          </div>
          <div
            className={`text-xl font-bold font-mono mt-2 ${
              awaitingReview > 0 ? 'text-info' : 'text-text'
            }`}
          >
            {awaitingReview}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {awaitingReview > 0 ? 'Requires approval' : 'Queue clear'}
          </div>
        </div>

        {/* KPI 4: Open Conflicts */}
        <div
          onClick={() => navigate('/patches')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>CONFLICTS</span>
            <ShieldAlert className={`w-3.5 h-3.5 ${openConflicts > 0 ? 'text-danger' : 'text-text-faint'}`} />
          </div>
          <div
            className={`text-xl font-bold font-mono mt-2 ${
              openConflicts > 0 ? 'text-danger' : 'text-text'
            }`}
          >
            {openConflicts}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {openConflicts > 0 ? 'Blocks release' : 'Zero collisions'}
          </div>
        </div>

        {/* KPI 5: Broken / Drifted */}
        <div
          onClick={() => navigate('/health')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>PATCH HEALTH</span>
            <Flame className={`w-3.5 h-3.5 ${brokenPatches > 0 ? 'text-danger' : 'text-warning'}`} />
          </div>
          <div className="text-xl font-bold font-mono mt-2 flex items-center gap-1.5">
            <span className={brokenPatches > 0 ? 'text-danger' : 'text-text'}>{brokenPatches}</span>
            <span className="text-text-faint text-sm">/</span>
            <span className={driftedPatches > 0 ? 'text-warning' : 'text-text'}>{driftedPatches}</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {brokenPatches > 0 ? `${brokenPatches} broken` : driftedPatches > 0 ? `${driftedPatches} drifted` : 'All healthy'}
          </div>
        </div>

        {/* KPI 6: Verification status */}
        <div
          onClick={() => navigate('/test-runs')}
          className="p-4 rounded-lg bg-surface-1 border border-border hover:border-border-strong cursor-pointer transition-colors"
        >
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>VERIFICATION</span>
            <PlayCircle className="w-3.5 h-3.5 text-violet" />
          </div>
          <div className="text-xl font-bold font-mono mt-2 flex items-center gap-1.5">
            {lastVerification ? (
              <span
                className={`text-sm font-semibold uppercase ${
                  lastVerification.status === 'PASSED'
                    ? 'text-accent'
                    : lastVerification.status === 'FAILED'
                    ? 'text-danger'
                    : 'text-info'
                }`}
              >
                {lastVerification.status}
              </span>
            ) : (
              <span className="text-sm text-text-faint">None</span>
            )}
          </div>
          <div className="text-[11px] text-text-muted mt-1 truncate">
            {lastVerification ? timeAgo(lastVerification.startedAt) : 'Ready to run'}
          </div>
        </div>
      </div>

      {/* Main Grid: Release Timeline & Health (Left 2 cols) vs Recent Activity & Needs Attention (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Release Timeline (Last 5) */}
          <div className="p-5 rounded-lg bg-surface-1 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text">Release Timeline</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Immutable versions with bundle snapshots and verified test gates.
                </p>
              </div>
              <button
                onClick={() => navigate('/releases')}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
              >
                Manage Releases <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentReleases.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted">No releases created yet.</div>
              ) : (
                recentReleases.map((rel: any) => {
                  const isLive = site?.liveReleaseId === rel.id;
                  const patchCount = rel.bundle ? rel.bundle.length : 0;
                  return (
                    <div
                      key={rel.id}
                      onClick={() => navigate('/releases')}
                      className={`p-3.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                        isLive
                          ? 'bg-accent-soft/30 border-accent/40 shadow-sm'
                          : 'bg-surface-2/60 border-border hover:border-border-strong hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-md flex items-center justify-center font-mono text-xs font-bold ${
                            isLive
                              ? 'bg-accent text-accent-fg'
                              : 'bg-surface-3 text-text-muted'
                          }`}
                        >
                          v{rel.version}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text">
                              {rel.note || `Release v${rel.version}`}
                            </span>
                            {isLive ? (
                              <ReleaseStatusChip status="LIVE" />
                            ) : (
                              <ReleaseStatusChip status={rel.status} />
                            )}
                          </div>
                          <div className="text-[11px] text-text-faint font-mono mt-0.5 flex items-center gap-2">
                            <span>{patchCount} {patchCount === 1 ? 'patch' : 'patches'}</span>
                            <span>•</span>
                            <span>Hash: {rel.bundleHash ? rel.bundleHash.slice(0, 8) : 'n/a'}</span>
                            <span>•</span>
                            <span>{timeAgo(rel.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-text-muted">
                          by {rel.deployedById || 'system'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Health Distribution & Runtime Relocation */}
          <div className="p-5 rounded-lg bg-surface-1 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text">Runtime Health Distribution</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Dynamic fingerprint tracking: healthy, relocated/drifted, and broken patches.
                </p>
              </div>
              <button
                onClick={() => navigate('/health')}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
              >
                Inspect Health <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Health Bar */}
            <div className="h-4 w-full bg-surface-3 rounded-full overflow-hidden flex mb-4">
              <div
                style={{ width: `${(totalHealthy / totalTracked) * 100}%` }}
                className="bg-accent h-full transition-all"
                title={`Healthy: ${totalHealthy}`}
              />
              <div
                style={{ width: `${(totalDrifted / totalTracked) * 100}%` }}
                className="bg-warning h-full transition-all"
                title={`Drifted: ${totalDrifted}`}
              />
              <div
                style={{ width: `${(totalBroken / totalTracked) * 100}%` }}
                className="bg-danger h-full transition-all"
                title={`Broken: ${totalBroken}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-md bg-surface-2 border border-border">
                <div className="text-[11px] text-text-faint flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  Healthy
                </div>
                <div className="text-lg font-bold font-mono text-accent mt-1">{totalHealthy}</div>
                <div className="text-[10px] text-text-muted mt-0.5">Exact/High match</div>
              </div>

              <div className="p-3 rounded-md bg-surface-2 border border-border">
                <div className="text-[11px] text-text-faint flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-warning"></span>
                  Drifted (Relocated)
                </div>
                <div className="text-lg font-bold font-mono text-warning mt-1">{totalDrifted}</div>
                <div className="text-[10px] text-text-muted mt-0.5">Matched via text/structure</div>
              </div>

              <div className="p-3 rounded-md bg-surface-2 border border-border">
                <div className="text-[11px] text-text-faint flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-danger"></span>
                  Broken (Unmatched)
                </div>
                <div className="text-lg font-bold font-mono text-danger mt-1">{totalBroken}</div>
                <div className="text-[10px] text-text-muted mt-0.5">Target not found</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Needs Attention & Recent Activity (1 col) */}
        <div className="space-y-6">
          {/* Needs Attention Card */}
          <div className="p-5 rounded-lg bg-surface-1 border border-border">
            <h3 className="text-sm font-semibold text-text mb-1">Needs Attention</h3>
            <p className="text-xs text-text-muted mb-4">High-priority items requiring team action.</p>

            <div className="space-y-2.5">
              {openConflicts > 0 && (
                <div
                  onClick={() => navigate('/patches')}
                  className="p-3 rounded-md bg-danger-soft border border-danger/30 cursor-pointer hover:border-danger/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-danger">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{openConflicts} Unresolved Conflict</span>
                  </div>
                  <span className="text-[11px] text-danger font-medium underline">Resolve</span>
                </div>
              )}

              {brokenPatches > 0 && (
                <div
                  onClick={() => navigate('/health')}
                  className="p-3 rounded-md bg-danger-soft border border-danger/30 cursor-pointer hover:border-danger/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-danger">
                    <Flame className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{brokenPatches} Broken Patch</span>
                  </div>
                  <span className="text-[11px] text-danger font-medium underline">Fix</span>
                </div>
              )}

              {awaitingReview > 0 && (
                <div
                  onClick={() => navigate('/patches')}
                  className="p-3 rounded-md bg-info-soft border border-info/30 cursor-pointer hover:border-info/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-info">
                    <GitPullRequest className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{awaitingReview} Patches in Review</span>
                  </div>
                  <span className="text-[11px] text-info font-medium underline">Review</span>
                </div>
              )}

              {openConflicts === 0 && brokenPatches === 0 && awaitingReview === 0 && (
                <div className="p-4 rounded-md bg-surface-2 border border-border text-center text-xs text-text-muted">
                  <CheckCircle2 className="w-5 h-5 text-accent mx-auto mb-1.5" />
                  All clear. No blocking conflicts, broken patches, or pending reviews.
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Audit Feed (8 events) */}
          <div className="p-5 rounded-lg bg-surface-1 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text">Recent Activity</h3>
              <button
                onClick={() => navigate('/activity')}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">No audit events logged.</div>
              ) : (
                recentActivity.slice(0, 8).map((ev: any) => (
                  <div key={ev.id} className="text-xs flex items-start gap-2.5 pb-2.5 border-b border-border/50 last:border-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-text leading-snug line-clamp-2">
                        {ev.summary}
                      </div>
                      <div className="text-[10px] text-text-faint font-mono mt-0.5 flex items-center gap-2">
                        <span>by {ev.actorName || ev.actorId}</span>
                        <span>•</span>
                        <span>{timeAgo(ev.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
