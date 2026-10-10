import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export const TestRuns: React.FC = () => {
  const navigate = useNavigate();

  const { data: testRuns, isLoading } = useQuery({
    queryKey: ['testruns'],
    queryFn: () => api.get('/api/test-runs'),
    refetchInterval: 4000,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-violet" />
            Automated Visual Test Runs
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Automated regression validation: Playwright browser flows, pixelmatch visual diff gates, and runtime assertion checks.
          </p>
        </div>
      </div>

      {/* Test Runs List */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !testRuns || testRuns.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={PlayCircle}
              title="No Test Runs Recorded"
              description="Test runs execute automatically when release candidates or previews are verified."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b border-border text-text-faint uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Finished</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {testRuns.map((run: any) => {
                  const isPassed = run.status === 'PASSED';
                  const isFailed = run.status === 'FAILED';
                  const isRunning = run.status === 'RUNNING' || run.status === 'QUEUED';

                  return (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/test-runs/${run.id}`)}
                      className="hover:bg-surface-2/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isPassed
                              ? 'bg-accent-soft text-accent border border-accent/30'
                              : isFailed
                              ? 'bg-danger-soft text-danger border border-danger/30'
                              : 'bg-info-soft text-info border border-info/30'
                          }`}
                        >
                          {isPassed ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isFailed ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          <span>{run.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-text font-medium text-[11px]">
                        {run.trigger}
                      </td>

                      <td className="py-3.5 px-4 text-text-muted">
                        {run.summary?.message ||
                          (isPassed
                            ? 'All flows and pixelmatch diff gates passed (diff ≤ 0.5%)'
                            : isFailed
                            ? 'Visual anomaly or assertion failure detected'
                            : 'Executing baseline and candidate flows...')}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-text-faint text-[11px]">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-text-faint text-[11px]">
                        {run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString() : 'In flight'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted group-hover:text-accent transition-colors">
                          <span>Inspect Report</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
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
