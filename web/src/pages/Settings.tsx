import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Copy,
  Check,
  RotateCcw,
  Server,
  Code2,
  ExternalLink,
  Save,
} from 'lucide-react';
import { api } from '../api';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Query site configuration
  const { data: site } = useQuery({
    queryKey: ['site'],
    queryFn: () => api.get('/api/site'),
  });

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [siteKey, setSiteKey] = useState('');

  useEffect(() => {
    if (site) {
      setName(site.name || '');
      setBaseUrl(site.baseUrl || '');
      setSiteKey(site.siteKey || 'default-site');
    }
  }, [site]);

  // Update site configuration mutation
  const updateSiteSettings = useMutation({
    mutationFn: (data: { name?: string; baseUrl?: string; siteKey?: string; autoRollback?: boolean }) =>
      api.post('/api/site/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const activeKey = siteKey || site?.siteKey || 'default-site';
  const serverOrigin = window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : window.location.origin;
  const snippet = `<script src="${serverOrigin}/runtime/patchwork.js" data-site-key="${activeKey}"></script>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleSaveSite = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings.mutate({
      name,
      baseUrl,
      siteKey: activeKey,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="pb-2 border-b border-border">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-accent" />
          Settings & Runtime Configuration
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Configure target site identity, client injection snippet, and automated rollback gates.
        </p>
      </div>

      {/* Target Site Details (Editable) */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <Server className="w-4 h-4 text-accent" />
            Target Site Configuration
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Configure the name, primary URL, and identifier for the site monitored by PATCHWORK.
          </p>
        </div>

        <form onSubmit={handleSaveSite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-text-faint uppercase block mb-1">
                Site Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Web App"
                className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-text-faint uppercase block mb-1">
                Site Key
              </label>
              <input
                type="text"
                value={siteKey}
                onChange={(e) => setSiteKey(e.target.value)}
                placeholder="e.g. production-site"
                className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-xs font-mono text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-faint uppercase block mb-1">
              Target Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. https://yourdomain.com or http://localhost:3000"
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-xs font-mono text-text focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {baseUrl ? (
              <a
                href={baseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-text-muted hover:text-accent flex items-center gap-1 font-mono transition-colors"
              >
                <span>Visit Target URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : <span className="text-xs text-text-faint">No target URL saved yet</span>}

            <button
              type="submit"
              disabled={updateSiteSettings.isPending}
              className="px-4 py-2 rounded bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Site Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Snippet Card */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent" />
            Client Injection Snippet
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Add this single script tag to the &lt;head&gt; of your website. It executes in &lt;1ms and downloads
            the cached patch bundle for the active live release.
          </p>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-md bg-bg border border-border text-xs font-mono text-accent overflow-x-auto selection:bg-accent selection:text-bg">
            {snippet}
          </pre>
          <button
            onClick={handleCopySnippet}
            className="absolute top-3 right-3 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text flex items-center gap-1.5 transition-colors"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Automatic Rollback Setting */}
      <div className="p-6 rounded-lg bg-surface-1 border border-border space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-warning" />
              Automatic Post-Deploy Rollback
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xl">
              When enabled, a background smoke verification flow runs against the live target page immediately after
              deployment. If new 500 responses or runtime exceptions occur, the live release is instantly and
              automatically rolled back to the parent version.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={!!site?.autoRollback}
              onChange={(e) => updateSiteSettings.mutate({ autoRollback: e.target.checked })}
              disabled={updateSiteSettings.isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>
      </div>
    </div>
  );
};
