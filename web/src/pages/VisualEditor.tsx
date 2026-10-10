import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileCode2,
  MousePointer,
  Save,
  Check,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Type,
  Palette,
  Tag,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Globe,
  ArrowRight,
  Crosshair,
} from 'lucide-react';
import { api } from '../api';
import { useCurrentUser } from '../context/UserContext';
import type { PatchOperation } from '../../../shared/types';

// Build the proxy URL so the iframe loads through our server
function proxyUrl(url: string): string {
  if (!url) return 'about:blank';
  return `/api/proxy/html?url=${encodeURIComponent(url)}`;
}

// Convert rgb(r,g,b) to hex
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export const VisualEditor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: site } = useQuery({
    queryKey: ['site'],
    queryFn: () => api.get('/api/site'),
  });

  const { data: scans } = useQuery({
    queryKey: ['scans'],
    queryFn: () => api.get('/api/scans'),
  });

  const issueId = searchParams.get('issueId');
  const { data: issue } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => api.get(`/api/issues/${issueId}`),
    enabled: !!issueId,
  });

  // URL handling: search param > issue > localStorage > site.baseUrl > recent scan
  const paramUrl = searchParams.get('url') || '';
  const getInitialUrl = () => {
    if (paramUrl) return paramUrl;
    const saved = localStorage.getItem('patchwork_active_url');
    if (saved) return saved;
    return '';
  };

  const [urlInput, setUrlInput] = useState(getInitialUrl);
  const [activeUrl, setActiveUrl] = useState(getInitialUrl);

  // Sync candidate whenever site, issue, or scans load
  useEffect(() => {
    if (issue?.pageUrl) {
      setUrlInput(issue.pageUrl);
      setActiveUrl(issue.pageUrl);
      if (issue.selector) {
        setSelectedSelector(issue.selector);
      }
      if (issue.title) {
        setPatchTitle(`Fix: ${issue.title}`);
      }
      localStorage.setItem('patchwork_active_url', issue.pageUrl);
      return;
    }

    if (!activeUrl) {
      const candidate =
        paramUrl ||
        localStorage.getItem('patchwork_active_url') ||
        site?.baseUrl ||
        (scans && scans.length > 0 ? scans[0].url : '');

      if (candidate) {
        setUrlInput(candidate);
        setActiveUrl(candidate);
        localStorage.setItem('patchwork_active_url', candidate);
      }
    }
  }, [issue, site?.baseUrl, scans, paramUrl]);

  const handleLoadUrl = (target?: string) => {
    const raw = (target || urlInput).trim();
    if (!raw) return;
    const final = raw.match(/^https?:\/\//) ? raw : `https://${raw}`;
    setUrlInput(final);
    setActiveUrl(final);
    localStorage.setItem('patchwork_active_url', final);
    api.post('/api/site/settings', { baseUrl: final }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['site'] });
  };

  // Element picker state
  const [isPicking, setIsPicking] = useState(false);
  const [pickedElement, setPickedElement] = useState<any>(null);

  // Form state for the patch
  const [selectedSelector, setSelectedSelector] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [textVal, setTextVal] = useState('');
  const [colorVal, setColorVal] = useState('#ffffff');
  const [bgVal, setBgVal] = useState('#2DD4A8');
  const [fontSizeVal, setFontSizeVal] = useState('16px');
  const [displayVal, setDisplayVal] = useState('inline-block');
  const [removeDisabled, setRemoveDisabled] = useState(false);
  const [ariaLabelVal, setAriaLabelVal] = useState('');
  const [patchTitle, setPatchTitle] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Listen for postMessage from the picker script injected by the proxy
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'WORKPATCH_ELEMENT_PICKED') return;

      const d = event.data;
      setPickedElement(d);
      setSelectedSelector(d.selector || '');
      setSelectedTag(d.tag || '');
      setTextVal(d.text || '');
      setAriaLabelVal(d.attributes?.['aria-label'] || '');
      setRemoveDisabled(!!d.attributes?.disabled);

      // Populate style from computed
      if (d.computedStyle) {
        const cs = d.computedStyle;
        setColorVal(rgbToHex(cs.color || '#ffffff'));
        setBgVal(rgbToHex(cs.backgroundColor || '#2DD4A8'));
        setFontSizeVal(cs.fontSize || '16px');
        setDisplayVal(cs.display || 'inline-block');
      }

      setPatchTitle(`Update ${(d.tag || 'element').toLowerCase()} styling`);
      setIsPicking(false);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Toggle picker in iframe
  const togglePicker = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    if (isPicking) {
      iframe.contentWindow.postMessage({ type: 'WORKPATCH_PICK_STOP' }, '*');
      setIsPicking(false);
    } else {
      iframe.contentWindow.postMessage({ type: 'WORKPATCH_PICK_START' }, '*');
      setIsPicking(true);
    }
  }, [isPicking]);

  // Risk score
  let calculatedRiskScore = 15;
  const riskReasons: string[] = [];
  if (selectedSelector) {
    riskReasons.push('Modifies target element');
  }
  if (removeDisabled) {
    calculatedRiskScore += 10;
    riskReasons.push('Removes disabled attribute');
  }
  if (bgVal) {
    calculatedRiskScore += 5;
    riskReasons.push('Overrides background color');
  }
  if (!riskReasons.length) riskReasons.push('No changes configured');

  const riskLevel = calculatedRiskScore > 60 ? 'HIGH' : calculatedRiskScore > 30 ? 'MEDIUM' : 'LOW';

  // Save patch mutation
  const savePatchMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/patches', payload),
    onSuccess: (data) => {
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setTimeout(() => {
        navigate(`/patches/${data.id}`);
      }, 800);
    },
  });

  const handleSave = () => {
    if (!selectedSelector) return;

    const operations: PatchOperation[] = [];

    const properties: Record<string, string> = {};
    if (bgVal) properties['background-color'] = bgVal;
    if (colorVal) properties['color'] = colorVal;
    if (fontSizeVal) properties['font-size'] = fontSizeVal;
    if (displayVal) properties['display'] = displayVal;

    if (Object.keys(properties).length > 0) {
      operations.push({ op: 'SET_STYLE', properties, important: true });
    }

    if (removeDisabled) {
      operations.push({ op: 'REMOVE_ATTRIBUTE', name: 'disabled' });
    }
    if (ariaLabelVal) {
      operations.push({ op: 'SET_ATTRIBUTE', name: 'aria-label', value: ariaLabelVal });
    }
    if (textVal) {
      operations.push({ op: 'SET_TEXT', value: textVal });
    }

    const payload = {
      title: patchTitle || 'Custom Editor Patch',
      description: `Visual editor patch targeting ${selectedSelector}`,
      source: 'MANUAL_EDITOR',
      authorId: currentUser.id,
      targetPageUrlPattern: activeUrl,
      targetSelector: selectedSelector,
      fingerprint: {
        cssSelector: selectedSelector,
        domPath: `body > ${selectedSelector}`,
        tag: selectedTag.toLowerCase(),
        classes: pickedElement?.classes || [],
        attributes: pickedElement?.attributes || {},
        textContent: textVal,
        nearbyText: [],
        ancestors: [{ tag: 'body' }],
        rect: pickedElement?.rect || { x: 0, y: 0, width: 0, height: 0 },
      },
      operations,
    };

    savePatchMutation.mutate(payload);
  };

  // ─── Empty state: no URL loaded yet ───
  if (!activeUrl) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
            <Globe className="w-10 h-10 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text mb-2">Visual Editor</h1>
            <p className="text-sm text-text-muted leading-relaxed">
              Enter a URL to load a live preview. You can pick elements, modify their styles and attributes,
              and save the changes as an approved patch.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
              placeholder="https://example.com"
              className="flex-1 px-4 py-2.5 rounded-lg bg-surface-2 border border-border font-mono text-sm text-text outline-none focus:border-accent transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleLoadUrl()}
              disabled={!urlInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-sm shadow-sm transition-colors disabled:opacity-40"
            >
              <ArrowRight className="w-4 h-4" />
              Load
            </button>
          </div>

          {/* Quick links to previously scanned sites */}
          {scans && scans.length > 0 && (
            <div className="space-y-2 w-full pt-2">
              <span className="text-[11px] uppercase font-semibold text-text-faint tracking-wider block text-left">
                Or load a previously scanned site:
              </span>
              <div className="flex flex-col gap-1.5 w-full">
                {Array.from(new Set(scans.map((s: any) => s.url))).slice(0, 5).map((u: any) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleLoadUrl(u)}
                    className="px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-xs font-mono text-text hover:text-accent flex items-center justify-between gap-2 transition-colors group"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Globe className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <span className="truncate">{u}</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-text-faint group-hover:text-accent flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {site?.baseUrl && (!scans || scans.length === 0) && (
            <button
              type="button"
              onClick={() => handleLoadUrl(site.baseUrl)}
              className="text-xs text-accent hover:underline cursor-pointer"
            >
              Load configured site: {site.baseUrl}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Main editor view ───
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 max-w-7xl mx-auto">
      {/* Editor Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface-1 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-accent/15 text-accent border border-accent/30">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text">Live Visual Editor</h1>
            <p className="text-xs text-text-muted">
              Select elements on the target page, modify styles/attributes, and package as an approved patch.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick select previously scanned sites */}
          {scans && scans.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={activeUrl}
                onChange={(e) => handleLoadUrl(e.target.value)}
                className="px-2.5 py-1.5 rounded-md bg-surface-2 border border-border font-mono text-xs text-text outline-none max-w-[170px] truncate"
                title="Switch to previously scanned site"
              >
                <option value="" disabled>Switch scanned site...</option>
                {Array.from(new Set(scans.map((s: any) => s.url))).map((u: any) => (
                  <option key={u} value={u}>
                    {u.replace(/^https?:\/\//, '')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target URL input */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
              className="px-3 py-1.5 rounded-md bg-surface-2 border border-border font-mono text-xs text-text outline-none w-56 sm:w-64"
            />
            {urlInput !== activeUrl && (
              <button
                type="button"
                onClick={() => handleLoadUrl()}
                className="px-2 py-1.5 rounded-md bg-accent/20 text-accent text-xs font-semibold hover:bg-accent/30 transition-colors"
              >
                Go
              </button>
            )}
          </div>

          {/* Pick element button */}
          <button
            type="button"
            onClick={togglePicker}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              isPicking
                ? 'bg-accent text-accent-fg border-accent'
                : 'bg-surface-2 hover:bg-surface-3 text-text border-border'
            }`}
          >
            {isPicking ? (
              <Crosshair className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <MousePointer className="w-3.5 h-3.5" />
            )}
            <span>{isPicking ? 'Click an element...' : 'Pick Element'}</span>
          </button>

          {/* Save Draft Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={savePatchMutation.isPending || !selectedSelector}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-accent text-accent-fg hover:bg-accent-hover font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            {savePatchMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? 'Saved!' : 'Save as Draft Patch'}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Iframe Preview, Right Properties Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left: Interactive Preview Frame (2 cols) */}
        <div className="lg:col-span-2 rounded-lg bg-surface-1 border border-border flex flex-col overflow-hidden">
          <div className="h-9 px-4 bg-surface-2 border-b border-border flex items-center justify-between text-xs text-text-faint">
            <span className="font-mono text-[11px] truncate">{activeUrl}</span>
            <span className="flex items-center gap-1 text-accent font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              {isPicking ? 'Picking...' : 'Live Sandbox'}
            </span>
          </div>

          <div className="flex-1 bg-white relative">
            <iframe
              ref={iframeRef}
              src={proxyUrl(activeUrl)}
              title="Visual Editor Preview"
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
        </div>

        {/* Right: Inspector and Controls Panel (1 col) */}
        <div className="rounded-lg bg-surface-1 border border-border flex flex-col overflow-y-auto p-5 space-y-6">
          {/* Picked element info banner */}
          {pickedElement ? (
            <div className="p-3 rounded-md bg-accent/10 border border-accent/20 text-xs text-text space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-accent">
                <Check className="w-3.5 h-3.5" />
                Element selected
              </div>
              <div className="font-mono text-[11px] text-text-muted break-all">
                &lt;{pickedElement.tag?.toLowerCase()}&gt; — {pickedElement.text?.substring(0, 60) || '(no text)'}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-surface-2 border border-border text-xs text-text-muted flex items-center gap-2">
              <MousePointer className="w-3.5 h-3.5 text-text-faint" />
              Click "Pick Element" then click on the page to select a target.
            </div>
          )}

          {/* Target Element Summary */}
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-accent" />
              Target Element
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-text-faint block mb-1">CSS Selector</label>
                <input
                  type="text"
                  value={selectedSelector}
                  onChange={(e) => setSelectedSelector(e.target.value)}
                  placeholder="Pick an element or type a selector..."
                  className="w-full px-2.5 py-1.5 rounded bg-surface-2 border border-border font-mono text-xs text-text outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-faint block mb-1">Patch Title</label>
                <input
                  type="text"
                  value={patchTitle}
                  onChange={(e) => setPatchTitle(e.target.value)}
                  placeholder="Describe this patch..."
                  className="w-full px-2.5 py-1.5 rounded bg-surface-2 border border-border text-xs text-text outline-none"
                />
              </div>
            </div>
          </div>

          {/* Style Controls */}
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-violet" />
              Style Overrides
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-text-faint block mb-1">Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgVal}
                    onChange={(e) => setBgVal(e.target.value)}
                    className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bgVal}
                    onChange={(e) => setBgVal(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-surface-2 border border-border font-mono text-xs text-text"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-text-faint block mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorVal}
                    onChange={(e) => setColorVal(e.target.value)}
                    className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={colorVal}
                    onChange={(e) => setColorVal(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-surface-2 border border-border font-mono text-xs text-text"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-text-faint block mb-1">Font Size</label>
                <input
                  type="text"
                  value={fontSizeVal}
                  onChange={(e) => setFontSizeVal(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-surface-2 border border-border font-mono text-xs text-text"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-faint block mb-1">Display</label>
                <select
                  value={displayVal}
                  onChange={(e) => setDisplayVal(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-surface-2 border border-border text-xs text-text"
                >
                  <option value="inline-block">inline-block</option>
                  <option value="block">block</option>
                  <option value="flex">flex</option>
                  <option value="none">none (Hide)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-info" />
              Text Content
            </h3>
            <input
              type="text"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              placeholder="Inner text..."
              className="w-full px-2.5 py-1.5 rounded bg-surface-2 border border-border text-xs text-text outline-none"
            />
          </div>

          {/* Attributes */}
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-warning" />
              Attributes & States
            </h3>
            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeDisabled}
                  onChange={(e) => setRemoveDisabled(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-text font-medium">Remove 'disabled' attribute</span>
              </label>

              <div>
                <label className="text-[11px] text-text-faint block mb-1">aria-label</label>
                <input
                  type="text"
                  value={ariaLabelVal}
                  onChange={(e) => setAriaLabelVal(e.target.value)}
                  placeholder="Accessible label"
                  className="w-full px-2.5 py-1 rounded bg-surface-2 border border-border text-xs text-text"
                />
              </div>
            </div>
          </div>

          {/* Live Risk Meter */}
          <div className="p-3.5 rounded-md bg-surface-2 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text flex items-center gap-1.5">
                {riskLevel === 'LOW' ? (
                  <ShieldCheck className="w-4 h-4 text-accent" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-warning" />
                )}
                Live Risk Score
              </span>
              <span className="font-mono font-bold text-accent">{calculatedRiskScore}/100</span>
            </div>

            <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  riskLevel === 'HIGH' ? 'bg-danger' : riskLevel === 'MEDIUM' ? 'bg-warning' : 'bg-accent'
                }`}
                style={{ width: `${calculatedRiskScore}%` }}
              />
            </div>

            <div className="text-[10px] text-text-faint pt-1">
              {riskReasons.join(' • ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
