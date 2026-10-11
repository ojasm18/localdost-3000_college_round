import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Clock,
  Layers,
  Cpu,
  ShieldCheck,
  Activity,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export const TestRuns: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: testRuns, isLoading, refetch } = useQuery({
    queryKey: ['testruns'],
    queryFn: () => api.get('/api/test-runs'),
    refetchInterval: 3000,
  });

  const runMutation = useMutation({
    mutationFn: (body?: { trigger?: string }) => api.post('/api/test-runs', body || { trigger: 'MANUAL' }),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['testruns'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      if (newRun?.id) {
        navigate(`/test-runs/${newRun.id}`);
      }
    },
  });

  const totalRuns = testRuns?.length || 0;
  const passedRuns = testRuns?.filter((r: any) => r.status === 'PASSED').length || 0;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
  const latestRun = testRuns?.[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-violet" />
            <span>Automated Visual Test Runs</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-accent-soft text-accent border border-accent/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Active Engine
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Automated regression validation: Playwright browser flows, pixelmatch visual diff gates, and runtime assertion checks.
          </p>
        </div>

        <button
          onClick={() => runMutation.mutate({ trigger: 'MANUAL' })}
          disabled={runMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50 text-xs font-semibold shadow-sm transition-all"
        >
          {runMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running Playwright Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Test Suite</span>
            </>
          )}
        </button>
      </div>

      {runMutation.isError && (
        <div className="p-3.5 rounded-lg bg-danger-soft border border-danger/30 text-xs text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Suite Execution Error: {(runMutation.error as any)?.message || 'Failed to execute test suite'}</span>
          </div>
          <button onClick={() => runMutation.reset()} className="text-[11px] underline">Dismiss</button>
        </div>
      )}

      {/* Regression Suite Architecture & Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-surface-1 border border-border space-y-1">
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>BROWSER ENGINE</span>
            <Cpu className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-sm font-bold text-text flex items-center gap-1.5 mt-1">
            <span>Playwright Chromium</span>
          </div>
          <p className="text-[11px] text-text-muted">Headless viewport (1280x800) snapshots</p>
        </div>

        <div className="p-4 rounded-lg bg-surface-1 border border-border space-y-1">
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>VISUAL GATE</span>
            <ShieldCheck className="w-3.5 h-3.5 text-violet" />
          </div>
          <div className="text-sm font-bold text-text flex items-center gap-1.5 mt-1">
            <span>Pixelmatch Diff Gate</span>
          </div>
          <p className="text-[11px] text-text-muted">Maximum allowable visual shift ≤ 0.5%</p>
        </div>

        <div className="p-4 rounded-lg bg-surface-1 border border-border space-y-1">
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>SUITE SUCCESS RATE</span>
            <Activity className="w-3.5 h-3.5 text-info" />
          </div>
          <div className="text-sm font-bold text-text flex items-center gap-1.5 mt-1 font-mono">
            <span>{passRate}%</span>
            <span className="text-[11px] font-normal text-text-faint">({passedRuns}/{totalRuns} passed)</span>
          </div>
          <p className="text-[11px] text-text-muted">Regression suite reliability</p>
        </div>

        <div className="p-4 rounded-lg bg-surface-1 border border-border space-y-1">
          <div className="text-[11px] font-medium text-text-faint flex items-center justify-between">
            <span>LATEST EXECUTION</span>
            <Clock className="w-3.5 h-3.5 text-text-faint" />
          </div>
          <div className="text-sm font-bold text-text flex items-center gap-1.5 mt-1">
            {latestRun ? (
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                  latestRun.status === 'PASSED'
                    ? 'bg-accent-soft text-accent'
                    : latestRun.status === 'FAILED'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-info-soft text-info'
                }`}
              >
                {latestRun.status}
              </span>
            ) : (
              <span className="text-xs text-text-muted">No runs yet</span>
            )}
          </div>
          <p className="text-[11px] text-text-muted font-mono truncate">
            {latestRun ? new Date(latestRun.startedAt).toLocaleTimeString() : 'Ready to execute'}
          </p>
        </div>
      </div>

      {/* Test Runs List */}
      <div className="rounded-lg bg-surface-1 border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center justify-between">
          <div className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-2">
            <span>Execution History</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-surface-3 text-text-faint">
              {totalRuns}
            </span>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-text-muted hover:text-text transition-colors"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !testRuns || testRuns.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <EmptyState
              icon={PlayCircle}
              title="No Test Runs Recorded"
              description="Execute your first automated visual regression suite to verify DOM stability and pixel-level diffs."
            />
            <button
              onClick={() => runMutation.mutate({ trigger: 'MANUAL' })}
              disabled={runMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold shadow-sm transition-all"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Launch Initial Suite</span>
            </button>
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
                        <span className="px-2 py-0.5 rounded bg-surface-2 border border-border">
                          {run.trigger}
                        </span>
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
