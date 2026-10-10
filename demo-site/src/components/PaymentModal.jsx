import React, { useState } from 'react';
import { processPaymentApi } from '../services/api';
import { IconShield, IconCard, IconCheck, IconAlert } from './Icons';

export default function PaymentModal({ 
  onClose, 
  networkPatchActive = false,
  onTriggerNetworkPatch 
}) {
  const [cardData, setCardData] = useState({
    name: 'Alex Morgan',
    cardNumber: '4242 •••• •••• 4242',
    expiry: '12/28',
    cvv: '891',
    zip: '94107'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fallbackUI, setFallbackUI] = useState(null);

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFallbackUI(null);

    try {
      const res = await processPaymentApi({
        amount: 50.00,
        currency: 'USD',
        patientId: 'PT-8921',
        invoiceId: 'INV-2026-904',
        card: cardData
      });

      if (res.intercepted && res.fallback_ui) {
        setFallbackUI(res.fallback_ui);
        return;
      }

      if (res.success) {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Payment processor failure: Connection to payment-gateway.local timed out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Co-Pay Settlement Gateway</h3>
            <span className="modal-sub">Invoice #INV-2026-904 • Valley Medical Billing</span>
          </div>
          <button className="btn-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="modal-body">
          {/* Fallback View */}
          {fallbackUI ? (
            <div className="payment-fallback-card animate-scale-up">
              <div 
                className="payment-fallback-inner"
                dangerouslySetInnerHTML={{ __html: fallbackUI }} 
              />
              <button className="btn-primary w-full mt-4" onClick={onClose}>
                Acknowledge & Close
              </button>
            </div>
          ) : success ? (
            /* Successful Payment View */
            <div className="payment-success-card animate-scale-up">
              <div className="success-icon-wrap">
                <IconCheck size={28} />
              </div>
              <h3>Payment Completed</h3>
              <p>Receipt dispatched to patient portal email. Transaction Reference: TXN-890214.</p>
              <button className="btn-primary w-full mt-4" onClick={onClose}>
                Return to Billing Ledger
              </button>
            </div>
          ) : (
            /* Standard Payment Form */
            <form onSubmit={handlePayment} className="portal-form">
              <div className="invoice-summary-box">
                <div className="inv-row">
                  <span>Consultation Co-Pay</span>
                  <strong>$50.00</strong>
                </div>
                <div className="inv-row">
                  <span>Insurance Primary</span>
                  <span>Blue Cross Shield PPO (Covered $175.00)</span>
                </div>
                <div className="inv-divider"></div>
                <div className="inv-row total">
                  <span>Patient Responsibility</span>
                  <span className="text-teal font-bold">$50.00</span>
                </div>
              </div>

              {/* Gateway Status */}
              <div className={`gateway-status-pill ${networkPatchActive ? 'status-patched' : 'status-broken'}`}>
                <span>{networkPatchActive ? 'Payment system operational' : 'Gateway Status: Experiencing issues'}</span>
              </div>

              <div className="form-group">
                <label>Cardholder Name</label>
                <input
                  type="text"
                  value={cardData.name}
                  onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Card Number</label>
                <input
                  type="text"
                  value={cardData.cardNumber}
                  onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Expires (MM/YY)</label>
                  <input
                    type="text"
                    value={cardData.expiry}
                    onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Security Code (CVV)</label>
                  <input
                    type="password"
                    value={cardData.cvv}
                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="error-alert-card animate-shake">
                  <div className="err-icon">
                    <IconAlert size={22} />
                  </div>
                  <div className="err-content">
                    <h4>Payment Gateway Blackout (HTTP 500 Timeout)</h4>
                    <p>{error}</p>
                    <p className="err-sub">
                      The third-party payment processor is down. Patients are left stranded without fallback guidance.
                    </p>
                  </div>
                </div>
              )}

              <div className="modal-actions-bar">
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex-center gap-2">
                      <span className="spinner-small"></span> Connecting to payment-gateway.local...
                    </span>
                  ) : (
                    <>
                      <IconCard size={16} /> Authorize Payment ($50.00)
                    </>
                  )}
                </button>
              </div>


            </form>
          )}
        </div>
      </div>
    </div>
  );
}
