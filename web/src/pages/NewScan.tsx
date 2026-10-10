import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Scan as ScanIcon,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Clock,
  ArrowRight,
  Globe,
  Trash2,
  CheckSquare,
  Square,
  FileCode2,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';

export const NewScan: React.FC = () => {
  const [url, setUrl] = useState(() => {
    return localStorage.getItem('patchwork_active_url') || '';
  });
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Deletion state
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);
  const [scanToDelete, setScanToDelete] = useState<any | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Query site for target URL shortcut
  const { data: site } = useQuery({
    queryKey: ['site'],
    queryFn: () => api.get('/api/site'),
  });

  // Query recent scans
  const { data: scans, isLoading: scansLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: () => api.get('/api/scans'),
    refetchInterval: activeScanId ? 2000 : false,
  });

  useEffect(() => {
    if (!url) {
      const saved = localStorage.getItem('patchwork_active_url');
      if (saved) {
        setUrl(saved);
      } else if (site?.baseUrl) {
        setUrl(site.baseUrl);
      } else if (scans && scans.length > 0 && scans[0]?.url) {
        setUrl(scans[0].url);
      }
    }
  }, [site?.baseUrl, scans]);

  // Query active scan status if one is running
  const { data: activeScan } = useQuery({
    queryKey: ['scan', activeScanId],
    queryFn: () => api.get(`/api/scans/${activeScanId}`),
    enabled: !!activeScanId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
        return false;
      }
      return 2000;
    },
  });

  // Start scan mutation
  const startScanMutation = useMutation({
    mutationFn: (targetUrl: string) => api.post('/api/scans', { url: targetUrl }),
    onSuccess: (data, targetUrl) => {
      setActiveScanId(data.id);
      setScanError(null);
      localStorage.setItem('patchwork_active_url', targetUrl);
      queryClient.invalidateQueries({ queryKey: ['site'] });
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (err: any) => {
      setScanError(err.message || 'Failed to start scan');
    },
  });

  // Delete single scan mutation
  const deleteScanMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/scans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      if (scanToDelete && activeScanId === scanToDelete.id) {
        setActiveScanId(null);
      }
      setSelectedScanIds((prev) => prev.filter((id) => id !== scanToDelete?.id));
      setScanToDelete(null);
    },
  });

  // Batch / Clear all scans mutation
  const deleteBatchScansMutation = useMutation({
    mutationFn: (data: { scanIds?: string[]; all?: boolean }) =>
      api.delete('/api/scans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setSelectedScanIds([]);
      setIsClearAllModalOpen(false);
      setIsBulkDeleteModalOpen(false);
      setActiveScanId(null);
    },
  });

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanUrl = url.trim();
    if (!cleanUrl) return;
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
      setUrl(cleanUrl);
    }
    localStorage.setItem('patchwork_active_url', cleanUrl);
    startScanMutation.mutate(cleanUrl);
  };

  const isScanning =
    startScanMutation.isPending || (activeScan && activeScan.status === 'RUNNING');

  const toggleSelectScan = (id: string) => {
    setSelectedScanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!scans) return;
    if (selectedScanIds.length === scans.length) {
      setSelectedScanIds([]);
    } else {
      setSelectedScanIds(scans.map((s: any) => s.id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ScanIcon className="w-5 h-5 text-accent" />
          Scanner & Site Audits
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Perform automated audits: accessibility violations, clickable overlaps, broken interactions,
          and failed backend requests. Delete previous scans or inspect findings.
        </p>
      </div>

      {/* URL Input Form Card */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border">
        <form onSubmit={handleStartScan} className="space-y-4">
          <label className="block text-xs font-semibold text-text uppercase tracking-wider">
            Target Page URL
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com, https://yourdomain.com, or http://localhost:3000"
                required
                disabled={isScanning}
                className="w-full pl-10 pr-4 py-2.5 rounded-md bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent text-sm text-text placeholder:text-text-faint outline-none font-mono transition-colors disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isScanning}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Scan</span>
                </>
              )}
            </button>
          </div>

          {site?.baseUrl && (
            <div className="flex items-center gap-2 text-xs text-text-faint pt-1">
              <span>Target Site:</span>
              <button
                type="button"
                onClick={() => setUrl(site.baseUrl)}
                className="text-text-muted hover:text-accent font-mono underline"
              >
                {site.baseUrl}
              </button>
            </div>
          )}
        </form>

        {scanError && (
          <div className="mt-4 p-3 rounded-md bg-danger-soft border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </div>

      {/* Active Scan Progress Card */}
      {activeScan && (
        <div className="p-6 rounded-lg bg-surface-1 border border-border-strong animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {activeScan.status === 'RUNNING' ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              ) : activeScan.status === 'COMPLETED' ? (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-danger" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <span>
                    {activeScan.status === 'FAILED'
                      ? 'Scan Failed'
                      : activeScan.status === 'COMPLETED'
                      ? 'Scan Completed'
                      : 'Scan in Progress'}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                      activeScan.status === 'COMPLETED'
                        ? 'bg-accent-soft text-accent'
                        : activeScan.status === 'FAILED'
                        ? 'bg-danger-soft text-danger'
                        : 'bg-info-soft text-info'
                    }`}
                  >
                    {activeScan.status}
                  </span>
                </h3>
                <p className="text-xs text-text-muted font-mono mt-0.5">{activeScan.url}</p>
              </div>
            </div>

            {activeScan.status === 'COMPLETED' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('patchwork_active_url', activeScan.url);
                    navigate(`/editor?url=${encodeURIComponent(activeScan.url)}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-text border border-border text-xs font-medium transition-colors"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-accent" />
                  <span>Open in Visual Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/issues?scanId=${activeScan.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold transition-colors"
                >
                  <span>View {activeScan.summary?.total || 0} Issues</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface-3 h-2 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-300 ${
                activeScan.status === 'FAILED' ? 'bg-danger' : 'bg-accent'
              }`}
              style={{ width: `${activeScan.progress || (activeScan.status === 'COMPLETED' ? 100 : 25)}%` }}
            />
          </div>

          {/* Failure reason if failed */}
          {activeScan.status === 'FAILED' && (
            <div className="p-3 rounded-md bg-danger-soft border border-danger/30 text-xs text-danger flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to scan target website</p>
                <p className="mt-0.5 text-danger/80">
                  {activeScan.summary?.error || 'Could not connect to the target domain. Verify the URL is valid and reachable.'}
                </p>
              </div>
            </div>
          )}

          {/* Issue breakdown if completed */}
          {activeScan.status === 'COMPLETED' && activeScan.summary && (
            <div className="grid grid-cols-4 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded bg-surface-2 border border-border text-center">
                <span className="text-text-faint text-[10px] block">TOTAL ISSUES</span>
                <span className="text-base font-bold font-mono text-text">
                  {activeScan.summary.total}
                </span>
              </div>
              <div className="p-2.5 rounded bg-surface-2 border border-border text-center">
                <span className="text-danger text-[10px] block">CRITICAL</span>
                <span className="text-base font-bold font-mono text-danger">
                  {activeScan.summary.bySeverity?.CRITICAL || 0}
                </span>
              </div>
              <div className="p-2.5 rounded bg-surface-2 border border-border text-center">
                <span className="text-warning text-[10px] block">HIGH/MEDIUM</span>
                <span className="text-base font-bold font-mono text-warning">
                  {(activeScan.summary.bySeverity?.HIGH || 0) + (activeScan.summary.bySeverity?.MEDIUM || 0)}
                </span>
              </div>
              <div className="p-2.5 rounded bg-surface-2 border border-border text-center">
                <span className="text-info text-[10px] block">LOW</span>
                <span className="text-base font-bold font-mono text-info">
                  {activeScan.summary.bySeverity?.LOW || 0}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previously Scanned Sites Table */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Previously Scanned Sites</h2>
            <p className="text-xs text-text-muted mt-0.5">
              History of all audited domains and endpoints. You can inspect findings or delete old scan records.
            </p>
          </div>

          {scans && scans.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedScanIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-danger-soft hover:bg-danger text-danger hover:text-bg border border-danger/30 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedScanIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-danger-soft text-text-muted hover:text-danger border border-border text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Scans</span>
              </button>
            </div>
          )}
        </div>

        {scansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !scans || scans.length === 0 ? (
          <EmptyState
            icon={ScanIcon}
            title="No Scanned Sites"
            description="Enter a URL above and run your first scan to discover actionable issues."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-faint uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-text-muted hover:text-text transition-colors p-0.5"
                      title={selectedScanIds.length === scans.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedScanIds.length === scans.length && scans.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Target URL</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Issues Found</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {scans.map((s: any) => {
                  const total = s.summary?.total ?? 0;
                  const isSelected = selectedScanIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-surface-2/60 transition-colors ${
                        isSelected ? 'bg-surface-2/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSelectScan(s.id)}
                          className="text-text-muted hover:text-text transition-colors p-0.5"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono text-text truncate max-w-xs">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-text-faint flex-shrink-0" />
                          <span className="truncate">{s.url}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            s.status === 'COMPLETED'
                              ? 'bg-accent-soft text-accent border border-accent/30'
                              : s.status === 'FAILED'
                              ? 'bg-danger-soft text-danger border border-danger/30'
                              : 'bg-info-soft text-info border border-info/30'
                          }`}
                        >
                          {s.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : s.status === 'FAILED' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {s.status === 'FAILED' ? (
                          <span className="text-danger text-[11px] truncate max-w-xs block font-sans" title={s.summary?.error}>
                            {s.summary?.error || 'Unreachable host'}
                          </span>
                        ) : s.summary ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text">{total}</span>
                            <span className="text-text-faint text-[10px]">
                              ({s.summary.bySeverity?.CRITICAL || 0} crit,{' '}
                              {s.summary.bySeverity?.HIGH || 0} high)
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-text-faint font-mono">
                        {new Date(s.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.setItem('patchwork_active_url', s.url);
                              navigate(`/editor?url=${encodeURIComponent(s.url)}`);
                            }}
                            title="Open site in Visual Editor"
                            className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text border border-border text-[11px] transition-colors inline-flex items-center gap-1"
                          >
                            <FileCode2 className="w-3 h-3 text-accent" />
                            <span>Editor</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/issues?scanId=${s.id}`)}
                            className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-text border border-border text-[11px] transition-colors"
                          >
                            View Issues
                          </button>
                          <button
                            type="button"
                            onClick={() => setScanToDelete(s)}
                            title="Delete this scan"
                            className="p-1 rounded bg-surface-2 hover:bg-danger-soft text-text-faint hover:text-danger border border-border hover:border-danger/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Confirmation Modal: Delete Single Scan */}
      <ConfirmModal
        isOpen={!!scanToDelete}
        onClose={() => setScanToDelete(null)}
        onConfirm={() => {
          if (scanToDelete) {
            deleteScanMutation.mutate(scanToDelete.id);
          }
        }}
        title="Delete Scanned Site Record"
        description={`Are you sure you want to delete the scan for "${scanToDelete?.url}"? All detected issues, generated patches, and audit artifacts from this run will be permanently removed.`}
        confirmText="Delete Scan"
        danger={true}
        isLoading={deleteScanMutation.isPending}
      />

      {/* Confirmation Modal: Bulk Delete */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={() => {
          deleteBatchScansMutation.mutate({ scanIds: selectedScanIds });
        }}
        title="Delete Selected Scans"
        description={`Are you sure you want to delete ${selectedScanIds.length} scanned site records? Associated issues and pending draft patches will also be cleared.`}
        confirmText={`Delete ${selectedScanIds.length} Scans`}
        danger={true}
        isLoading={deleteBatchScansMutation.isPending}
      />

      {/* Confirmation Modal: Clear All */}
      <ConfirmModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirm={() => {
          deleteBatchScansMutation.mutate({ all: true });
        }}
        title="Clear All Scanned Sites"
        description="Are you sure you want to clear all previously scanned site records? All scanner findings, unresolved draft patches, and screenshots across the entire system will be wiped."
        confirmText="Clear All Scans"
        danger={true}
        isLoading={deleteBatchScansMutation.isPending}
      />
    </div>
  );
};
