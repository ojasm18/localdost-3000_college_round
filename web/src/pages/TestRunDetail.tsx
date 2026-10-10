import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Check,
  X,
  Layers,
  Image as ImageIcon,
  Activity,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';

export const TestRunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: testRun, isLoading, error } = useQuery({
    queryKey: ['testrun', id],
    queryFn: () => api.get(`/api/test-runs/${id}`),
    enabled: !!id,
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

  if (error || !testRun) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <h2 className="text-base font-semibold text-text">Test Run Not Found</h2>
        <button
          onClick={() => navigate('/test-runs')}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-surface-2 text-text border border-border"
        >
          Back to Test Runs
        </button>
      </div>
    );
  }

  const isPassed = testRun.status === 'PASSED';
  const steps = testRun.steps || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/test-runs')}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Test Runs</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isPassed
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'bg-danger-soft text-danger border border-danger/30'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>{testRun.status}</span>
            </span>

            <span className="font-mono text-xs text-text-faint px-2.5 py-1 rounded bg-surface-2 border border-border">
              Trigger: {testRun.trigger}
            </span>
          </div>

          <div className="text-xs font-mono text-text-faint">
            Started: {new Date(testRun.startedAt).toLocaleString()}
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-text">Verification Run Summary</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {testRun.summary?.message ||
              (isPassed
                ? 'All automated verification flows executed successfully without unexpected visual shifts.'
                : 'Automated test suite identified potential visual regressions or unhandled errors.')}
          </p>
        </div>
      </div>

      {/* Steps Execution Table / Cards */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-accent" />
          Flow Steps & Visual Diff Results ({steps.length})
        </h2>

        {steps.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            All flow assertions and smoke routes passed cleanly with zero visual drift outside target boundaries.
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step: any, idx: number) => {
              const stepPassed = step.status === 'PASSED';
              return (
                <div
                  key={step.id || idx}
                  className="p-4 rounded-lg bg-surface-2 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          stepPassed
                            ? 'bg-accent-soft text-accent border border-accent/30'
                            : 'bg-danger-soft text-danger border border-danger/30'
                        }`}
                      >
                        {stepPassed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </span>
                      <span className="font-semibold text-xs text-text">
                        {step.flowName} • Step #{step.stepIndex} ({step.action})
                      </span>
                    </div>

                    {step.diffPercent !== undefined && (
                      <span
                        className={`font-mono text-xs font-medium px-2 py-0.5 rounded ${
                          step.diffPercent <= 0.5
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        Diff: {step.diffPercent.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  {step.error && (
                    <div className="p-3 rounded bg-danger-soft border border-danger/30 text-xs text-danger font-mono">
                      Error: {step.error}
                    </div>
                  )}

                  {/* Screenshots side by side if available */}
                  {(step.baselineShot || step.currentShot || step.diffShot) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div className="p-2.5 rounded bg-surface-1 border border-border text-center">
                        <span className="text-[10px] font-mono text-text-faint block mb-1">
                          BASELINE (Pre-patch)
                        </span>
                        {step.baselineShot ? (
                          <img
                            src={step.baselineShot}
                            alt="Baseline"
                            className="w-full h-32 object-cover rounded border border-border"
                          />
                        ) : (
                          <div className="h-32 rounded bg-bg flex items-center justify-center text-xs text-text-faint font-mono">
                            No Baseline
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded bg-surface-1 border border-border text-center">
                        <span className="text-[10px] font-mono text-text-faint block mb-1">
                          CANDIDATE (With Patches)
                        </span>
                        {step.currentShot ? (
                          <img
                            src={step.currentShot}
                            alt="Current"
                            className="w-full h-32 object-cover rounded border border-border"
                          />
                        ) : (
                          <div className="h-32 rounded bg-bg flex items-center justify-center text-xs text-text-faint font-mono">
                            No Candidate
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded bg-surface-1 border border-border text-center">
                        <span className="text-[10px] font-mono text-text-faint block mb-1">
                          PIXELMATCH DIFF
                        </span>
                        {step.diffShot ? (
                          <img
                            src={step.diffShot}
                            alt="Diff"
                            className="w-full h-32 object-cover rounded border border-border"
                          />
                        ) : (
                          <div className="h-32 rounded bg-bg flex items-center justify-center text-xs text-accent font-mono">
                            Zero Visual Diff
                          </div>
                        )}
                      </div>
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
