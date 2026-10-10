import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Filter,
  Search,
  User,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Code2,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export const Activity: React.FC = () => {
  const [selectedActor, setSelectedActor] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get('/api/audit'),
  });

  // Action grouping helper
  const getActionGroup = (action: string) => {
    if (action.startsWith('SCAN_')) return 'SCANS';
    if (action.startsWith('PATCH_') || action.startsWith('ISSUE_')) return 'PATCHES';
    if (action.startsWith('RELEASE_') || action.startsWith('DEPLOY_') || action.startsWith('AUTO_ROLLBACK'))
      return 'RELEASES';
    if (action.startsWith('TEST_')) return 'TESTS';
    if (action.includes('HEALTH') || action.includes('RELOCAT') || action.includes('BROKEN'))
      return 'HEALTH';
    return 'OTHER';
  };

  const filteredEvents = (auditEvents || []).filter((ev: any) => {
    if (selectedActor !== 'ALL' && ev.actorId !== selectedActor) return false;
    if (selectedGroup !== 'ALL' && getActionGroup(ev.action) !== selectedGroup) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            Audit Trail
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Immutable timeline of scans, patch submissions, peer approvals, verification runs, and release deployments.
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 rounded-lg bg-surface-1 border border-border flex flex-wrap items-center gap-3">
        {/* Actor filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-faint">Actor:</span>
          <select
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-1.5 text-text outline-none text-xs"
          >
            <option value="ALL">All Actors</option>
            <option value="asha">Asha (Developer)</option>
            <option value="ravi">Ravi (Reviewer)</option>
            <option value="admin">Admin</option>
            <option value="system">System (Automated)</option>
          </select>
        </div>

        {/* Action Group filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-faint">Category:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-1.5 text-text outline-none text-xs"
          >
            <option value="ALL">All Events</option>
            <option value="RELEASES">Releases & Deployments</option>
            <option value="PATCHES">Patches & Issues</option>
            <option value="SCANS">Scanner Executions</option>
            <option value="TESTS">Automated Verifications</option>
            <option value="HEALTH">Runtime Health & Drift</option>
          </select>
        </div>
      </div>

      {/* Audit Feed */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="No Audit Records"
              description="No audit events matched the selected actor or category filters."
            />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredEvents.map((ev: any) => {
              const isExpanded = expandedEventId === ev.id;
              const hasMetadata = ev.metadata && Object.keys(ev.metadata).length > 0;

              return (
                <div key={ev.id} className="p-4 hover:bg-surface-2/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-text leading-snug">
                          {ev.summary}
                        </div>
                        <div className="text-[11px] text-text-faint font-mono mt-1 flex flex-wrap items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-surface-2 border border-border text-text-muted">
                            {ev.action}
                          </span>
                          <span>•</span>
                          <span>by {ev.actorName || ev.actorId}</span>
                          <span>•</span>
                          <span>target: {ev.targetType}:{ev.targetId}</span>
                          <span>•</span>
                          <span>{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {hasMetadata && (
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className="text-xs text-text-muted hover:text-text flex items-center gap-1 font-mono flex-shrink-0"
                      >
                        <span>JSON</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expandable Metadata JSON */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-3 pl-5">
                      <pre className="p-3 rounded bg-bg border border-border font-mono text-[11px] text-text-muted overflow-x-auto">
                        {JSON.stringify(ev.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
