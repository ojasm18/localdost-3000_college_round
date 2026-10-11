import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Scan,
  AlertCircle,
  FileCode2,
  GitPullRequest,
  HeartPulse,
  PlayCircle,
  Package,
  History,
  Settings,
  Plus,
  ChevronDown,
  UserCheck,
  Shield,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { useCurrentUser } from '../context/UserContext';
import { api } from '../api';

export const Layout: React.FC = () => {
  const { currentUser, users, switchUserById } = useCurrentUser();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Query overview data for badges and LivePill
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/api/overview'),
    refetchInterval: 5000,
  });

  const site = overview?.site;
  const liveRelease = overview?.liveRelease;
  const openIssuesCount = overview?.issueCount || 0;
  const awaitingReviewCount = overview?.awaitingReview || 0;
  const openConflictsCount = overview?.openConflicts || 0;
  const brokenCount = overview?.brokenPatches || 0;
  const driftedCount = overview?.driftedPatches || 0;

  const roleBadgeColor: Record<string, string> = {
    ADMIN: 'bg-danger-soft text-danger border-danger/30',
    DEVELOPER: 'bg-accent-soft text-accent border-accent/30',
    REVIEWER: 'bg-info-soft text-info border-info/30',
  };

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/scan', label: 'Scanner', icon: Scan },
    {
      to: '/issues',
      label: 'Issues',
      icon: AlertCircle,
      badge: openIssuesCount > 0 ? openIssuesCount : null,
      badgeType: 'info',
    },
    { to: '/editor', label: 'Visual Editor', icon: FileCode2 },
    {
      to: '/patches',
      label: 'Patches',
      icon: GitPullRequest,
      badge: awaitingReviewCount > 0 ? awaitingReviewCount : null,
      badgeType: 'warning',
    },
    {
      to: '/health',
      label: 'Patch Health',
      icon: HeartPulse,
      badge: brokenCount > 0 ? brokenCount : driftedCount > 0 ? driftedCount : null,
      badgeType: brokenCount > 0 ? 'danger' : 'warning',
    },
    { to: '/test-runs', label: 'Test Runs', icon: PlayCircle },
    { to: '/releases', label: 'Releases', icon: Package },
    { to: '/activity', label: 'Activity Trail', icon: History },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  // Breadcrumb path formatter
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumb = pathParts.length === 0 ? 'Overview' : pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-surface-1 border-r border-border flex flex-col justify-between select-none">
        <div>
          {/* Brand header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-text flex items-center gap-2">
                PATCHWORK
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                  MVP
                </span>
              </div>
              <div className="text-[11px] text-text-faint font-mono truncate">
                {site?.name || 'Mission Control'}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-soft text-accent border border-accent/30 font-semibold'
                        : 'text-text-muted hover:text-text hover:bg-surface-2 border border-transparent'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {Boolean(item.badge) && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        item.badgeType === 'danger'
                          ? 'bg-danger text-bg'
                          : item.badgeType === 'warning'
                          ? 'bg-warning text-bg'
                          : 'bg-info-soft text-info border border-info/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Target site indicator */}
        <div className="p-4 border-t border-border bg-surface-1 text-xs">
          <div className="flex items-center justify-between text-text-faint text-[11px] mb-1">
            <span>Target Site</span>
            <span className="text-accent flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block animate-pulse"></span>
              {site?.baseUrl ? 'Connected' : 'Active'}
            </span>
          </div>
          {site?.baseUrl ? (
            <a
              href={site.baseUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-2 rounded bg-surface-2 border border-border text-text-muted hover:text-text text-[11px] font-mono truncate transition-colors"
            >
              <span className="truncate">{site.baseUrl}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 ml-1 opacity-70" />
            </a>
          ) : (
            <div className="flex items-center justify-between p-2 rounded bg-surface-2 border border-border text-text-muted text-[11px] truncate">
              <span className="truncate">{site?.name || 'Production Site'}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-surface-1 border-b border-border px-6 flex items-center justify-between flex-shrink-0 z-20">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-faint">PATCHWORK</span>
            <span className="text-border-strong font-mono">/</span>
            <span className="text-text font-medium">{breadcrumb}</span>
          </div>

          {/* Right Actions: LivePill, UserSwitcher, New Scan */}
          <div className="flex items-center gap-4">
            {/* LivePill */}
            {liveRelease ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                <span className="font-semibold text-accent font-mono">LIVE v{liveRelease.version}</span>
                <span className="text-text-faint font-mono">·</span>
                <span
                  className={`text-xs ${
                    brokenCount > 0
                      ? 'text-danger font-medium'
                      : driftedCount > 0
                      ? 'text-warning font-medium'
                      : 'text-text-muted'
                  }`}
                >
                  {brokenCount > 0 ? `${brokenCount} Broken` : driftedCount > 0 ? `${driftedCount} Drifted` : 'Healthy'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full bg-neutral"></span>
                <span className="font-mono">No Live Release</span>
              </div>
            )}

            {/* User Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-xs transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center text-text-muted text-[10px] font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="font-medium text-text">{currentUser.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                    roleBadgeColor[currentUser.role] || 'bg-surface-3 text-text-muted'
                  }`}
                >
                  {currentUser.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-faint ml-0.5" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-surface-1 border border-border-strong rounded-lg shadow-xl z-40 py-1.5">
                    <div className="px-3 py-1.5 text-[11px] text-text-faint font-medium border-b border-border uppercase tracking-wider">
                      Switch User & Role
                    </div>
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          switchUserById(u.id);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                          u.id === currentUser.id
                            ? 'bg-surface-2 text-text font-medium'
                            : 'text-text-muted hover:bg-surface-2 hover:text-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-surface-3 flex items-center justify-center text-[10px]">
                            {u.name.charAt(0)}
                          </span>
                          <span>{u.name}</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                            roleBadgeColor[u.role]
                          }`}
                        >
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* New Scan CTA Button */}
            <button
              type="button"
              onClick={() => navigate('/scan')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Scan</span>
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
