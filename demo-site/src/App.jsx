import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AppointmentForm from './components/AppointmentForm';
import LabResults from './components/LabResults';
import Billing from './components/Billing';
import Messages from './components/Messages';
import { initAuth, resetSession, getSessionRemainingTime } from './services/auth';
import { fetchLabResultsApi } from './services/api';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [activePhase, setActivePhase] = useState(1); // 1 to 6 per DEMO_README

  // Patch States
  const [visualPatch, setVisualPatch] = useState(false);
  const [logicPatch, setLogicPatch] = useState(false);
  const [networkPatch, setNetworkPatch] = useState(false);
  const [smartHealingDrift, setSmartHealingDrift] = useState(false);

  const [backendConnected, setBackendConnected] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  // Initialize Auth on mount
  useEffect(() => {
    initAuth();

    // Check if backend is alive
    fetch('http://localhost:8000/api/sites/medicare_plus_demo')
      .then(res => {
        if (res.ok) setBackendConnected(true);
      })
      .catch(() => setBackendConnected(false));

    // Listen for custom runtime events
    const handleSmartHeal = (e) => {
      console.log('[App] Received smart healing event:', e.detail);
    };
    window.addEventListener('patchwork:smart-healed', handleSmartHeal);
    return () => window.removeEventListener('patchwork:smart-healed', handleSmartHeal);
  }, []);

  // Update session timer
  useEffect(() => {
    const t = setInterval(() => {
      setRemainingSeconds(getSessionRemainingTime());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Effect: Manage Visual Patch (CSS Override)
  useEffect(() => {
    const existingStyle = document.getElementById('patchwork-visual-override');
    if (visualPatch) {
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'patchwork-visual-override';
        style.innerHTML = `
          button.submit-appointment,
          button.appointment-submit {
            z-index: 9999 !important;
            position: relative !important;
            pointer-events: auto !important;
          }
          .loading-veil {
            pointer-events: none !important;
            opacity: 0.1 !important;
          }
        `;
        document.head.appendChild(style);
        console.log('[PATCHWORK] Visual Patch injected: z-index: 9999 !important');
      }
    } else {
      if (existingStyle) {
        existingStyle.remove();
        console.log('[PATCHWORK] Visual Patch removed.');
      }
    }
  }, [visualPatch]);

  // Effect: Manage Logic Patch (Behavior Override)
  useEffect(() => {
    if (logicPatch) {
      window.patchLabResults = async function(patientId) {
        console.log('[PATCHWORK JS Override] Directly fetching lab results with authenticated token...');
        return await fetchLabResultsApi(patientId);
      };
      console.log('[PATCHWORK] Behavior Patch injected: window.patchLabResults bound.');
    } else {
      window.patchLabResults = null;
      console.log('[PATCHWORK] Behavior Patch detached.');
    }
  }, [logicPatch]);

  // Effect: Manage Network Patch (Interception Fallback)
  useEffect(() => {
    const originalFetch = window.__originalFetch || window.fetch.bind(window);
    if (!window.__originalFetch) {
      window.__originalFetch = originalFetch;
    }

    if (networkPatch) {
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || args[0]?.toString() || '');
        if (url.includes('payment-gateway.local')) {
          console.log('[PATCHWORK Network Intercept] Intercepted payment gateway call. Serving 503 fallback UI.');
          return new Response(JSON.stringify({
            error: 'temporary_unavailable',
            message: 'Payment system under maintenance',
            fallback_ui: `
              <div class='payment-fallback'>
                <div style="font-size:2rem;margin-bottom:0.5rem;">⚠️</div>
                <h3 style="margin-bottom:0.5rem;color:#0F172A;font-weight:700;">Payment System Temporarily Unavailable</h3>
                <p style="color:#475569;margin-bottom:1rem;line-height:1.5;">
                  Our third-party payment partner is currently undergoing emergency maintenance. 
                  <strong>Your medical care will not be interrupted</strong>, and no late fees will be assessed.
                </p>
                <div style="background:#F1F5F9;padding:0.75rem;border-radius:8px;font-size:0.9rem;color:#0F172A;">
                  To make an immediate co-pay by phone, call our 24/7 billing line: <br/>
                  <strong style="color:#0F766E;font-size:1.1rem;">1-800-MEDICARE</strong> (1-800-633-4227)
                </div>
              </div>
            `
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(...args);
      };
      console.log('[PATCHWORK] Network Interception Rule active for payment-gateway.local.');
    } else {
      window.fetch = originalFetch;
      console.log('[PATCHWORK] Network Interception deactivated.');
    }
  }, [networkPatch]);

  // Rollback Action
  const handleRollbackAll = () => {
    setVisualPatch(false);
    setLogicPatch(false);
    setNetworkPatch(false);
    setSmartHealingDrift(false);
    setActivePhase(6);
    console.log('[PATCHWORK] Rolled back all active patches to v1.0.0 clean production baseline.');
  };

  const handleResetSession = () => {
    resetSession();
    setRemainingSeconds(60);
  };

  return (
    <div className="portal-container">
      {/* Top Hospital Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetSession={handleResetSession}
        remainingSeconds={remainingSeconds}
      />

      {/* Main Content Area */}
      <main className="portal-content">
        {activeTab === 'Dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'Appointments' && (
          <AppointmentForm
            visualPatchActive={visualPatch}
            smartHealingDrift={smartHealingDrift}
            onTriggerVisualPatch={() => { setVisualPatch(true); setActivePhase(2); }}
          />
        )}

        {activeTab === 'Lab Results' && (
          <LabResults
            logicPatchActive={logicPatch}
            onTriggerLogicPatch={() => { setLogicPatch(true); setActivePhase(3); }}
          />
        )}

        {activeTab === 'Messages' && (
          <Messages />
        )}

        {activeTab === 'Billing' && (
          <Billing
            networkPatchActive={networkPatch}
            onTriggerNetworkPatch={() => { setNetworkPatch(true); setActivePhase(4); }}
          />
        )}
      </main>

      {/* Hospital Footer */}
      <footer className="portal-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span>© 2026 Valley Regional Hospital Network. All rights reserved.</span>
            <span className="footer-pipe">|</span>
            <span>FDA Class I Device Compliance Registered</span>
            <span className="footer-pipe">|</span>
            <span>HIPAA HITECH Certified</span>
          </div>
          <div className="footer-right">
          </div>
        </div>
      </footer>


    </div>
  );
}
