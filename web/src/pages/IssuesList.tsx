import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Filter,
  Search,
  CheckCircle2,
  FileCode2,
  ArrowRight,
  ExternalLink,
  Flame,
  HelpCircle,
  ServerCrash,
  EyeOff,
  RotateCcw,
  CheckSquare,
  Square,
  Globe,
  X,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import {
  SeverityChip,
  CategoryChip,
  RiskChip,
} from '../components/chips';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import type { IssueSeverity, IssueCategory, IssueStatus } from '../../../shared/types';

export const IssuesList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [backendOnly, setBackendOnly] = useState<boolean>(false);
  const [selectedScanId, setSelectedScanId] = useState<string>(searchParams.get('scanId') || 'ALL');

  // Multi-select state
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isDismissAllModalOpen, setIsDismissAllModalOpen] = useState(false);

  // Sync with URL search params
  useEffect(() => {
    const fromUrl = searchParams.get('scanId');
    if (fromUrl && fromUrl !== selectedScanId) {
      setSelectedScanId(fromUrl);
    }
  }, [searchParams]);

  const { data: issues, isLoading } = useQuery({
    queryKey: ['issues'],
    queryFn: () => api.get('/api/issues'),
  });

  const { data: scans } = useQuery({
    queryKey: ['scans'],
    queryFn: () => api.get('/api/scans'),
  });

  // Single issue dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/issues/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  // Single issue reopen mutation
  const reopenMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/issues/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  // Batch dismiss mutation
  const batchDismissMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/api/issues/batch-dismiss', { issueIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setSelectedIssueIds([]);
      setIsDismissAllModalOpen(false);
    },
  });

  // Batch reopen mutation
  const batchReopenMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/api/issues/batch-reopen', { issueIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setSelectedIssueIds([]);
    },
  });

  const handleScanChange = (val: string) => {
    setSelectedScanId(val);
    if (val === 'ALL') {
      searchParams.delete('scanId');
    } else {
      searchParams.set('scanId', val);
    }
    setSearchParams(searchParams);
  };

  const filteredIssues = (issues || []).filter((issue: any) => {
    if (selectedScanId !== 'ALL' && issue.scanId !== selectedScanId) return false;
    if (backendOnly && issue.category !== 'BACKEND_SYMPTOM') return false;
    if (selectedSeverity !== 'ALL' && issue.severity !== selectedSeverity) return false;
    if (selectedCategory !== 'ALL' && issue.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL' && issue.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchUrl = issue.pageUrl.toLowerCase().includes(q);
      const matchRule = (issue.ruleId || '').toLowerCase().includes(q);
      if (!matchTitle && !matchUrl && !matchRule) return false;
    }
    return true;
  });

  const countsByStatus = {
    OPEN: (issues || []).filter((i: any) => i.status === 'OPEN').length,
    PATCH_SUGGESTED: (issues || []).filter((i: any) => i.status === 'PATCH_SUGGESTED').length,
    PATCH_ACCEPTED: (issues || []).filter((i: any) => i.status === 'PATCH_ACCEPTED').length,
    DISMISSED: (issues || []).filter((i: any) => i.status === 'DISMISSED').length,
  };

  const openIssuesInView = filteredIssues.filter((i: any) => i.status !== 'DISMISSED');

  const toggleSelectIssue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIssueIds.length === filteredIssues.length && filteredIssues.length > 0) {
      setSelectedIssueIds([]);
    } else {
      setSelectedIssueIds(filteredIssues.map((i: any) => i.id));
    }
  };

  const currentScanObj = (scans || []).find((s: any) => s.id === selectedScanId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Detected Issues
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Automated findings with element fingerprints, risk scores, suggested patches, and dismiss actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Backend symptoms quick filter pill */}
          <button
            onClick={() => setBackendOnly(!backendOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              backendOnly
                ? 'bg-danger-soft text-danger border-danger/40 shadow-sm font-semibold'
                : 'bg-surface-2 text-text-muted hover:text-text border-border'
            }`}
          >
            <ServerCrash className="w-3.5 h-3.5" />
            <span>Backend Symptoms Only</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-lg bg-surface-1 border border-border flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, selector, page URL, or rule..."
            className="w-full pl-9 pr-4 py-2 rounded-md bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent text-xs text-text placeholder:text-text-faint outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Scanned site / scan filter */}
          {scans && scans.length > 0 && (
            <select
              value={selectedScanId}
              onChange={(e) => handleScanChange(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text outline-none text-xs max-w-xs truncate"
            >
              <option value="ALL">All Scanned Sites ({scans.length})</option>
              {scans.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.url.replace(/^https?:\/\//, '')} ({new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}

          {/* Severity filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text outline-none text-xs"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text outline-none text-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="ACCESSIBILITY">Accessibility</option>
            <option value="LAYOUT">Layout Overlap</option>
            <option value="INTERACTION">Interaction</option>
            <option value="CONTENT">Content</option>
            <option value="BACKEND_SYMPTOM">Backend Symptom</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text outline-none text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open ({countsByStatus.OPEN})</option>
            <option value="PATCH_SUGGESTED">Patch Suggested ({countsByStatus.PATCH_SUGGESTED})</option>
            <option value="PATCH_ACCEPTED">Accepted ({countsByStatus.PATCH_ACCEPTED})</option>
            <option value="DISMISSED">Dismissed ({countsByStatus.DISMISSED})</option>
          </select>
        </div>
      </div>

      {/* Active Scan Filter Badge (if URL query active) */}
      {selectedScanId !== 'ALL' && currentScanObj && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border text-xs text-text">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <span>
              Showing issues from scan of <strong className="font-mono text-accent">{currentScanObj.url}</strong>
            </span>
            <span className="text-text-faint">({filteredIssues.length} issues)</span>
          </div>
          <button
            type="button"
            onClick={() => handleScanChange('ALL')}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Show all sites</span>
          </button>
        </div>
      )}

      {/* Bulk actions banner */}
      {selectedIssueIds.length > 0 && (
        <div className="p-3 rounded-lg bg-accent-soft/30 border border-accent/30 flex items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <span>{selectedIssueIds.length} issue(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => batchDismissMutation.mutate(selectedIssueIds)}
              disabled={batchDismissMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-danger-soft text-text hover:text-danger border border-border hover:border-danger/40 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Dismiss Selected ({selectedIssueIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => batchReopenMutation.mutate(selectedIssueIds)}
              disabled={batchReopenMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-accent-soft text-text hover:text-accent border border-border hover:border-accent/40 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIssueIds([])}
              className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Issues Table */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-surface-2/40">
          <div className="text-xs font-semibold text-text">
            {filteredIssues.length} Issue{filteredIssues.length === 1 ? '' : 's'}
          </div>

          {openIssuesInView.length > 0 && selectedIssueIds.length === 0 && (
            <button
              type="button"
              onClick={() => setIsDismissAllModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-danger border border-border text-[11px] font-medium transition-colors"
            >
              <EyeOff className="w-3 h-3" />
              <span>Dismiss All Visible Open ({openIssuesInView.length})</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={AlertCircle}
              title="No Matching Issues"
              description="No issues match the current filter selection. Try clearing filters or run a new scan."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b border-border text-text-faint uppercase tracking-wider text-[11px] select-none sticky top-0">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-text-muted hover:text-text transition-colors p-0.5"
                      title={selectedIssueIds.length === filteredIssues.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedIssueIds.length === filteredIssues.length && filteredIssues.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Target Page</th>
                  <th className="py-3 px-4">Status / Patch</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredIssues.map((issue: any) => {
                  const isSelected = selectedIssueIds.includes(issue.id);
                  const isDismissed = issue.status === 'DISMISSED';

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      className={`hover:bg-surface-2/70 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-surface-2/50' : ''
                      } ${isDismissed ? 'opacity-60 bg-surface-2/20' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectIssue(issue.id, e)}
                          className="text-text-muted hover:text-text transition-colors p-0.5"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Severity */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <SeverityChip severity={issue.severity} size="sm" />
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <CategoryChip category={issue.category} />
                      </td>

                      {/* Title & Selector */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-semibold text-text group-hover:text-accent transition-colors">
                          {issue.title}
                        </div>
                        <div className="text-[11px] text-text-faint font-mono truncate mt-0.5">
                          {issue.selector ? (
                            <span>Target: {issue.selector}</span>
                          ) : (
                            <span className="italic">Page-level issue / Network</span>
                          )}
                        </div>
                      </td>

                      {/* Target Page */}
                      <td className="py-3.5 px-4 font-mono text-text-muted truncate max-w-xs text-[11px]">
                        {issue.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                      </td>

                      {/* Status / Patch */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isDismissed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-surface-3 text-text-faint border border-border">
                            <EyeOff className="w-3 h-3" />
                            Dismissed
                          </span>
                        ) : issue.suggestedPatch ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-accent font-medium">
                              <FileCode2 className="w-3.5 h-3.5" />
                              Patch Ready
                            </span>
                            <RiskChip
                              risk={issue.suggestedPatch.riskLevel}
                              score={issue.suggestedPatch.riskScore}
                            />
                          </div>
                        ) : issue.status === 'REPORT_ONLY' ? (
                          <span className="text-[11px] text-text-faint italic">
                            Report only (no patch)
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-muted">
                            {issue.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {!isDismissed ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissMutation.mutate(issue.id);
                              }}
                              disabled={dismissMutation.isPending}
                              title="Dismiss this issue"
                              className="px-2 py-1 rounded bg-surface-2 hover:bg-danger-soft text-text-muted hover:text-danger border border-border hover:border-danger/40 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                            >
                              <EyeOff className="w-3 h-3" />
                              <span>Dismiss</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                reopenMutation.mutate(issue.id);
                              }}
                              disabled={reopenMutation.isPending}
                              title="Reopen this issue"
                              className="px-2 py-1 rounded bg-surface-2 hover:bg-accent-soft text-text-muted hover:text-accent border border-border hover:border-accent/40 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reopen</span>
                            </button>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted group-hover:text-accent transition-colors pl-1">
                            <span>Inspect</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
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

      {/* Confirmation Modal: Dismiss All Filtered */}
      <ConfirmModal
        isOpen={isDismissAllModalOpen}
        onClose={() => setIsDismissAllModalOpen(false)}
        onConfirm={() => {
          const idsToDismiss = openIssuesInView.map((i: any) => i.id);
          batchDismissMutation.mutate(idsToDismiss);
        }}
        title="Dismiss All Visible Issues"
        description={`Are you sure you want to dismiss all ${openIssuesInView.length} open issues currently shown in this view? Dismissed issues will be hidden from the active issues count and overview metrics.`}
        confirmText={`Dismiss ${openIssuesInView.length} Issues`}
        isLoading={batchDismissMutation.isPending}
      />
    </div>
  );
};
