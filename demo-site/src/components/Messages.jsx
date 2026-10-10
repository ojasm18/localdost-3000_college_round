import React, { useState } from 'react';
import { IconLock } from './Icons';

export default function Messages() {
  const [activeThread, setActiveThread] = useState('chen');
  const [replyText, setReplyText] = useState('');
  const [messages, setMessages] = useState({
    chen: [
      {
        id: 1,
        sender: 'Dr. Sarah Chen, MD',
        role: 'Cardiology Specialist',
        time: 'Yesterday at 3:15 PM',
        text: 'Hello Alex, I reviewed your recent lipid panel. Your total cholesterol is slightly elevated at 208 mg/dL. Please continue your Atorvastatin 20mg as prescribed, and we will discuss lifestyle adjustments during our appointment on Oct 17.',
        isDoctor: true
      },
      {
        id: 2,
        sender: 'Alex Morgan',
        role: 'Patient',
        time: 'Yesterday at 4:20 PM',
        text: 'Thank you Dr. Chen. Should I fast before the morning appointment on Oct 17?',
        isDoctor: false
      },
      {
        id: 3,
        sender: 'Dr. Sarah Chen, MD',
        role: 'Cardiology Specialist',
        time: 'Today at 9:05 AM',
        text: 'Yes please. Fasting for 8 hours prior is recommended if we draw repeat metabolic markers. Drink plenty of water.',
        isDoctor: true
      }
    ],
    vance: [
      {
        id: 10,
        sender: 'Dr. Marcus Vance, DO',
        role: 'Primary Care Physician',
        time: 'Oct 02, 2026',
        text: 'Alex, your blood pressure reading from last week looks stable at 120/78. Keep logging your home readings on the portal.',
        isDoctor: true
      }
    ]
  });

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'Alex Morgan',
      role: 'Patient',
      time: 'Just now',
      text: replyText,
      isDoctor: false
    };

    setMessages({
      ...messages,
      [activeThread]: [...messages[activeThread], newMsg]
    });
    setReplyText('');
  };

  return (
    <div className="messages-page animate-fade-in">
      <div className="section-head-card">
        <div className="section-title-wrap">
          <h2>Secure Clinical Communications</h2>
          <p>
            Direct, HIPAA-compliant messaging with your Valley Regional care team.
            For urgent medical emergencies, dial 911 or visit the emergency pavilion immediately.
          </p>
        </div>
      </div>

      <div className="messages-layout">
        {/* Left: Provider Conversation List */}
        <div className="threads-sidebar">
          <div className="threads-head">
            <h3>Care Team Threads</h3>
          </div>
          <div 
            className={`thread-item ${activeThread === 'chen' ? 'active' : ''}`}
            onClick={() => setActiveThread('chen')}
          >
            <div className="thread-avatar">SC</div>
            <div className="thread-details">
              <div className="thread-name">Dr. Sarah Chen, MD</div>
              <div className="thread-role">Cardiovascular Medicine</div>
              <div className="thread-preview">Yes please. Fasting for 8 hours...</div>
            </div>
            <span className="unread-dot"></span>
          </div>

          <div 
            className={`thread-item ${activeThread === 'vance' ? 'active' : ''}`}
            onClick={() => setActiveThread('vance')}
          >
            <div className="thread-avatar">MV</div>
            <div className="thread-details">
              <div className="thread-name">Dr. Marcus Vance, DO</div>
              <div className="thread-role">Primary Care Physician</div>
              <div className="thread-preview">Blood pressure reading looks stable...</div>
            </div>
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div className="thread-chat-view">
          <div className="chat-header">
            <div className="chat-doc-info">
              <h4>{activeThread === 'chen' ? 'Dr. Sarah Chen, MD' : 'Dr. Marcus Vance, DO'}</h4>
              <span className="doc-dept">
                {activeThread === 'chen' ? 'Cardiology Clinic • Valley Pavilion B' : 'Family Practice • Valley Main Clinic'}
              </span>
            </div>
            <div className="chat-meta">
              <span className="hipaa-pill">
                <IconLock size={12} /> 256-Bit Encrypted
              </span>
            </div>
          </div>

          <div className="chat-messages-scroll">
            {messages[activeThread].map((m) => (
              <div key={m.id} className={`chat-bubble-wrap ${m.isDoctor ? 'doctor' : 'patient'}`}>
                <div className="bubble-author">
                  <span>{m.sender}</span>
                  <small>{m.time}</small>
                </div>
                <div className="bubble-content">{m.text}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendReply} className="chat-composer">
            <input
              type="text"
              placeholder={`Message ${activeThread === 'chen' ? 'Dr. Chen' : 'Dr. Vance'}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
