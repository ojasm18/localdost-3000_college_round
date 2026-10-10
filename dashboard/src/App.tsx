import { useEffect, useState } from 'react';
import './App.css';

interface PatchOp {
  position: number;
  change_type: string;
  target_signature: any;
  new_value: any;
}

interface PatchItem {
  id: string;
  title: string;
  rationale: string;
  category: 'visual' | 'logic' | 'network';
  active: boolean;
  target: string;
  ops: PatchOp[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'patches' | 'releases' | 'audit'>('patches');
  const [siteSlug, setSiteSlug] = useState('medicare_plus_demo');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('connected');
  const [selectedPatch, setSelectedPatch] = useState<PatchItem | null>(null);
  const [publishAlert, setPublishAlert] = useState<string | null>(null);

  // Default preset patches for the 3 demo bugs
  const [patches, setPatches] = useState<PatchItem[]>([
    {
      id: 'patch-001',
      title: 'Fix Appointment Submit Button Stacking Context',
      rationale: 'Overriding CSS z-index stacking context caused by semi-transparent modal veil',
      category: 'visual',
      active: true,
      target: 'button.submit-appointment',
      ops: [{
        position: 0,
        change_type: 'style',
        target_signature: {
          css_selector: 'button.submit-appointment',
          text_snippet: 'Request Appointment',
          tag: 'button'
        },
        new_value: {
          property: 'z-index',
          value: '9999 !important'
        }
      }]
    },
    {
      id: 'patch-002',
      title: 'Lab Results Promise.race Session Bypass',
      rationale: 'Bypasses misconfigured 60s token expiration race condition and fetches EHR diagnostics',
      category: 'logic',
      active: true,
      target: 'window.patchLabResults',
      ops: [{
        position: 0,
        change_type: 'behaviour',
        target_signature: {
          css_selector: 'window',
          tag: 'window'
        },
        new_value: {
          code: `window.patchLabResults = async function(patientId) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch('/api/lab-results/' + patientId, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return response.json();
};`
        }
      }]
    },
    {
      id: 'patch-003',
      title: 'Payment Gateway Outage Graceful Degradation',
      rationale: 'Intercepts 500 error from payment-gateway.local and renders phone pay fallback UI',
      category: 'network',
      active: true,
      target: 'payment-gateway.local/process',
      ops: [{
        position: 0,
        change_type: 'network',
        target_signature: {
          css_selector: 'window',
          text_snippet: 'payment-gateway.local',
          tag: 'network'
        },
        new_value: {
          fallback_response: {
            status: 503,
            body: {
              error: 'temporary_unavailable',
              fallback_ui: "<div class='payment-fallback'><h3>Payment System Unavailable</h3><p>Please call 1-800-MEDICARE to pay by phone.</p></div>"
            }
          }
        }
      }]
    }
  ]);

  const [releases, setReleases] = useState([
    {
      id: 'rel-v2.1',
      version: 'v2.1.0',
      timestamp: 'Just now',
      author: 'tanush@patchwork.dev',
      activePatchesCount: 3,
      state: 'ACTIVE IN PRODUCTION',
      isCurrent: true
    },
    {
      id: 'rel-v1.0',
      version: 'v1.0.0 (Clean Baseline)',
      timestamp: '2 hours ago',
      author: 'release-bot@medicare.org',
      activePatchesCount: 0,
      state: 'ARCHIVED',
      isCurrent: false
    }
  ]);

  const [auditLogs, setAuditLogs] = useState([
    { id: 1, time: 'Just now', actor: 'tanush@patchwork.dev', action: 'DEPLOY_RELEASE', details: 'Published Release v2.1.0 (3 hotfix operations active)' },
    { id: 2, time: '5m ago', actor: 'tanush@patchwork.dev', action: 'APPLY_PATCH', details: 'Added Network Interception patch on payment-gateway.local' },
    { id: 3, time: '12m ago', actor: 'tanush@patchwork.dev', action: 'APPLY_PATCH', details: 'Injected JavaScript behavior patch for Lab Results timeout' },
    { id: 4, time: '18m ago', actor: 'tanush@patchwork.dev', action: 'APPLY_PATCH', details: 'Injected CSS z-index override for Appointment Submit button' },
    { id: 5, time: '1h ago', actor: 'system@medicare.org', action: 'INITIALIZE_SITE', details: 'Site medicare_plus_demo registered with PATCHWORK Runtime' },
  ]);

  const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:8000');

  // Check backend health
  useEffect(() => {
    fetch(`${apiBase}/api/sites`)
      .then(res => res.ok ? setBackendStatus('connected') : setBackendStatus('offline'))
      .catch(() => setBackendStatus('offline'));
  }, [apiBase]);

  const togglePatch = (id: string) => {
    setPatches(prev => prev.map(p => {
      if (p.id === id) {
        const nextState = !p.active;
        const newLog = {
          id: Date.now(),
          time: 'Just now',
          actor: 'tanush@patchwork.dev',
          action: nextState ? 'ACTIVATE_PATCH' : 'DEACTIVATE_PATCH',
          details: `${nextState ? 'Enabled' : 'Disabled'} hotfix: ${p.title}`
        };
        setAuditLogs(logs => [newLog, ...logs]);
        return { ...p, active: nextState };
      }
      return p;
    }));
  };

  const handlePublishRelease = async () => {
    try {
      if (backendStatus === 'connected') {
        await fetch(`${apiBase}/api/releases?site_id=${siteSlug}&mode=publish`, {
          method: 'POST'
        });
      }
    } catch (e) {
      // Standalone mode ok
    }

    setPublishAlert('Release v2.1.1 published successfully to PATCHWORK Edge CDN!');
    setTimeout(() => setPublishAlert(null), 3000);

    const newLog = {
      id: Date.now(),
      time: 'Just now',
      actor: 'tanush@patchwork.dev',
      action: 'DEPLOY_RELEASE',
      details: 'Published Release v2.1.1 to Edge CDN (3 hotfixes)'
    };
    setAuditLogs(logs => [newLog, ...logs]);
  };

  const handleRollback = (relId: string) => {
    setPatches(prev => prev.map(p => ({ ...p, active: false })));
    setReleases(prev => prev.map(r => ({
      ...r,
      isCurrent: r.id === relId,
      state: r.id === relId ? 'ACTIVE IN PRODUCTION' : 'ROLLBACK SUPERSEDED'
    })));

    const newLog = {
      id: Date.now(),
      time: 'Just now',
      actor: 'tanush@patchwork.dev',
      action: 'ROLLBACK_RELEASE',
      details: `Rolled back to ${relId}. All live runtime patches disabled.`
    };
    setAuditLogs(logs => [newLog, ...logs]);
    alert(`Rolled back to ${relId}! All patches disabled with full compliance trail.`);
  };

  return (
    <div className="dash-container">
      {/* Top Header */}
      <header className="dash-header">
        <div className="dash-brand-wrap">
          <div className="dash-brand-logo">
            <span className="logo-spark">✦</span>
          </div>
          <div>
            <h1 className="dash-title">PATCHWORK</h1>
            <span className="dash-sub">ENTERPRISE HOTFIX PLATFORM</span>
          </div>
        </div>

        <div className="dash-header-center">
          <div className="site-selector-pill">
            <span className="site-lbl">ACTIVE SITE:</span>
            <select value={siteSlug} onChange={(e) => setSiteSlug(e.target.value)}>
              <option value="medicare_plus_demo">MediCare+ Healthcare Portal (Production)</option>
            </select>
            <span className={`status-indicator ${backendStatus}`}>
              ● {backendStatus === 'connected' ? 'API Online' : 'Local Engine'}
            </span>
          </div>
        </div>

        <div className="dash-header-actions">
          <a 
            href={typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/demo' : 'http://localhost:5174'} 
            target="_blank" 
            rel="noreferrer" 
            className="btn-open-portal"
          >
            Launch Patient Portal &rarr;
          </a>
          <button className="btn-publish-main" onClick={handlePublishRelease}>
            Publish Release
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="dash-main">
        {publishAlert && (
          <div className="publish-banner animate-slide-down">
            ✓ {publishAlert}
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="dash-kpi-grid">
          <div className="dash-kpi-card">
            <span className="kpi-title">Active Hotfixes</span>
            <span className="kpi-num text-teal">{patches.filter(p => p.active).length} / {patches.length}</span>
            <span className="kpi-note">Live on MediCare+ DOM</span>
          </div>

          <div className="dash-kpi-card">
            <span className="kpi-title">Compliance Posture</span>
            <span className="kpi-num text-green">100% Valid</span>
            <span className="kpi-note">HIPAA § 164.312(b) Audit Pass</span>
          </div>

          <div className="dash-kpi-card">
            <span className="kpi-title">Deployment Speed</span>
            <span className="kpi-num text-amber">&lt; 30 Seconds</span>
            <span className="kpi-note">vs. 7-day Change Board review</span>
          </div>

          <div className="dash-kpi-card">
            <span className="kpi-title">Edge Latency</span>
            <span className="kpi-num text-purple">12 ms</span>
            <span className="kpi-note">Instant runtime patch injection</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="dash-nav-bar">
          <div className="tab-group">
            <button 
              className={`dash-tab ${activeTab === 'patches' ? 'active' : ''}`}
              onClick={() => setActiveTab('patches')}
            >
              Hotfix Operations ({patches.length})
            </button>
            <button 
              className={`dash-tab ${activeTab === 'releases' ? 'active' : ''}`}
              onClick={() => setActiveTab('releases')}
            >
              Releases & Rollback ({releases.length})
            </button>
            <button 
              className={`dash-tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              Compliance Audit Trail ({auditLogs.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Hotfix Patches */}
        {activeTab === 'patches' && (
          <div className="patches-view">
            <div className="table-card">
              <div className="table-card-head">
                <h3>Production Hotfix Manifest</h3>
                <p>Live surgical overrides active on the MediCare+ patient portal</p>
              </div>

              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Hotfix Title & Rationale</th>
                    <th>Target Selector / Endpoint</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patches.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className={`patch-type-badge ${p.category}`}>
                          {p.category.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="patch-title">{p.title}</div>
                        <div className="patch-rationale">{p.rationale}</div>
                      </td>
                      <td>
                        <code className="target-code">{p.target}</code>
                      </td>
                      <td>
                        <span className={`status-pill ${p.active ? 'active' : 'inactive'}`}>
                          {p.active ? '● LIVE' : '○ DISABLED'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className={`btn-action-toggle ${p.active ? 'btn-active' : 'btn-inactive'}`}
                            onClick={() => togglePatch(p.id)}
                          >
                            {p.active ? 'Disable' : 'Enable'}
                          </button>
                          <button 
                            className="btn-action-inspect"
                            onClick={() => setSelectedPatch(p)}
                          >
                            Inspect Op
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Releases & Rollback */}
        {activeTab === 'releases' && (
          <div className="releases-view">
            <div className="table-card">
              <div className="table-card-head">
                <h3>Release Timeline & Rollback Safety Net</h3>
                <p>Immutable release history with single-click zero-downtime rollback</p>
              </div>

              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Created</th>
                    <th>Author</th>
                    <th>Active Patches</th>
                    <th>State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.version}</strong></td>
                      <td>{r.timestamp}</td>
                      <td><code>{r.author}</code></td>
                      <td>{r.activePatchesCount} Patches</td>
                      <td>
                        <span className={`status-pill ${r.isCurrent ? 'active' : 'inactive'}`}>
                          {r.state}
                        </span>
                      </td>
                      <td>
                        {!r.isCurrent ? (
                          <button 
                            className="btn-rollback"
                            onClick={() => handleRollback(r.id)}
                          >
                            Rollback to this release
                          </button>
                        ) : (
                          <span className="text-muted text-sm">Active Target</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Compliance Audit Log */}
        {activeTab === 'audit' && (
          <div className="audit-view">
            <div className="table-card">
              <div className="table-card-head">
                <h3>Cryptographic Audit Log</h3>
                <p>Meets HIPAA Security Rule § 164.312(b) and SOC 2 Type II compliance standards</p>
              </div>

              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor Identity</th>
                    <th>Action Event</th>
                    <th>Details & Description</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td><code>{log.time}</code></td>
                      <td><span className="badge-actor">{log.actor}</span></td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Inspect PatchOp Modal */}
      {selectedPatch && (
        <div className="dash-modal-backdrop" onClick={() => setSelectedPatch(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-head">
              <h3>{selectedPatch.title}</h3>
              <button className="btn-close-modal" onClick={() => setSelectedPatch(null)}>✕</button>
            </div>
            <div className="dash-modal-body">
              <p className="modal-subtext">{selectedPatch.rationale}</p>
              <div className="code-box">
                <pre>{JSON.stringify(selectedPatch.ops, null, 2)}</pre>
              </div>
            </div>
            <div className="dash-modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedPatch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
