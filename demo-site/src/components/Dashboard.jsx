import React from 'react';
import { 
  IconCalendar, 
  IconFlask, 
  IconCard, 
  IconChat, 
  IconHeart, 
  IconActivity, 
  IconDroplet, 
  IconPill, 
  IconArrowRight 
} from './Icons';

export default function Dashboard({ setActiveTab }) {
  return (
    <div className="dashboard-view animate-fade-in">
      {/* Patient Welcome Banner */}
      <div className="patient-banner">
        <div className="banner-left">
          <div className="badge-pill">Patient Health Record</div>
          <h1 className="banner-heading">
            Good afternoon, Alex — <em>Your care plan in focus</em>
          </h1>
          <p className="banner-subtext">
            Coordinated care through Valley Regional Health Network. Your primary physician is{' '}
            <strong>Dr. Marcus Vance, DO</strong>. You have one upcoming cardiovascular consultation and one pending co-pay statement.
          </p>
          <div className="banner-quick-actions">
            <button className="btn-primary" onClick={() => setActiveTab('Appointments')}>
              <IconCalendar size={16} /> Schedule Visit
            </button>
            <button className="btn-secondary" onClick={() => setActiveTab('Billing')}>
              <IconCard size={16} /> Settle Co-Pay
            </button>
            <button className="btn-outline" onClick={() => setActiveTab('Lab Results')}>
              <IconFlask size={16} /> Diagnostic Ledger
            </button>
          </div>
        </div>

        <div className="banner-right">
          <div className="card-editorial-tile">
            <div className="editorial-tile-tag">Next Clinical Visit</div>
            <div className="editorial-tile-date">Friday, Oct 17</div>
            <div className="editorial-tile-detail">10:30 AM • Comprehensive Cardiology</div>
            <div className="editorial-tile-physician">Dr. Sarah Chen, MD — Pavilion B, Suite 402</div>
          </div>
        </div>
      </div>

      {/* Bento Metric Cards */}
      <div className="bento-kpi-grid">
        <div className="bento-card bento-blue" onClick={() => setActiveTab('Appointments')}>
          <div className="bento-top-row">
            <span className="bento-label">Upcoming Visits</span>
            <span className="bento-arrow-badge"><IconArrowRight size={13} /></span>
          </div>
          <div className="bento-metric">1</div>
          <div className="bento-detail">Cardiology follow-up • Oct 17</div>
        </div>

        <div className="bento-card bento-amber" onClick={() => setActiveTab('Lab Results')}>
          <div className="bento-top-row">
            <span className="bento-label">Diagnostic Records</span>
            <span className="bento-arrow-badge"><IconArrowRight size={13} /></span>
          </div>
          <div className="bento-metric">4</div>
          <div className="bento-detail">1 report flagged for clinical review</div>
        </div>

        <div className="bento-card bento-terracotta" onClick={() => setActiveTab('Billing')}>
          <div className="bento-top-row">
            <span className="bento-label">Patient Co-Pay</span>
            <span className="bento-arrow-badge"><IconArrowRight size={13} /></span>
          </div>
          <div className="bento-metric">$50</div>
          <div className="bento-detail">Statement due by Oct 28, 2026</div>
        </div>

        <div className="bento-card bento-teal" onClick={() => setActiveTab('Messages')}>
          <div className="bento-top-row">
            <span className="bento-label">Care Team Messages</span>
            <span className="bento-arrow-badge"><IconArrowRight size={13} /></span>
          </div>
          <div className="bento-metric">2</div>
          <div className="bento-detail">New notes from Dr. Sarah Chen</div>
        </div>
      </div>

      {/* Two Column Layout: Vitals & Prescriptions */}
      <div className="dashboard-columns">
        {/* Left: Health Vitals Card */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>Recorded Clinical Vitals</h3>
              <p>Telemetry recorded Oct 06, 2026 by Valley Medical Nursing Staff</p>
            </div>
            <span className="status-badge-ok">Optimal Limits</span>
          </div>
          <div className="vitals-grid">
            <div className="vital-item">
              <div className="vital-head">
                <IconHeart size={14} /> Blood Pressure
              </div>
              <div className="vital-val">120/78<span className="vital-unit">mmHg</span></div>
              <div className="vital-status text-green">Optimal Range</div>
            </div>

            <div className="vital-item">
              <div className="vital-head">
                <IconActivity size={14} /> Resting Pulse
              </div>
              <div className="vital-val">72<span className="vital-unit">bpm</span></div>
              <div className="vital-status text-green">Normal Sinus</div>
            </div>

            <div className="vital-item">
              <div className="vital-head">
                <IconActivity size={14} /> SpO2 Oxygenation
              </div>
              <div className="vital-val">99<span className="vital-unit">%</span></div>
              <div className="vital-status text-green">Room Air</div>
            </div>

            <div className="vital-item">
              <div className="vital-head">
                <IconDroplet size={14} /> Fasting Glucose
              </div>
              <div className="vital-val">94<span className="vital-unit">mg/dL</span></div>
              <div className="vital-status text-green">Normal Basal</div>
            </div>
          </div>
        </div>

        {/* Right: Active Medications & Treatment Plan */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>Active Prescriptions</h3>
              <p>Dispensed through Valley Regional Outpatient Pharmacy</p>
            </div>
            <button className="btn-sm-outline" onClick={() => alert('Refill request routed to Pharmacy')}>
              Request Refills
            </button>
          </div>

          <div className="medication-list">
            <div className="med-item">
              <div className="med-icon-wrap">
                <IconPill size={18} />
              </div>
              <div className="med-info">
                <div className="med-name">Atorvastatin Calcium — 20 mg Oral Tablet</div>
                <div className="med-instructions">Take 1 tablet daily at bedtime • 3 refills remaining</div>
              </div>
              <span className="med-status active">Active</span>
            </div>

            <div className="med-item">
              <div className="med-icon-wrap">
                <IconPill size={18} />
              </div>
              <div className="med-info">
                <div className="med-name">Lisinopril — 10 mg Oral Tablet</div>
                <div className="med-instructions">Take 1 tablet every morning with water • 2 refills remaining</div>
              </div>
              <span className="med-status active">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
