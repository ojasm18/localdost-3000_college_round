import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  HelpCircle,
  Compass,
  Unlink,
  Clock,
  Eye,
  Check,
  RotateCcw,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Radio,
  Loader2,
  Accessibility,
  LayoutGrid,
  FileText,
  MousePointerClick,
  ServerCrash,
} from 'lucide-react';
import type {
  IssueSeverity,
  PatchStatus,
  HealthStatus,
  RiskLevel,
  ReleaseStatus,
  IssueCategory,
} from '../../../shared/types';

// Severity Chip
export const SeverityChip: React.FC<{ severity: IssueSeverity; size?: 'sm' | 'md' }> = ({
  severity,
  size = 'md',
}) => {
  const map: Record<IssueSeverity, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    CRITICAL: {
      label: 'Critical',
      bg: 'bg-danger text-bg font-semibold shadow-sm',
      text: 'text-bg',
      icon: <Flame className="w-3.5 h-3.5" />,
    },
    HIGH: {
      label: 'High',
      bg: 'bg-danger-soft text-danger border border-danger/30',
      text: 'text-danger',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-warning-soft text-warning border border-warning/30',
      text: 'text-warning',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    LOW: {
      label: 'Low',
      bg: 'bg-info-soft text-info border border-info/30',
      text: 'text-info',
      icon: <Info className="w-3.5 h-3.5" />,
    },
  };

  const item = map[severity] || map.LOW;
  const py = size === 'sm' ? 'py-0.5 px-2 text-xs' : 'py-1 px-2.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${item.bg} ${py}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

// Patch Status Chip
export const PatchStatusChip: React.FC<{ status: PatchStatus }> = ({ status }) => {
  const map: Record<PatchStatus, { label: string; className: string; icon: React.ReactNode }> = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-surface-2 text-neutral border border-border',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    IN_REVIEW: {
      label: 'In Review',
      className: 'bg-info-soft text-info border border-info/30',
      icon: <Eye className="w-3.5 h-3.5" />,
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-accent-soft text-accent border border-accent/30',
      icon: <Check className="w-3.5 h-3.5" />,
    },
    VERIFIED: {
      label: 'Verified',
      className: 'bg-violet-soft text-violet border border-violet/30',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    DEPLOYED: {
      label: 'Deployed',
      className: 'bg-accent text-accent-fg font-semibold shadow-sm',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    REVERTED: {
      label: 'Reverted',
      className: 'bg-warning-soft text-warning border border-warning/30',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-danger-soft text-danger border border-danger/30',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };

  const item = map[status] || map.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium ${item.className}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

// Health Chip
export const HealthChip: React.FC<{ health: HealthStatus }> = ({ health }) => {
  const map: Record<HealthStatus, { label: string; className: string; icon: React.ReactNode }> = {
    HEALTHY: {
      label: 'Healthy',
      className: 'bg-accent-soft text-accent border border-accent/30',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    DRIFTED: {
      label: 'Drifted',
      className: 'bg-warning-soft text-warning border border-warning/30',
      icon: <Compass className="w-3.5 h-3.5" />,
    },
    BROKEN: {
      label: 'Broken',
      className: 'bg-danger-soft text-danger border border-danger/30',
      icon: <Unlink className="w-3.5 h-3.5" />,
    },
    UNKNOWN: {
      label: 'Unknown',
      className: 'bg-surface-2 text-neutral border border-border',
      icon: <HelpCircle className="w-3.5 h-3.5" />,
    },
  };

  const item = map[health] || map.UNKNOWN;

  return (
    <span className={`inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium ${item.className}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

// Risk Chip
export const RiskChip: React.FC<{ risk: RiskLevel; score?: number }> = ({ risk, score }) => {
  const map: Record<RiskLevel, { label: string; className: string; icon: React.ReactNode }> = {
    LOW: {
      label: 'Low Risk',
      className: 'bg-accent-soft text-accent border border-accent/30',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    MEDIUM: {
      label: 'Medium Risk',
      className: 'bg-warning-soft text-warning border border-warning/30',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    HIGH: {
      label: 'High Risk',
      className: 'bg-danger-soft text-danger border border-danger/30',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
  };

  const item = map[risk] || map.LOW;

  return (
    <span className={`inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium ${item.className}`}>
      {item.icon}
      <span>
        {item.label}
        {score !== undefined && ` (${score}/100)`}
      </span>
    </span>
  );
};

// Release Status Chip
export const ReleaseStatusChip: React.FC<{ status: ReleaseStatus }> = ({ status }) => {
  const map: Record<ReleaseStatus, { label: string; className: string; icon: React.ReactNode }> = {
    LIVE: {
      label: 'LIVE',
      className: 'bg-accent-soft text-accent border border-accent/40 font-semibold',
      icon: (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
        </span>
      ),
    },
    SUPERSEDED: {
      label: 'Superseded',
      className: 'bg-surface-2 text-neutral border border-border',
      icon: <Radio className="w-3.5 h-3.5" />,
    },
    ROLLED_BACK: {
      label: 'Rolled Back',
      className: 'bg-warning-soft text-warning border border-warning/30',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
    },
    FAILED: {
      label: 'Failed',
      className: 'bg-danger-soft text-danger border border-danger/30',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    BUILDING: {
      label: 'Building',
      className: 'bg-info-soft text-info border border-info/30',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
  };

  const item = map[status] || map.SUPERSEDED;

  return (
    <span className={`inline-flex items-center gap-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${item.className}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

// Issue Category Chip
export const CategoryChip: React.FC<{ category: IssueCategory }> = ({ category }) => {
  const map: Record<IssueCategory, { label: string; icon: React.ReactNode }> = {
    ACCESSIBILITY: { label: 'A11y', icon: <Accessibility className="w-3.5 h-3.5 text-violet" /> },
    LAYOUT: { label: 'Layout', icon: <LayoutGrid className="w-3.5 h-3.5 text-info" /> },
    CONTENT: { label: 'Content', icon: <FileText className="w-3.5 h-3.5 text-accent" /> },
    INTERACTION: { label: 'Interaction', icon: <MousePointerClick className="w-3.5 h-3.5 text-warning" /> },
    BACKEND_SYMPTOM: { label: 'Backend Symptom', icon: <ServerCrash className="w-3.5 h-3.5 text-danger" /> },
  };

  const item = map[category] || { label: category, icon: <Info className="w-3.5 h-3.5" /> };

  return (
    <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded bg-surface-2 text-text-muted text-xs border border-border">
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};
