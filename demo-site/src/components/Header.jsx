import React from 'react';
import { 
  IconCross, 
  IconCalendar, 
  IconFlask, 
  IconChat, 
  IconCard, 
  IconActivity, 
  IconRefresh 
} from './Icons';

export default function Header({ activeTab, setActiveTab, onResetSession, remainingSeconds }) {
  const tabs = [
    { id: 'Dashboard', label: 'Overview', icon: <IconActivity size={15} /> },
    { id: 'Appointments', label: 'Appointments', icon: <IconCalendar size={15} />, badge: 'Bug #1' },
    { id: 'Lab Results', label: 'Diagnostics', icon: <IconFlask size={15} />, badge: 'Bug #2' },
    { id: 'Messages', label: 'Care Team', icon: <IconChat size={15} />, count: '2' },
    { id: 'Billing', label: 'Billing & Co-Pay', icon: <IconCard size={15} />, badge: 'Bug #3' },
  ];

  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        {/* Brand */}
        <div className="brand-group" onClick={() => setActiveTab('Dashboard')}>
          <div className="brand-logo-wrap">
            <IconCross size={20} />
          </div>
          <div className="brand-titles">
            <div className="brand-name">MediCare<span className="brand-plus">+</span></div>
            <div className="brand-subtitle">Regional Health Network</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="portal-nav" aria-label="Portal Navigation">
          <ul className="nav-list">
            {tabs.map((tab) => (
              <li key={tab.id} className="nav-item">
                <button
                  type="button"
                  className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  id={`nav-tab-${tab.id.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="nav-icon">{tab.icon}</span>
                  <span className="nav-label">{tab.label}</span>
                  {tab.badge && (
                    <span className="nav-badge-tag">{tab.badge}</span>
                  )}
                  {tab.count && (
                    <span className="nav-counter">{tab.count}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile & Helpline */}
        <div className="portal-user-area">
          <div className="nurse-line-pill">
            <span className="pulse-indicator"></span>
            <span>24/7 Helpline: <strong>1-800-MEDICARE</strong></span>
          </div>

          <div className="patient-profile-card">
            <div className="patient-avatar">AM</div>
            <div className="patient-meta">
              <div className="patient-name">Alex Morgan</div>
              <div className="patient-id">
                <span>MRN #8921-A</span>
                <span className="hipaa-badge">HIPAA</span>
              </div>
            </div>
            <button 
              className="session-reset-btn" 
              title="Reset session token timer (60s)"
              onClick={onResetSession}
              aria-label="Reset session timer"
            >
              <IconRefresh size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
