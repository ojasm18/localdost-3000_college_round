import React, { useState } from 'react';
import PaymentModal from './PaymentModal';
import { IconCard } from './Icons';

export default function Billing({ 
  networkPatchActive = false, 
  onTriggerNetworkPatch 
}) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const bills = [
    {
      id: 'INV-2026-904',
      service: 'General Practice Consultation & Follow-up',
      doctor: 'Dr. Marcus Vance, DO',
      date: '2026-09-28',
      charge: '$225.00',
      insurance: '$175.00',
      balance: '$50.00',
      status: 'Due Now',
      isDue: true
    },
    {
      id: 'INV-2026-881',
      service: 'Brain MRI with & without Contrast (Diagnostic)',
      doctor: 'Dr. Elena Rostova, MD',
      date: '2026-09-14',
      charge: '$1,450.00',
      insurance: '$1,330.00',
      balance: '$120.00',
      status: 'Insurance Pending',
      isDue: false
    },
    {
      id: 'INV-2026-810',
      service: 'Comprehensive Metabolic Panel (Chemistry)',
      doctor: 'Valley Regional Lab',
      date: '2026-08-30',
      charge: '$180.00',
      insurance: '$180.00',
      balance: '$0.00',
      status: 'Paid in Full',
      isDue: false
    }
  ];

  return (
    <div id="billing" className="billing-page animate-fade-in">
      <div className="section-head-card">
        <div className="section-title-wrap">
          <span className="badge-scenario">Scenario: Bug #3 (Third-Party Gateway Outage)</span>
          <h2>Billing, Statements & Co-Pay</h2>
          <p>
            Transparent hospital statements and secure co-pay processing for Valley Regional Medical Center.
            All transactions adhere to PCI-DSS Level 1 compliance.
          </p>
        </div>

        {/* Bug Status Callout */}
        <div className={`bug-status-box ${networkPatchActive ? 'status-patched' : 'status-broken'}`}>
          <div className="bug-status-header">
            <span className="status-dot"></span>
            <strong>
              {networkPatchActive 
                ? 'Patch Active: Network Interception Enforced' 
                : 'Production Failure: Payment Processor 500 Outage'}
            </strong>
          </div>
          <p className="bug-status-desc">
            {networkPatchActive
              ? 'PATCHWORK intercepts requests to "payment-gateway.local", catching 500 timeouts and serving graceful fallback UI.'
              : 'External gateway API "payment-gateway.local" is suffering a total outage. Patients experience hanging spinners and errors.'}
          </p>
          {!networkPatchActive && onTriggerNetworkPatch && (
            <button className="btn-patch-quick" onClick={onTriggerNetworkPatch}>
              Apply Network Interception
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="billing-summary-grid">
        <div className="summary-card highlight">
          <div className="summary-label">Patient Balance Due</div>
          <div className="summary-amount text-teal">$50.00</div>
          <div className="summary-due">Statement due by Oct 28, 2026</div>
          <button 
            className="btn-primary w-full mt-3 pay-now-btn"
            onClick={() => setShowPaymentModal(true)}
          >
            <IconCard size={16} /> Settle Co-Pay ($50.00)
          </button>
        </div>

        <div className="summary-card">
          <div className="summary-label">Adjudication Pending</div>
          <div className="summary-amount">$120.00</div>
          <div className="summary-due">Claim #BCBS-9021-X under carrier review</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Year-to-Date Paid</div>
          <div className="summary-amount">$340.00</div>
          <div className="summary-due">Annual deductible satisfied: $340 / $1,000</div>
        </div>
      </div>

      {/* Invoices Ledger Table */}
      <div className="panel-card mt-6">
        <div className="panel-header">
          <div className="panel-title-group">
            <h3>Itemized Clinical Statements</h3>
            <p>Recent inpatient, outpatient, and diagnostic services</p>
          </div>
        </div>

        <table className="portal-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Description & Service</th>
              <th>Date of Service</th>
              <th>Total Billed</th>
              <th>Insurance Covered</th>
              <th>Patient Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.id}</strong></td>
                <td>
                  <div>{b.service}</div>
                  <small className="text-muted">{b.doctor}</small>
                </td>
                <td>{b.date}</td>
                <td>{b.charge}</td>
                <td className="text-green">{b.insurance}</td>
                <td><strong className={b.isDue ? 'text-red' : ''}>{b.balance}</strong></td>
                <td>
                  <span className={`status-pill ${b.isDue ? 'status-flagged' : b.status === 'Paid in Full' ? 'status-completed' : 'status-pending'}`}>
                    {b.status}
                  </span>
                </td>
                <td>
                  {b.isDue ? (
                    <button 
                      className="btn-sm-primary pay-now-btn"
                      onClick={() => setShowPaymentModal(true)}
                    >
                      Settle Co-Pay
                    </button>
                  ) : (
                    <button className="btn-sm-table" onClick={() => alert('Downloading itemized PDF statement...')}>
                      PDF Statement
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          onClose={() => setShowPaymentModal(false)}
          networkPatchActive={networkPatchActive}
          onTriggerNetworkPatch={onTriggerNetworkPatch}
        />
      )}
    </div>
  );
}
