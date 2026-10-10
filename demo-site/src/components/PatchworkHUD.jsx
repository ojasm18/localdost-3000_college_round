import React, { useState } from 'react';

export default function PatchworkHUD({
  activePhase,
  setActivePhase,
  visualPatch,
  setVisualPatch,
  logicPatch,
  setLogicPatch,
  networkPatch,
  setNetworkPatch,
  smartHealingDrift,
  setSmartHealingDrift,
  backendConnected,
  onRollbackAll
}) {
  const [minimized, setMinimized] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(null); // 'css' | 'js' | 'network' | 'audit'

  const handleSelectPhase = (phaseNumber) => {
    setActivePhase(phaseNumber);
    switch (phaseNumber) {
      case 1: // The Emergency
        setVisualPatch(false);
        setLogicPatch(false);
        setNetworkPatch(false);
        setSmartHealingDrift(false);
        break;
      case 2: // Visual Patch
        setVisualPatch(true);
        break;
      case 3: // Logic Patch
        setVisualPatch(true);
        setLogicPatch(true);
        break;
      case 4: // Network Interception
        setVisualPatch(true);
        setLogicPatch(true);
        setNetworkPatch(true);
        break;
      case 5: // Smart Healing
        setVisualPatch(true);
        setLogicPatch(true);
        setNetworkPatch(true);
        setSmartHealingDrift(true);
        break;
      case 6: // Rollback
        onRollbackAll();
        break;
      default:
        break;
    }
  };

  const phases = [
    { num: 1, step: '01', title: 'The Emergency', subtitle: '3 Outages Active' },
    { num: 2, step: '02', title: 'Visual Patch', subtitle: 'z-index: 9999 Elevation' },
    { num: 3, step: '03', title: 'Logic Patch', subtitle: 'Promise.race Bypass' },
    { num: 4, step: '04', title: 'Network Fallback', subtitle: '503 Intercept Flow' },
    { num: 5, step: '05', title: 'Smart Healing', subtitle: 'DOM Signature Recovery' },
    { num: 6, step: '06', title: 'Audit Rollback', subtitle: 'Zero-Downtime Revert' },
  ];

  return (
    <div className={`patchwork-hud-container ${minimized ? 'minimized' : ''}`}>
      {/* Header bar */}
      <div className="hud-header">
        <div className="hud-title-wrap">
          <div className="hud-logo-dot"></div>
          <span className="hud-title">PATCHWORK</span>
          <span className="hud-badge">RUNTIME CONTROLLER</span>
          <span className={`hud-conn-badge ${backendConnected ? 'online' : 'simulated'}`}>
            ● {backendConnected ? 'Backend Daemon Live' : 'Standalone Runtime Active'}
          </span>
        </div>

        <div className="hud-actions-wrap">
          <button 
            className="hud-btn-code" 
            onClick={() => setShowCodeModal('audit')}
            title="View Compliance Audit Log"
          >
            Audit Ledger
          </button>
          <button 
            className="hud-toggle-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "Expand Controller" : "Collapse Controller"}
          >
            {minimized ? 'Expand HUD' : 'Minimize'}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="hud-body">
          {/* Phase Stepper */}
          <div className="phase-stepper">
            {phases.map((p) => (
              <button
                key={p.num}
                type="button"
                className={`phase-step-btn ${activePhase === p.num ? 'active' : ''}`}
                onClick={() => handleSelectPhase(p.num)}
              >
                <div className="step-num">Phase {p.step}</div>
                <div className="step-title">{p.title}</div>
                <div className="step-sub">{p.subtitle}</div>
              </button>
            ))}
          </div>

          {/* Quick Toggle Controls & Code Inspect */}
          <div className="hud-controls-grid">
            {/* Bug 1 Toggle */}
            <div className={`hud-patch-pill ${visualPatch ? 'active' : ''}`}>
              <div className="pill-info">
                <strong>Bug 1: Invisible Button</strong>
                <span>CSS Stacking Context (z-index)</span>
              </div>
              <div className="pill-actions">
                <button 
                  className="btn-tiny-code"
                  onClick={() => setShowCodeModal('css')}
                >
                  CSS Op
                </button>
                <button 
                  className={`btn-toggle-switch ${visualPatch ? 'on' : 'off'}`}
                  onClick={() => setVisualPatch(!visualPatch)}
                >
                  {visualPatch ? 'PATCHED' : 'BROKEN'}
                </button>
              </div>
            </div>

            {/* Bug 2 Toggle */}
            <div className={`hud-patch-pill ${logicPatch ? 'active' : ''}`}>
              <div className="pill-info">
                <strong>Bug 2: Lab Results Timeout</strong>
                <span>Promise.race Auth Expiry (401)</span>
              </div>
              <div className="pill-actions">
                <button 
                  className="btn-tiny-code"
                  onClick={() => setShowCodeModal('js')}
                >
                  JS Op
                </button>
                <button 
                  className={`btn-toggle-switch ${logicPatch ? 'on' : 'off'}`}
                  onClick={() => setLogicPatch(!logicPatch)}
                >
                  {logicPatch ? 'PATCHED' : 'BROKEN'}
                </button>
              </div>
            </div>

            {/* Bug 3 Toggle */}
            <div className={`hud-patch-pill ${networkPatch ? 'active' : ''}`}>
              <div className="pill-info">
                <strong>Bug 3: Payment Outage</strong>
                <span>Gateway 500 Outage Interception</span>
              </div>
              <div className="pill-actions">
                <button 
                  className="btn-tiny-code"
                  onClick={() => setShowCodeModal('network')}
                >
                  JSON Op
                </button>
                <button 
                  className={`btn-toggle-switch ${networkPatch ? 'on' : 'off'}`}
                  onClick={() => setNetworkPatch(!networkPatch)}
                >
                  {networkPatch ? 'PATCHED' : 'BROKEN'}
                </button>
              </div>
            </div>

            {/* Smart Healing & Drift Simulator */}
            <div className={`hud-patch-pill ${smartHealingDrift ? 'drifted' : ''}`}>
              <div className="pill-info">
                <strong>Smart Element Tracking</strong>
                <span>
                  {smartHealingDrift 
                    ? 'Drift active: .submit-appointment -> .appointment-submit' 
                    : 'Heuristic selector resilience'}
                </span>
              </div>
              <div className="pill-actions">
                {smartHealingDrift && (
                  <span className="badge-confidence">92% Match</span>
                )}
                <button 
                  className={`btn-toggle-switch ${smartHealingDrift ? 'drift-on' : 'off'}`}
                  onClick={() => setSmartHealingDrift(!smartHealingDrift)}
                >
                  {smartHealingDrift ? 'HEALED' : 'SIM DRIFT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Inspection Modal */}
      {showCodeModal && (
        <div className="modal-backdrop" onClick={() => setShowCodeModal(null)}>
          <div className="modal-dialog modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>
                {showCodeModal === 'css' && 'Visual Patch: CSS Stacking Override'}
                {showCodeModal === 'js' && 'Behavior Patch: JavaScript Override'}
                {showCodeModal === 'network' && 'Network Interception Schema'}
                {showCodeModal === 'audit' && 'PATCHWORK Compliance Audit Trail'}
              </h3>
              <button className="btn-close" onClick={() => setShowCodeModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {showCodeModal === 'css' && (
                <div className="code-block">
                  <pre>{`/* PATCHWORK PatchOp #001 */
{
  "change_type": "style",
  "target_signature": {
    "text_snippet": "Request Appointment",
    "parent_chain": ["form", "modal-content", "modal"],
    "tag": "button"
  },
  "new_value": {
    "property": "z-index",
    "value": "9999 !important"
  }
}

/* Injected Runtime CSS: */
button.submit-appointment,
button.appointment-submit {
  z-index: 9999 !important;
  pointer-events: auto !important;
}`}</pre>
                </div>
              )}

              {showCodeModal === 'js' && (
                <div className="code-block">
                  <pre>{`/* PATCHWORK PatchOp #002 */
{
  "change_type": "behaviour",
  "rationale": "Bypass broken Promise.race session validation check",
  "new_value": {
    "code": \`
      window.patchLabResults = async function(patientId) {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/lab-results/\${patientId}', {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        return response.json();
      };
    \`
  }
}`}</pre>
                </div>
              )}

              {showCodeModal === 'network' && (
                <div className="code-block">
                  <pre>{`/* PATCHWORK PatchOp #003 */
{
  "match_pattern": "*://payment-gateway.local/*",
  "on_intercept": "fallback",
  "fallback_response": {
    "status": 503,
    "body": {
      "error": "temporary_unavailable",
      "message": "Payment system under maintenance",
      "fallback_ui": "<div class='payment-fallback'><h3>Payment System Unavailable</h3><p>Our payment system is temporarily unavailable. Your services will not be interrupted. Please call 1-800-MEDICARE to pay by phone.</p></div>"
    }
  }
}`}</pre>
                </div>
              )}

              {showCodeModal === 'audit' && (
                <div className="audit-timeline-list">
                  <div className="audit-entry">
                    <span className="audit-time">10:14:02 UTC</span>
                    <span className="audit-user">secops@hospital.org</span>
                    <span className="audit-action">Release v2.1.0 published (3 hotfixes active)</span>
                  </div>
                  <div className="audit-entry">
                    <span className="audit-time">10:12:45 UTC</span>
                    <span className="audit-user">tanush@patchwork.dev</span>
                    <span className="audit-action">Smart Element Healing re-bound target: .appointment-submit (92% confidence)</span>
                  </div>
                  <div className="audit-entry">
                    <span className="audit-time">10:08:19 UTC</span>
                    <span className="audit-user">tanush@patchwork.dev</span>
                    <span className="audit-action">Injected Network Interception rule on *://payment-gateway.local/*</span>
                  </div>
                  <div className="audit-entry">
                    <span className="audit-time">10:05:00 UTC</span>
                    <span className="audit-user">tanush@patchwork.dev</span>
                    <span className="audit-action">Injected CSS visual patch (z-index: 9999) on #appointment-submit-button</span>
                  </div>
                  <div className="audit-entry info">
                    <small>Cryptographically signed SHA-256 ledger • Meets HIPAA § 164.312(b) Audit Controls</small>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCodeModal(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
