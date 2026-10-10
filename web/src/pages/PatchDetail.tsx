import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  Check,
  X,
  MessageSquare,
  Eye,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Send,
  ExternalLink,
  Copy,
  Layers,
  Flame,
} from 'lucide-react';
import { api } from '../api';
import { useCurrentUser } from '../context/UserContext';
import {
  PatchStatusChip,
  HealthChip,
  RiskChip,
} from '../components/chips';
import { Skeleton } from '../components/Skeleton';
import type { PatchOperation, PatchStatus } from '../../../shared/types';

export const PatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();

  const [commentText, setCommentText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch patch details
  const { data: patch, isLoading, error } = useQuery({
    queryKey: ['patch', id],
    queryFn: () => api.get(`/api/patches/${id}`),
    enabled: !!id,
  });

  // Query site details
  const { data: site } = useQuery({
    queryKey: ['site'],
    queryFn: () => api.get('/api/site'),
  });

  // Query conflicts for this patch if any
  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', id],
    queryFn: () => api.get('/api/conflicts'),
    select: (list) =>
      list?.filter(
        (c: any) => (c.patchAId === id || c.patchBId === id) && c.status === 'OPEN'
      ) || [],
  });

  // Action mutations
  const submitForReview = useMutation({
    mutationFn: () => api.post(`/api/patches/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch', id] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const approvePatch = useMutation({
    mutationFn: () => api.post(`/api/patches/${id}/approve`, { comment: reviewNote }),
    onSuccess: () => {
      setReviewNote('');
      queryClient.invalidateQueries({ queryKey: ['patch', id] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const requestChanges = useMutation({
    mutationFn: () =>
      api.post(`/api/patches/${id}/request-changes`, { comment: reviewNote || 'Changes requested' }),
    onSuccess: () => {
      setReviewNote('');
      queryClient.invalidateQueries({ queryKey: ['patch', id] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const rejectPatch = useMutation({
    mutationFn: () => api.post(`/api/patches/${id}/reject`, { reason: 'Rejected by author/admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch', id] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const addComment = useMutation({
    mutationFn: (body: string) => api.post(`/api/patches/${id}/comments`, { body }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['patch', id] });
    },
  });

  const createPreview = useMutation({
    mutationFn: () => api.post('/api/previews', { patchIds: [id] }),
    onSuccess: (data) => {
      const targetUrl = patch?.targetPageUrlPattern?.includes('http')
        ? patch.targetPageUrlPattern
        : (site?.baseUrl || window.location.origin);
      const separator = targetUrl.includes('?') ? '&' : '?';
      const fullUrl = `${targetUrl}${separator}pw_preview=${data.token}`;
      setPreviewUrl(fullUrl);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !patch) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <h2 className="text-base font-semibold text-text">Patch Not Found</h2>
        <button
          onClick={() => navigate('/patches')}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-surface-2 text-text border border-border"
        >
          Back to Patches
        </button>
      </div>
    );
  }

  // Stepper logic: Draft -> In Review -> Verified -> Live
  const steps: { label: string; statusMatch: PatchStatus[] }[] = [
    { label: 'Draft', statusMatch: ['DRAFT'] },
    { label: 'Review', statusMatch: ['IN_REVIEW', 'APPROVED'] },
    { label: 'Verified', statusMatch: ['VERIFIED'] },
    { label: 'Live', statusMatch: ['DEPLOYED'] },
  ];

  const currentStepIndex =
    patch.status === 'DEPLOYED'
      ? 3
      : patch.status === 'VERIFIED'
      ? 2
      : patch.status === 'IN_REVIEW' || patch.status === 'APPROVED'
      ? 1
      : 0;

  const isAuthorOrDev = currentUser.role === 'DEVELOPER' || currentUser.role === 'ADMIN';
  const isReviewerOrAdmin = currentUser.role === 'REVIEWER' || currentUser.role === 'ADMIN';

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

      {/* Conflict Warning Banner if conflict exists */}
      {conflicts && conflicts.length > 0 && (
        <div className="p-4 rounded-lg bg-danger-soft border border-danger/40 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-danger/20 text-danger mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-danger flex items-center gap-2">
                Release Blocked: Target Collision Detected
              </div>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                This patch targets the same DOM element and property as another candidate patch.
                Resolve the collision before creating a release bundle.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/conflicts/${conflicts[0].id}`)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-danger text-bg hover:bg-danger/90 transition-colors"
          >
            Resolve Conflict
          </button>
        </div>
      )}

      {/* Main Patch Header Card */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PatchStatusChip status={patch.status} />
            <HealthChip health={patch.health} />
            <RiskChip risk={patch.riskLevel} score={patch.riskScore} />
          </div>

          {/* Isolated Preview CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => createPreview.mutate()}
              disabled={createPreview.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{createPreview.isPending ? 'Generating...' : 'Isolated Preview'}</span>
            </button>
          </div>
        </div>

        {/* Preview Token Banner if generated */}
        {previewUrl && (
          <div className="p-3.5 rounded-md bg-accent-soft border border-accent/40 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-accent truncate">
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{previewUrl}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewUrl);
                  setCopiedPreview(true);
                  setTimeout(() => setCopiedPreview(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-accent text-accent-fg text-xs font-semibold flex items-center gap-1"
              >
                {copiedPreview ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPreview ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-surface-2 text-text border border-border text-xs hover:bg-surface-3"
              >
                Open
              </a>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-lg font-bold text-text leading-snug">{patch.title}</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{patch.description}</p>
        </div>

        {/* Lifecycle Stepper */}
        <div className="pt-2">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((st, i) => {
              const isPast = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={st.label} className="text-center">
                  <div
                    className={`h-2 rounded-full mb-2 transition-all ${
                      isPast || isCurrent ? 'bg-accent' : 'bg-surface-3'
                    }`}
                  />
                  <span
                    className={`text-xs font-mono font-medium ${
                      isCurrent
                        ? 'text-accent font-bold'
                        : isPast
                        ? 'text-text'
                        : 'text-text-faint'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-md bg-surface-2 border border-border">
            <span className="text-[10px] text-text-faint font-semibold uppercase tracking-wider block">
              Target Selector
            </span>
            <div className="font-mono text-[11px] text-text truncate mt-0.5">
              {patch.targetSelector}
            </div>
          </div>

          <div className="p-3 rounded-md bg-surface-2 border border-border">
            <span className="text-[10px] text-text-faint font-semibold uppercase tracking-wider block">
              Page Pattern
            </span>
            <div className="font-mono text-[11px] text-text-muted truncate mt-0.5">
              {patch.targetPageUrlPattern}
            </div>
          </div>
        </div>
      </div>

      {/* Changes & Operations */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-accent" />
          Patch Changes & DOM Operations
        </h2>

        <div className="space-y-2">
          {patch.operations?.map((op: PatchOperation, idx: number) => (
            <div
              key={idx}
              className="p-3.5 rounded-md bg-surface-2 border border-border font-mono text-xs flex items-start justify-between"
            >
              <div>
                <span className="text-accent font-semibold">{op.op}</span>
                {op.op === 'SET_STYLE' && (
                  <div className="text-[11px] text-text-muted mt-1.5 space-y-0.5">
                    {Object.entries(op.properties).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-text-faint">{k}:</span>
                        <span className="text-accent">{v};</span>
                      </div>
                    ))}
                  </div>
                )}
                {op.op === 'SET_ATTRIBUTE' && (
                  <div className="text-[11px] text-text-muted mt-1.5">
                    <span className="text-text-faint">{op.name} = </span>
                    <span className="text-text">"{op.value}"</span>
                  </div>
                )}
                {op.op === 'REMOVE_ATTRIBUTE' && (
                  <div className="text-[11px] text-text-muted mt-1.5">
                    <span className="text-text-faint">remove attribute </span>
                    <span className="text-danger">"{op.name}"</span>
                  </div>
                )}
                {op.op === 'SET_TEXT' && (
                  <div className="text-[11px] text-text-muted mt-1.5">
                    <span className="text-text-faint">text = </span>
                    <span className="text-text">"{op.value}"</span>
                  </div>
                )}
                {op.op === 'HIDE' && (
                  <div className="text-[11px] text-danger mt-1.5">
                    display: none !important
                  </div>
                )}
              </div>
              <span className="text-[10px] text-text-faint font-mono">Step #{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review Actions by Role & State */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider">
          Peer Review & Collaboration Actions
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* If DRAFT: Author/Developer can Submit for Review */}
          {patch.status === 'DRAFT' && isAuthorOrDev && (
            <button
              onClick={() => submitForReview.mutate()}
              disabled={submitForReview.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Peer Review</span>
            </button>
          )}

          {/* If IN_REVIEW: Reviewer can Approve or Request Changes */}
          {patch.status === 'IN_REVIEW' && isReviewerOrAdmin && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Review comment / feedback..."
                className="px-3 py-2 rounded-md bg-surface-2 border border-border text-xs text-text outline-none flex-1 sm:w-64"
              />
              <button
                onClick={() => approvePatch.mutate()}
                disabled={approvePatch.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => requestChanges.mutate()}
                disabled={requestChanges.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-warning-soft text-warning hover:bg-warning/20 border border-warning/30 text-xs font-medium transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Request Changes</span>
              </button>
            </div>
          )}

          {/* If APPROVED or VERIFIED: Link to Releases */}
          {(patch.status === 'APPROVED' || patch.status === 'VERIFIED') && (
            <button
              onClick={() => navigate(`/releases?create=true&patchIds=${patch.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Package into Release Candidate</span>
            </button>
          )}

          {/* Rejection / Drop */}
          {patch.status !== 'DEPLOYED' && patch.status !== 'REJECTED' && (
            <button
              onClick={() => rejectPatch.mutate()}
              disabled={rejectPatch.isPending}
              className="px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-danger text-xs transition-colors"
            >
              Reject / Close
            </button>
          )}
        </div>
      </div>

      {/* Conversation Thread & Review Decisions */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-accent" />
          Discussion Thread ({patch.comments?.length || 0})
        </h2>

        {/* Existing Comments */}
        <div className="space-y-3">
          {(!patch.comments || patch.comments.length === 0) ? (
            <div className="text-xs text-text-faint py-3">No comments yet. Start the conversation below.</div>
          ) : (
            patch.comments.map((cm: any) => (
              <div key={cm.id} className="p-3.5 rounded-md bg-surface-2 border border-border text-xs space-y-1">
                <div className="flex items-center justify-between text-text-faint text-[11px]">
                  <span className="font-semibold text-text">{cm.authorId}</span>
                  <span className="font-mono">{new Date(cm.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-text leading-relaxed">{cm.body}</p>
              </div>
            ))
          )}
        </div>

        {/* Add comment box */}
        <div className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment or question..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                addComment.mutate(commentText.trim());
              }
            }}
            className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-border text-xs text-text outline-none focus:border-accent"
          />
          <button
            onClick={() => {
              if (commentText.trim()) addComment.mutate(commentText.trim());
            }}
            disabled={!commentText.trim() || addComment.isPending}
            className="px-3.5 py-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
};
