import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  ShieldCheck,
  ShieldAlert,
  Flame,
  ExternalLink,
  Code2,
  Terminal,
  Layers,
  Sliders,
  Check,
  X,
  Edit3,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api';
import {
  SeverityChip,
  CategoryChip,
  RiskChip,
  PatchStatusChip,
} from '../components/chips';
import { Skeleton } from '../components/Skeleton';
import type { PatchOperation } from '../../../shared/types';

export const IssueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeVisualTab, setActiveVisualTab] = useState<'AFTER' | 'BEFORE' | 'SPLIT'>('SPLIT');

  const { data: issue, isLoading, error } = useQuery({
    queryKey: ['issue', id],
    queryFn: () => api.get(`/api/issues/${id}`),
    enabled: !!id,
  });

  // Accept patch mutation
  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/api/issues/${id}/accept-patch`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      if (data.patchId) {
        navigate(`/patches/${data.patchId}`);
      }
    },
  });

  // Dismiss issue mutation
  const dismissMutation = useMutation({
    mutationFn: () => api.post(`/api/issues/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  // Reopen issue mutation
  const reopenMutation = useMutation({
    mutationFn: () => api.post(`/api/issues/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
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

  if (error || !issue) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <h2 className="text-base font-semibold text-text">Issue Not Found</h2>
        <button
          onClick={() => navigate('/issues')}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-surface-2 text-text border border-border"
        >
          Back to Issues
        </button>
      </div>
    );
  }

  const patch = issue.suggestedPatch;
  const isAccepted = issue.status === 'PATCH_ACCEPTED';
  const isDismissed = issue.status === 'DISMISSED';
  const isReportOnly = issue.status === 'REPORT_ONLY' || issue.category === 'BACKEND_SYMPTOM' && !patch;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <div>
        <button
          onClick={() => navigate('/issues')}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Issues</span>
        </button>
      </div>

      {/* Main Issue Header Card */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={issue.severity} />
            <CategoryChip category={issue.category} />
            <span className="text-xs font-mono text-text-faint px-2 py-0.5 rounded bg-surface-2 border border-border">
              {issue.ruleId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAccepted && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-soft text-accent text-xs font-medium border border-accent/30">
                <Check className="w-3.5 h-3.5" />
                Patch Accepted
              </span>
            )}
            {isDismissed && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-2 text-text-muted text-xs font-medium border border-border">
                <EyeOff className="w-3.5 h-3.5 text-text-faint" />
                Dismissed
              </span>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-text leading-snug">{issue.title}</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{issue.description}</p>
        </div>

        {/* Target Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-md bg-surface-2 border border-border">
            <span className="text-[10px] text-text-faint font-semibold uppercase tracking-wider block">
              Page URL
            </span>
            <a
              href={issue.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline font-mono text-[11px] truncate flex items-center gap-1 mt-0.5"
            >
              <span className="truncate">{issue.pageUrl}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>

          <div className="p-3 rounded-md bg-surface-2 border border-border">
            <span className="text-[10px] text-text-faint font-semibold uppercase tracking-wider block">
              CSS Selector
            </span>
            <div className="font-mono text-[11px] text-text-muted truncate mt-0.5">
              {issue.selector || 'None (Page-level or network symptom)'}
            </div>
          </div>
        </div>
      </div>

      {/* Dismissed notice banner */}
      {isDismissed && (
        <div className="p-4 rounded-lg bg-surface-1 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs text-text-muted">
            <EyeOff className="w-4 h-4 text-text-faint flex-shrink-0" />
            <span>This issue is currently dismissed and hidden from active monitoring metrics.</span>
          </div>
          <button
            type="button"
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg border border-accent/30 text-xs font-semibold transition-colors disabled:opacity-50 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reopen Issue</span>
          </button>
        </div>
      )}

      {/* Suggested Patch Section (if available) */}
      {patch ? (
        <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-bold text-text">Suggested Runtime Patch</h2>
                <PatchStatusChip status={patch.status} />
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Automatically synthesized DOM/style operations to eliminate the issue without code deployment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <RiskChip risk={patch.riskLevel} score={patch.riskScore} />
            </div>
          </div>

          {/* Operations List */}
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              Patch Operations ({patch.operations?.length || 0})
            </h3>
            <div className="space-y-2">
              {patch.operations?.map((op: PatchOperation, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-md bg-surface-2 border border-border font-mono text-xs flex items-start justify-between gap-4"
                >
                  <div>
                    <span className="text-accent font-semibold">{op.op}</span>
                    {op.op === 'SET_STYLE' && (
                      <div className="text-[11px] text-text-muted mt-1 space-y-0.5">
                        {Object.entries(op.properties).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-text-faint">{k}:</span>
                            <span className="text-text">{v};</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {op.op === 'SET_ATTRIBUTE' && (
                      <div className="text-[11px] text-text-muted mt-1">
                        <span className="text-text-faint">{op.name} = </span>
                        <span className="text-text">"{op.value}"</span>
                      </div>
                    )}
                    {op.op === 'REMOVE_ATTRIBUTE' && (
                      <div className="text-[11px] text-text-muted mt-1">
                        <span className="text-text-faint">remove attribute </span>
                        <span className="text-danger">"{op.name}"</span>
                      </div>
                    )}
                    {op.op === 'SET_TEXT' && (
                      <div className="text-[11px] text-text-muted mt-1">
                        <span className="text-text-faint">text = </span>
                        <span className="text-text">"{op.value}"</span>
                      </div>
                    )}
                    {op.op === 'HIDE' && (
                      <div className="text-[11px] text-text-muted mt-1">
                        <span className="text-danger">display: none !important</span>
                      </div>
                    )}
                    {op.op === 'RUN_SCRIPT_TEMPLATE' && (
                      <div className="text-[11px] text-text-muted mt-1">
                        <span className="text-info font-semibold">Template: {op.template}</span>
                        <pre className="text-[10px] text-text-faint mt-0.5">
                          {JSON.stringify(op.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-text-faint font-mono">Step #{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Reasons breakdown */}
          {patch.riskReasons && patch.riskReasons.length > 0 && (
            <div className="p-3.5 rounded-md bg-surface-2/60 border border-border">
              <span className="text-xs font-semibold text-text mb-1 block">Risk Assessment Factors:</span>
              <ul className="list-disc list-inside text-xs text-text-muted space-y-1">
                {patch.riskReasons.map((reason: string, i: number) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Visual Comparison: Before / After */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                Visual Comparison Preview
              </h3>
              <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setActiveVisualTab('SPLIT')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeVisualTab === 'SPLIT' ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVisualTab('BEFORE')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeVisualTab === 'BEFORE' ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Before
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVisualTab('AFTER')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeVisualTab === 'AFTER' ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text'
                  }`}
                >
                  After Patch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(activeVisualTab === 'SPLIT' || activeVisualTab === 'BEFORE') && (
                <div className="p-4 rounded-md bg-surface-2 border border-border text-center">
                  <div className="text-[11px] font-mono text-danger font-semibold mb-2 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-danger"></span>
                    BEFORE (With Issue)
                  </div>
                  <div className="h-48 rounded bg-bg border border-border flex items-center justify-center text-xs text-text-muted font-mono p-4">
                    <div className="text-left space-y-1 text-xs">
                      <div className="text-text-faint">Target Element:</div>
                      <div className="text-danger font-mono bg-danger-soft p-2 rounded border border-danger/30 text-[11px]">
                        {issue.selector || 'Element with detected defect'}
                      </div>
                      <div className="text-text-faint text-[10px] pt-1">
                        Defect: {issue.title}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(activeVisualTab === 'SPLIT' || activeVisualTab === 'AFTER') && (
                <div className="p-4 rounded-md bg-surface-2 border border-border text-center">
                  <div className="text-[11px] font-mono text-accent font-semibold mb-2 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                    AFTER (Patched)
                  </div>
                  <div className="h-48 rounded bg-bg border border-border flex items-center justify-center text-xs text-text-muted font-mono p-4">
                    <div className="text-left space-y-1 text-xs">
                      <div className="text-text-faint">Applied Modifications:</div>
                      <div className="text-accent font-mono bg-accent-soft p-2 rounded border border-accent/30 text-[11px]">
                        {patch.operations?.map((op: any) => op.op).join(' + ') || 'Patched DOM'}
                      </div>
                      <div className="text-accent text-[10px] pt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Defect mitigated without page reload
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/editor?issueId=${issue.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text font-medium transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Fine-tune in Visual Editor</span>
              </button>
              {isDismissed ? (
                <button
                  type="button"
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-2 hover:bg-accent-soft border border-border text-xs text-text hover:text-accent transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Issue</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => dismissMutation.mutate()}
                  disabled={dismissMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-2 hover:bg-danger-soft border border-border text-xs text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || isAccepted}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isAccepted ? 'Patch Already Accepted' : 'Accept Patch'}</span>
            </button>
          </div>
        </div>
      ) : isReportOnly ? (
        /* Report-only banner */
        <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-warning-soft text-warning">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Report Only: Server / Root Cause Suspected</h2>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                This defect represents a root server-side failure or missing asset (e.g. 404 image, persistent server error)
                that cannot safely be fixed via client-side DOM mutation alone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {isDismissed ? (
              <button
                type="button"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg border border-accent/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Issue</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded bg-surface-2 text-text border border-border hover:bg-danger-soft hover:text-danger hover:border-danger/30 transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Acknowledge & Dismiss</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Technical Evidence Accordion/Card */}
      {issue.evidence && (
        <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-3">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-info" />
            Technical Evidence & DOM Snapshot
          </h3>
          <pre className="p-4 rounded-md bg-bg border border-border text-xs font-mono text-text-muted overflow-x-auto max-h-60">
            {JSON.stringify(issue.evidence, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
