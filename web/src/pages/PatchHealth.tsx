import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronRight,
  Compass,
  Unlink,
  Check,
  Ban,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api';
import { HealthChip, PatchStatusChip } from '../components/chips';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export const PatchHealth: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedPatchId, setExpandedPatchId] = useState<string | null>(null);

  const { data: patches, isLoading } = useQuery({
    queryKey: ['patches'],
    queryFn: () => api.get('/api/patches'),
  });

  const acceptRelocation = useMutation({
    mutationFn: (patchId: string) => api.post(`/api/patches/${patchId}/accept-relocation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const disablePatch = useMutation({
    mutationFn: (patchId: string) => api.post(`/api/patches/${patchId}/disable`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedPatchId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-accent" />
            Runtime Patch Health
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Smart multi-layer element tracking. Detects when target markup changes, relocates elements via structural
            and text fingerprints, and flags broken selectors.
          </p>
        </div>
      </div>

      {/* Health Table */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !patches || patches.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={HeartPulse}
              title="No Tracked Patches"
              description="Deploy or draft patches to begin continuous DOM tracking and health verification."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b border-border text-text-faint uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Patch & Target</th>
                  <th className="py-3 px-4">Health Status</th>
                  <th className="py-3 px-4">Matcher Method</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Lifecycle</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {patches.map((patch: any) => {
                  const isExpanded = expandedPatchId === patch.id;
                  const detail = patch.healthDetail || {};
                  const confidence = detail.confidence !== undefined ? detail.confidence : 1.0;
                  const method = detail.method || (patch.health === 'HEALTHY' ? 'EXACT' : 'TEXT_CONTEXT');

                  return (
                    <React.Fragment key={patch.id}>
                      <tr
                        onClick={() => toggleExpand(patch.id)}
                        className="hover:bg-surface-2/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 text-text-faint">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-text" />
                          ) : (
                            <ChevronRight className="w-4 h-4 group-hover:text-text" />
                          )}
                        </td>

                        {/* Title & Selector */}
                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="font-semibold text-text group-hover:text-accent transition-colors">
                            {patch.title}
                          </div>
                          <div className="text-[11px] text-text-faint font-mono truncate mt-0.5">
                            {patch.targetSelector}
                          </div>
                        </td>

                        {/* Health Chip */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <HealthChip health={patch.health} />
                        </td>

                        {/* Method */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                            {method}
                          </span>
                        </td>

                        {/* Confidence Bar */}
                        <td className="py-3.5 px-4 whitespace-nowrap w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-3 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.round(confidence * 100)}%` }}
                                className={`h-full ${
                                  confidence > 0.8
                                    ? 'bg-accent'
                                    : confidence > 0.5
                                    ? 'bg-warning'
                                    : 'bg-danger'
                                }`}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-text-muted w-8">
                              {Math.round(confidence * 100)}%
                            </span>
                          </div>
                        </td>

                        {/* Patch Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PatchStatusChip status={patch.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {patch.health === 'DRIFTED' && (
                              <button
                                onClick={() => acceptRelocation.mutate(patch.id)}
                                disabled={acceptRelocation.isPending}
                                className="px-2.5 py-1 rounded bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-[11px] transition-colors shadow-sm"
                                title="Update fingerprint to new relocated element"
                              >
                                Accept Location
                              </button>
                            )}
                            {patch.status !== 'REVERTED' && (
                              <button
                                onClick={() => disablePatch.mutate(patch.id)}
                                disabled={disablePatch.isPending}
                                className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-danger border border-border text-[11px] transition-colors"
                                title="Disable patch and revert changes"
                              >
                                Disable
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Location Comparison Row */}
                      {isExpanded && (
                        <tr className="bg-surface-2/40">
                          <td colSpan={7} className="p-4 pl-12 border-b border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Original Fingerprint */}
                              <div className="p-3.5 rounded bg-surface-1 border border-border space-y-2">
                                <span className="font-semibold text-text-faint text-[11px] uppercase tracking-wider block">
                                  Original Selector & Fingerprint
                                </span>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div>
                                    <span className="text-text-faint">Selector: </span>
                                    <span className="text-text">{patch.targetSelector}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-faint">DOM Path: </span>
                                    <span className="text-text-muted">
                                      {patch.fingerprint?.domPath || 'n/a'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-faint">Text Context: </span>
                                    <span className="text-text-muted">
                                      "{patch.fingerprint?.textContent || ''}"
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Relocated / Current Match */}
                              <div className="p-3.5 rounded bg-surface-1 border border-border space-y-2">
                                <span className="font-semibold text-accent text-[11px] uppercase tracking-wider block">
                                  Runtime Matcher Status
                                </span>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div>
                                    <span className="text-text-faint">Detected via: </span>
                                    <span className="text-accent">{method}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-faint">Confidence Score: </span>
                                    <span className="text-accent">{confidence}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-faint">Message: </span>
                                    <span className="text-text-muted">
                                      {detail.message ||
                                        (patch.health === 'HEALTHY'
                                          ? 'Selector matches target DOM node without drift.'
                                          : 'Selector drifted due to DOM restructuring; matching fallback active.')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
