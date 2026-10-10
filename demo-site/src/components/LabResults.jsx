import React, { useState, useEffect } from 'react';
import { fetchLabResultsApi } from '../services/api';
import { validateSession, getSessionRemainingTime, resetSession } from '../services/auth';
import { IconFlask, IconAlert, IconCheck } from './Icons';

export default function LabResults({ 
  logicPatchActive = false, 
  onTriggerLogicPatch 
}) {
  const [results, setResults] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionRemaining, setSessionRemaining] = useState(getSessionRemainingTime());
  const [patchUsed, setPatchUsed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionRemaining(getSessionRemainingTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFetchResults = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setPatchUsed(false);

    try {
      if (logicPatchActive || window.patchLabResults) {
        console.log('Using behavior override for lab results');
        const patchFn = window.patchLabResults || (async () => {
          return await fetchLabResultsApi('PT-8921');
        });
        const patchedData = await patchFn('PT-8921');
        setResults(patchedData);
        setPatchUsed(true);
        setLoading(false);
        return;
      }

      // Unpatched Promise.race with auth session validation check
      console.log('Executing Promise.race with session validation...');
      
      const [fetchedData] = await Promise.all([
        Promise.race([
          fetchLabResultsApi('PT-8921'),
          new Promise((_, reject) => {
            if (getSessionRemainingTime() <= 0) {
              setTimeout(() => reject(new Error('Session validation failed: HTTP 401 Unauthorized (Token refresh misconfigured)')), 400);
            }
          })
        ]),
        validateSession()
      ]);

      setResults(fetchedData);
    } catch (err) {
      console.error('Lab results fetch error:', err);
      setError(
        err.message.includes('401') || err.message.includes('Session')
          ? 'Session Expired. HTTP 401 Unauthorized: The session token refresh endpoint failed. Please re-authenticate.'
          : err.message || 'Failed to load diagnostic records.'
      );
    } finally {
      setLoading(false);
    }
  };

  const forceExpireSession = () => {
    localStorage.setItem('loginTime', (Date.now() - 70000).toString());
    setSessionRemaining(0);
  };

  return (
    <div id="lab-results" className="lab-results-page animate-fade-in">
      <div className="section-head-card">
        <div className="section-title-wrap">
          <h2>Diagnostic & Laboratory Ledger</h2>
          <p>
            Secure, encrypted access to hematology, chemistry, imaging, and pathology reports.
            Protected under HIPAA Security Rule § 164.312(a).
          </p>
        </div>
      </div>

      {/* Session Timer Indicator Bar */}
      <div className="session-timer-bar">
        <div className="timer-info">
          <span>Active Session Token:</span>
          <strong className={sessionRemaining <= 10 ? 'text-red' : 'text-teal'}>
            {sessionRemaining > 0 ? `${sessionRemaining}s remaining` : 'EXPIRED (0s)'}
          </strong>
        </div>
        <div className="timer-controls">
          <button 
            className="btn-tiny" 
            onClick={() => { resetSession(); setSessionRemaining(60); setError(null); }}
          >
            Reset Session (60s)
          </button>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="results-action-bar">
        <button
          className="btn-primary view-results-btn"
          data-patient-id="PT-8921"
          onClick={handleFetchResults}
          disabled={loading}
        >
          <IconFlask size={16} />
          {loading ? 'Querying EHR Diagnostic Ledger...' : 'Load Diagnostic Records'}
        </button>


      </div>

      {/* Error State Banner */}
      {error && (
        <div className="error-alert-card animate-shake">
          <div className="err-icon">
            <IconAlert size={24} />
          </div>
          <div className="err-content">
            <h4>Authentication Failure (HTTP 401)</h4>
            <p>{error}</p>
            <div className="err-help">
              A routine security update caused session tokens to fail renewal after 60 seconds.
              Patients cannot view their test results despite valid credentials.
            </div>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="loading-state-card">
          <div className="spinner-ring"></div>
          <p>Querying hospital electronic health record (EHR) database...</p>
        </div>
      )}

      {/* Results Table */}
      {results && !loading && (
        <div className="lab-table-card animate-fade-in panel-card">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Test / Procedure</th>
                <th>Category</th>
                <th>Collection Date</th>
                <th>Ordering Physician</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="test-name">{report.test}</div>
                    <div className="test-id">{report.id}</div>
                  </td>
                  <td>{report.category}</td>
                  <td>{report.date}</td>
                  <td>{report.doctor}</td>
                  <td>
                    <span className={`status-pill ${report.flag === 'Attention' ? 'status-flagged' : 'status-completed'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-sm-table"
                      onClick={() => setSelectedReport(report)}
                    >
                      View Biomarkers
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Biomarkers Modal */}
      {selectedReport && (
        <div className="modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{selectedReport.test}</h3>
                <span className="modal-sub">Ordered by {selectedReport.doctor} • {selectedReport.date}</span>
              </div>
              <button className="btn-close" onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="biomarker-table">
                <thead>
                  <tr>
                    <th>Component Marker</th>
                    <th>Result Value</th>
                    <th>Reference Range</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.results.map((b, i) => (
                    <tr key={i}>
                      <td><strong>{b.marker}</strong></td>
                      <td>{b.value}</td>
                      <td>{b.refRange}</td>
                      <td>
                        <span className={`badge-marker ${b.status}`}>
                          {b.status === 'normal' ? 'Normal' : 'High / Attention'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedReport(null)}>Close Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
