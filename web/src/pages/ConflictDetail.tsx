import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Check,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api';
import { PatchStatusChip } from '../components/chips';
import { Skeleton } from '../components/Skeleton';

export const ConflictDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: conflict, isLoading } = useQuery({
    queryKey: ['conflict', id],
    queryFn: () => api.get(`/api/conflicts/${id}`),
    enabled: !!id,
  });

  const resolveMutation = useMutation({
    mutationFn: (strategy: 'KEEP_A' | 'KEEP_B') =>
      api.post(`/api/conflicts/${id}/resolve`, { strategy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict', id] });
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      navigate('/patches');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!conflict) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <h2 className="text-base font-semibold text-text">Conflict Not Found</h2>
        <button
          onClick={() => navigate('/patches')}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-surface-2 text-text border border-border"
        >
          Back to Patches
        </button>
      </div>
    );
  }

  const patchA = conflict.patchA;
  const patchB = conflict.patchB;
  const isResolved = conflict.status === 'RESOLVED';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/patches')}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patches</span>
        </button>
      </div>

      {/* Main Header */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`p-2 rounded ${
                isResolved
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'bg-danger-soft text-danger border border-danger/30'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-base font-bold text-text">
                Target Mutation Conflict
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Type: <span className="font-mono text-accent">{conflict.type}</span> • Status:{' '}
                <span className="font-semibold uppercase font-mono">{conflict.status}</span>
              </p>
            </div>
          </div>

          {isResolved && (
            <span className="px-3 py-1 rounded-full bg-accent-soft text-accent border border-accent/30 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Resolved ({conflict.resolution?.strategy || 'Archived'})
            </span>
          )}
        </div>

        <p className="text-xs text-text leading-relaxed p-3 rounded-md bg-surface-2 border border-border">
          {conflict.detail?.message ||
            'Two patches attempt conflicting modifications on the exact same DOM node or attribute.'}
        </p>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Candidate Patch A */}
        <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="font-bold text-sm text-text">Patch A (Original)</span>
              {patchA && <PatchStatusChip status={patchA.status} />}
            </div>

            {patchA ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-text-faint block">Title</span>
                  <span className="font-semibold text-text">{patchA.title}</span>
                </div>

                <div>
                  <span className="text-[11px] text-text-faint block">Target Selector</span>
                  <span className="font-mono text-accent text-[11px]">{patchA.targetSelector}</span>
                </div>

                <div>
                  <span className="text-[11px] text-text-faint block">Operations</span>
                  <pre className="p-3 rounded bg-surface-2 border border-border font-mono text-[11px] text-text-muted overflow-x-auto">
                    {JSON.stringify(patchA.operations, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-faint">Patch details unavailable</div>
            )}
          </div>

          {!isResolved && (
            <button
              onClick={() => resolveMutation.mutate('KEEP_A')}
              disabled={resolveMutation.isPending}
              className="w-full mt-4 py-2.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs transition-colors shadow-sm"
            >
              Keep Patch A (Reject Patch B)
            </button>
          )}
        </div>

        {/* Candidate Patch B */}
        <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="font-bold text-sm text-text">Patch B (Conflicting)</span>
              {patchB && <PatchStatusChip status={patchB.status} />}
            </div>

            {patchB ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-text-faint block">Title</span>
                  <span className="font-semibold text-text">{patchB.title}</span>
                </div>

                <div>
                  <span className="text-[11px] text-text-faint block">Target Selector</span>
                  <span className="font-mono text-accent text-[11px]">{patchB.targetSelector}</span>
                </div>

                <div>
                  <span className="text-[11px] text-text-faint block">Operations</span>
                  <pre className="p-3 rounded bg-surface-2 border border-border font-mono text-[11px] text-text-muted overflow-x-auto">
                    {JSON.stringify(patchB.operations, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-faint">Patch details unavailable</div>
            )}
          </div>

          {!isResolved && (
            <button
              onClick={() => resolveMutation.mutate('KEEP_B')}
              disabled={resolveMutation.isPending}
              className="w-full mt-4 py-2.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs transition-colors shadow-sm"
            >
              Keep Patch B (Reject Patch A)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
