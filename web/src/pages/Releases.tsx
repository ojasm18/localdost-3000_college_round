import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Package,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Plus,
  ShieldAlert,
  ArrowRight,
  Loader2,
  ExternalLink,
  Layers,
  FileCode2,
} from 'lucide-react';
import { api } from '../api';
import { useCurrentUser } from '../context/UserContext';
import { ReleaseStatusChip } from '../components/chips';
import { ConfirmModal } from '../components/ConfirmModal';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export const Releases: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();

  const [createModalOpen, setCreateModalOpen] = useState(
    searchParams.get('create') === 'true'
  );
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackTargetId, setRollbackTargetId] = useState<string>('');
  const [rollbackReason, setRollbackReason] = useState<string>('Production issue / rollback requested');
  const [releaseNote, setReleaseNote] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>(() => {
    const fromParam = searchParams.get('patchIds');
    return fromParam ? fromParam.split(',').filter(Boolean) : [];
  });
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReleaseId, setOverrideReleaseId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Query site & releases
  const { data: releases, isLoading } = useQuery({
    queryKey: ['releases'],
    queryFn: () => api.get('/api/releases'),
    refetchInterval: 4000,
  });

  const { data: site } = useQuery({
    queryKey: ['site'],
    queryFn: () => api.get('/api/site'),
  });

  // Query candidate patches for creating release
  const { data: candidatePatches } = useQuery({
    queryKey: ['candidate-patches'],
    queryFn: () => api.get('/api/patches'),
    select: (list) =>
      list?.filter((p: any) => p.status === 'APPROVED' || p.status === 'VERIFIED') || [],
  });

  // Create release mutation
  const createReleaseMutation = useMutation({
    mutationFn: (payload: { patchIds: string[]; note: string }) =>
      api.post('/api/releases', payload),
    onSuccess: () => {
      setCreateModalOpen(false);
      setSelectedPatches([]);
      setReleaseNote('');
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  // Deploy release mutation
  const deployMutation = useMutation({
    mutationFn: ({ id, override, reason }: { id: string; override?: boolean; reason?: string }) =>
      api.post(`/api/releases/${id}/deploy`, { override, reason }),
    onSuccess: () => {
      setOverrideModalOpen(false);
      setOverrideReleaseId(null);
      setOverrideReason('');
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['site'] });
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: ({ id, targetReleaseId, reason }: { id: string; targetReleaseId?: string; reason: string }) =>
      api.post(`/api/releases/${id}/rollback`, { targetReleaseId, reason }),
    onSuccess: () => {
      setRollbackModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['site'] });
    },
  });

  const liveRelease = releases?.find((r: any) => r.id === site?.liveReleaseId);
  const pastReleases = (releases || []).filter((r: any) => r.id !== site?.liveReleaseId);

  const handleRollbackConfirm = () => {
    if (!liveRelease) return;
    rollbackMutation.mutate({
      id: liveRelease.id,
      targetReleaseId: rollbackTargetId || undefined,
      reason: rollbackReason,
    });
  };

  const handleOverrideConfirm = () => {
    if (!overrideReleaseId || !overrideReason.trim()) return;
    deployMutation.mutate({
      id: overrideReleaseId,
      override: true,
      reason: overrideReason.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            Versioned Releases
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cumulative immutable release bundles with pre-deploy verification, instant activation, and one-click rollback.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Release Candidate</span>
        </button>
      </div>

      {/* Pinned LIVE Release Card */}
      {liveRelease ? (
        <div className="p-6 rounded-lg bg-surface-1 border-2 border-accent/40 shadow-lg space-y-4 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent text-accent-fg flex items-center justify-center font-mono font-bold text-sm">
                v{liveRelease.version}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text">
                    {liveRelease.note || `Release v${liveRelease.version}`}
                  </h2>
                  <ReleaseStatusChip status="LIVE" />
                </div>
                <div className="text-xs text-text-faint font-mono mt-0.5">
                  Deployed by {liveRelease.deployedById || 'system'} • {new Date(liveRelease.deployedAt || liveRelease.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Rollback Action Button */}
            <button
              onClick={() => {
                setRollbackTargetId('');
                setRollbackModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-warning-soft text-warning hover:bg-warning/20 border border-warning/40 text-xs font-semibold transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rollback Live Release...</span>
            </button>
          </div>

          {/* Bundle Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 rounded bg-surface-2 border border-border">
              <span className="text-[10px] text-text-faint uppercase tracking-wider block font-semibold">
                Active Patches
              </span>
              <span className="font-mono text-base font-bold text-accent">
                {liveRelease.bundle?.length || 0}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Included in cumulative payload</span>
            </div>

            <div className="p-3 rounded bg-surface-2 border border-border">
              <span className="text-[10px] text-text-faint uppercase tracking-wider block font-semibold">
                SHA-256 Bundle Hash
              </span>
              <span className="font-mono text-xs text-text-muted block truncate mt-1">
                {liveRelease.bundleHash || 'sha256-verified'}
              </span>
            </div>

            <div className="p-3 rounded bg-surface-2 border border-border">
              <span className="text-[10px] text-text-faint uppercase tracking-wider block font-semibold">
                Parent Release
              </span>
              <span className="font-mono text-xs text-text block mt-1">
                {liveRelease.parentReleaseId ? `Target: ${liveRelease.parentReleaseId}` : 'Initial Genesis'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-lg bg-surface-1 border border-border text-center text-xs text-text-muted">
          No live release currently active. Create and deploy a candidate below.
        </div>
      )}

      {/* Release Timeline (Past & Building Releases) */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <h2 className="text-sm font-semibold text-text">Release History & Candidate Pipeline</h2>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !releases || releases.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Releases Found"
            description="Create your first release candidate to bundle approved patches."
          />
        ) : (
          <div className="space-y-3">
            {releases.map((rel: any) => {
              const isLive = rel.id === site?.liveReleaseId;
              const isBuilding = rel.status === 'BUILDING';
              const canDeploy = !isLive && rel.status !== 'ROLLED_BACK';

              return (
                <div
                  key={rel.id}
                  className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isLive
                      ? 'bg-accent-soft/20 border-accent/40'
                      : isBuilding
                      ? 'bg-info-soft/20 border-info/40'
                      : 'bg-surface-2 border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-surface-3 flex items-center justify-center font-mono font-bold text-xs text-text">
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
                        <span>{rel.bundle?.length || 0} patches</span>
                        <span>•</span>
                        <span>{new Date(rel.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>by {rel.deployedById || 'asha'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Candidate */}
                  <div className="flex items-center gap-2">
                    {canDeploy && (
                      <button
                        onClick={() => deployMutation.mutate({ id: rel.id })}
                        disabled={deployMutation.isPending}
                        className="px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs transition-colors shadow-sm"
                      >
                        Deploy to Live
                      </button>
                    )}

                    {rel.status === 'BUILDING' && currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setOverrideReleaseId(rel.id);
                          setOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-warning border border-border text-xs"
                      >
                        Override & Deploy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Release Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-1 border border-border-strong rounded-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-text">Create Release Candidate</h2>
            <p className="text-xs text-text-muted">
              Select approved patches to include. Newly selected patches will be bundled cumulatively
              with all currently deployed patches.
            </p>

            <div>
              <label className="text-xs font-semibold text-text block mb-1">Release Note / Title</label>
              <input
                type="text"
                value={releaseNote}
                onChange={(e) => setReleaseNote(e.target.value)}
                placeholder="e.g. Sprint 42 fixes: Checkout CTA and lang tag"
                className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-xs text-text outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text block mb-2">
                Available Approved Patches ({candidatePatches?.length || 0})
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-md p-2 bg-surface-2/50">
                {(!candidatePatches || candidatePatches.length === 0) ? (
                  <div className="text-center py-4 text-xs text-text-faint">
                    No approved or verified patches available to bundle. Approve candidate patches first.
                  </div>
                ) : (
                  candidatePatches.map((p: any) => {
                    const isChecked = selectedPatches.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-surface-2 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPatches([...selectedPatches, p.id]);
                            } else {
                              setSelectedPatches(selectedPatches.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded border-border text-accent focus:ring-accent"
                        />
                        <div className="flex-1 truncate">
                          <span className="font-semibold text-text">{p.title}</span>
                          <span className="text-[11px] text-text-faint font-mono block truncate">
                            {p.targetSelector}
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-md bg-surface-2 text-text border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createReleaseMutation.mutate({
                    patchIds: selectedPatches,
                    note: releaseNote.trim() || 'Release candidate',
                  })
                }
                disabled={selectedPatches.length === 0 || createReleaseMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                {createReleaseMutation.isPending ? 'Building Candidate...' : 'Build Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      <ConfirmModal
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        onConfirm={handleRollbackConfirm}
        title="Rollback Production Release"
        description={`This will atomically redirect the live release pointer from v${liveRelease?.version} to the target release. Any patches unique to v${liveRelease?.version} will be reverted immediately.`}
        confirmText="Confirm Rollback"
        danger
        isLoading={rollbackMutation.isPending}
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-text-faint block mb-1">Target Version to Restore</label>
            <select
              value={rollbackTargetId}
              onChange={(e) => setRollbackTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text text-xs"
            >
              <option value="">Default: Parent Release (Immediate predecessor)</option>
              {pastReleases.map((r: any) => (
                <option key={r.id} value={r.id}>
                  v{r.version} — {r.note || 'Release'} ({new Date(r.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-text-faint block mb-1">Audit Reason</label>
            <input
              type="text"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="Why is this release being rolled back?"
              className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text text-xs"
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Override Deploy Modal */}
      <ConfirmModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={handleOverrideConfirm}
        title="Admin Deploy Override"
        description="Deploying without a passed automated verification requires ADMIN privileges and will be permanently recorded in the audit log."
        confirmText="Force Deploy"
        danger
        isLoading={deployMutation.isPending}
      >
        <div>
          <label className="text-xs text-text-faint block mb-1">Mandatory Override Justification</label>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Reason for bypassing automated verification gate..."
            required
            className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-text text-xs"
          />
        </div>
      </ConfirmModal>
    </div>
  );
};
