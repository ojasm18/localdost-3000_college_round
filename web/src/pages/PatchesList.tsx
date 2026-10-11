import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  GitPullRequest,
  Plus,
  Package,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  ShieldCheck,
  Edit,
  Check,
} from 'lucide-react';
import { api } from '../api';
import { useCurrentUser } from '../context/UserContext';
import {
  PatchStatusChip,
  HealthChip,
  RiskChip,
} from '../components/chips';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import type { PatchStatus } from '../../../shared/types';

export const PatchesList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const isReviewerOrAdmin = currentUser.role === 'REVIEWER' || currentUser.role === 'ADMIN';

  const [activeStatus, setActiveStatus] = useState<string>('ALL');
  const [selectedPatchIds, setSelectedPatchIds] = useState<string[]>([]);

  const { data: patches, isLoading } = useQuery({
    queryKey: ['patches'],
    queryFn: () => api.get('/api/patches'),
  });

  const batchApproveMutation = useMutation({
    mutationFn: () => api.post('/api/patches/batch-approve', { patchIds: selectedPatchIds }),
    onSuccess: () => {
      setSelectedPatchIds([]);
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const singleApproveMutation = useMutation({
    mutationFn: (patchId: string) => api.post(`/api/patches/${patchId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const statuses: { label: string; value: string }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'In Review', value: 'IN_REVIEW' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Verified', value: 'VERIFIED' },
    { label: 'Deployed', value: 'DEPLOYED' },
    { label: 'Reverted', value: 'REVERTED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const filteredPatches = (patches || []).filter((p: any) => {
    if (activeStatus === 'ALL') return true;
    return p.status === activeStatus;
  });

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPatchIds.length === filteredPatches.length) {
      setSelectedPatchIds([]);
    } else {
      setSelectedPatchIds(filteredPatches.map((p: any) => p.id));
    }
  };

  const handleCreateRelease = () => {
    if (selectedPatchIds.length === 0) return;
    navigate(`/releases?create=true&patchIds=${selectedPatchIds.join(',')}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-accent" />
            Runtime Patches
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Lifecycle tracking from draft proposal, peer review, automated visual test verification to live release.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedPatchIds.length > 0 && isReviewerOrAdmin && (
            <button
              onClick={() => batchApproveMutation.mutate()}
              disabled={batchApproveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Approve Selected ({selectedPatchIds.length})</span>
            </button>
          )}

          {selectedPatchIds.length > 0 && (
            <button
              onClick={handleCreateRelease}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-text border border-border text-xs font-semibold shadow-sm transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Create Release ({selectedPatchIds.length})</span>
            </button>
          )}

          <button
            onClick={() => navigate('/editor')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Custom Patch</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border text-xs">
        {statuses.map((s) => {
          const count =
            s.value === 'ALL'
              ? (patches || []).length
              : (patches || []).filter((p: any) => p.status === s.value).length;
          const isActive = activeStatus === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setActiveStatus(s.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-surface-2 text-text border border-border font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface-1 border border-transparent'
              }`}
            >
              <span>{s.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-surface-3 text-text' : 'bg-surface-2 text-text-faint'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Patches Table */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredPatches.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={GitPullRequest}
              title="No Patches Found"
              description="No patches match the active status tab. Accept issues from the scanner or draft one in the editor."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b border-border text-text-faint uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-text-muted hover:text-text"
                      title="Select all"
                    >
                      {selectedPatchIds.length === filteredPatches.length && filteredPatches.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Title & Selector</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPatches.map((patch: any) => {
                  const isSelected = selectedPatchIds.includes(patch.id);
                  const opCount = patch.operations ? patch.operations.length : 0;
                  return (
                    <tr
                      key={patch.id}
                      onClick={() => navigate(`/patches/${patch.id}`)}
                      className={`hover:bg-surface-2/70 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-surface-2/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => handleToggleSelect(patch.id, e)}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent mx-auto" />
                        ) : (
                          <Square className="w-4 h-4 text-text-faint group-hover:text-text-muted mx-auto" />
                        )}
                      </td>

                      {/* Title & Selector */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-semibold text-text group-hover:text-accent transition-colors flex items-center gap-2">
                          <span>{patch.title}</span>
                          <span className="text-[10px] font-mono text-text-faint px-1.5 py-0.2 rounded bg-surface-2 border border-border">
                            {opCount} {opCount === 1 ? 'op' : 'ops'}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-faint font-mono truncate mt-0.5">
                          {patch.targetSelector}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PatchStatusChip status={patch.status} />
                      </td>

                      {/* Health */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <HealthChip health={patch.health} />
                      </td>

                      {/* Risk */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <RiskChip risk={patch.riskLevel} score={patch.riskScore} />
                      </td>

                      {/* Author */}
                      <td className="py-3.5 px-4 font-mono text-text-muted text-[11px]">
                        {patch.authorId || 'system'}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {isReviewerOrAdmin && (patch.status === 'DRAFT' || patch.status === 'IN_REVIEW') && (
                            <button
                              onClick={() => singleApproveMutation.mutate(patch.id)}
                              disabled={singleApproveMutation.isPending}
                              className="px-2.5 py-1 rounded bg-accent/15 text-accent hover:bg-accent hover:text-accent-fg font-medium text-[11px] transition-colors"
                              title="Approve patch"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/patches/${patch.id}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-accent transition-colors"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
