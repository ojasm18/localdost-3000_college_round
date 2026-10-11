import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Play,
  Check,
  X,
  Layers,
  Image as ImageIcon,
  Activity,
  RotateCw,
  ExternalLink,
  Package,
} from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';

export const TestRunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<{ src: string; title: string } | null>(null);

  const { data: testRun, isLoading, error } = useQuery({
    queryKey: ['testrun', id],
    queryFn: () => api.get(`/api/test-runs/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'QUEUED' ? 2000 : false;
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/api/test-runs/${id}/rerun`),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['testruns'] });
      if (newRun?.id) {
        navigate(`/test-runs/${newRun.id}`);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back button & Action Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/test-runs')}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Test Runs</span>
        </button>

        <button
          onClick={() => rerunMutation.mutate()}
          disabled={rerunMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-text border border-border text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${rerunMutation.isPending ? 'animate-spin' : ''}`} />
          <span>Rerun This Suite</span>
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

            {testRun.releaseId && (
              <span className="font-mono text-xs text-accent px-2.5 py-1 rounded bg-accent-soft border border-accent/30 flex items-center gap-1">
                <Package className="w-3 h-3" />
                Release: {testRun.releaseId}
              </span>
            )}

            {testRun.summary?.targetUrl && (
              <span className="font-mono text-[11px] text-text-faint px-2.5 py-1 rounded bg-surface-2 border border-border truncate max-w-xs" title={testRun.summary.targetUrl}>
                Target: {testRun.summary.targetUrl}
              </span>
            )}

            {testRun.summary?.appliedPatchesCount !== undefined && (
              <span className="font-mono text-xs text-violet px-2.5 py-1 rounded bg-violet/10 border border-violet/30">
                {testRun.summary.appliedPatchesCount} Patches Applied
              </span>
            )}
          </div>

          <div className="text-xs font-mono text-text-faint flex items-center gap-2">
            <span>Started: {new Date(testRun.startedAt).toLocaleString()}</span>
            {testRun.finishedAt && (
              <>
                <span>•</span>
                <span>Finished: {new Date(testRun.finishedAt).toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-text">Automated Verification Report</h1>
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
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            Verification Steps & Visual Diff Results ({steps.length})
          </h2>
          <span className="text-[11px] font-mono text-text-faint">Diff Gate Limit: ≤ 0.5%</span>
        </div>

        {steps.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            All flow assertions and smoke routes passed cleanly with zero visual drift outside target boundaries.
          </div>
        ) : (
          <div className="space-y-5">
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

                    {step.diffPercent !== undefined && step.diffPercent !== null && (
                      <span
                        className={`font-mono text-xs font-medium px-2 py-0.5 rounded ${
                          step.diffPercent <= 0.5
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        Visual Diff: {step.diffPercent > 0 ? step.diffPercent.toFixed(3) : '0.00'}%
                      </span>
                    )}
                  </div>

                  {step.error && (
                    <div className="p-3 rounded bg-danger-soft border border-danger/30 text-xs text-danger font-mono">
                      Error: {step.error}
                    </div>
                  )}

                  {/* Screenshots side by side with click-to-expand */}
                  {(step.baselineShot || step.currentShot || step.diffShot) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {/* Baseline */}
                      <div className="p-3 rounded bg-surface-1 border border-border space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-text-faint">
                          <span>BASELINE (PRE-PATCH)</span>
                          {step.baselineShot && (
                            <button
                              onClick={() => setSelectedImage({ src: step.baselineShot, title: 'Baseline Screenshot (Pre-patch)' })}
                              className="hover:text-accent flex items-center gap-1 text-[10px]"
                            >
                              <ExternalLink className="w-3 h-3" /> Expand
                            </button>
                          )}
                        </div>
                        {step.baselineShot ? (
                          <div
                            onClick={() => setSelectedImage({ src: step.baselineShot, title: 'Baseline Screenshot (Pre-patch)' })}
                            className="h-44 rounded bg-black/40 border border-border overflow-hidden cursor-pointer hover:border-border-strong transition-colors flex items-center justify-center"
                          >
                            <img
                              src={step.baselineShot}
                              alt="Baseline"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-44 rounded bg-bg flex items-center justify-center text-xs text-text-faint font-mono">
                            No Baseline
                          </div>
                        )}
                      </div>

                      {/* Candidate */}
                      <div className="p-3 rounded bg-surface-1 border border-border space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-text-faint">
                          <span>CANDIDATE (WITH PATCHES)</span>
                          {step.currentShot && (
                            <button
                              onClick={() => setSelectedImage({ src: step.currentShot, title: 'Candidate Screenshot (With Patches)' })}
                              className="hover:text-accent flex items-center gap-1 text-[10px]"
                            >
                              <ExternalLink className="w-3 h-3" /> Expand
                            </button>
                          )}
                        </div>
                        {step.currentShot ? (
                          <div
                            onClick={() => setSelectedImage({ src: step.currentShot, title: 'Candidate Screenshot (With Patches)' })}
                            className="h-44 rounded bg-black/40 border border-border overflow-hidden cursor-pointer hover:border-border-strong transition-colors flex items-center justify-center"
                          >
                            <img
                              src={step.currentShot}
                              alt="Candidate"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-44 rounded bg-bg flex items-center justify-center text-xs text-text-faint font-mono">
                            No Candidate
                          </div>
                        )}
                      </div>

                      {/* Pixelmatch Diff */}
                      <div className="p-3 rounded bg-surface-1 border border-border space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-text-faint">
                          <span>PIXELMATCH VISUAL DIFF</span>
                          {step.diffShot && (
                            <button
                              onClick={() => setSelectedImage({ src: step.diffShot, title: 'Pixelmatch Differential Map' })}
                              className="hover:text-accent flex items-center gap-1 text-[10px]"
                            >
                              <ExternalLink className="w-3 h-3" /> Expand
                            </button>
                          )}
                        </div>
                        {step.diffShot ? (
                          <div
                            onClick={() => setSelectedImage({ src: step.diffShot, title: 'Pixelmatch Differential Map' })}
                            className="h-44 rounded bg-black/40 border border-border overflow-hidden cursor-pointer hover:border-border-strong transition-colors flex items-center justify-center"
                          >
                            <img
                              src={step.diffShot}
                              alt="Visual Diff"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-44 rounded bg-bg flex items-center justify-center text-xs text-accent font-mono">
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

      {/* Modal image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="w-full max-w-5xl bg-surface-1 border border-border-strong rounded-lg shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-semibold text-text">{selectedImage.title}</span>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-text-muted hover:text-text p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto flex items-center justify-center bg-black/40 rounded p-2">
              <img
                src={selectedImage.src}
                alt={selectedImage.title}
                className="max-h-[75vh] w-auto object-contain rounded border border-border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
