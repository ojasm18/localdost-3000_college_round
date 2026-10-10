import React, { useState } from 'react';
import { submitAppointmentApi } from '../services/api';
import { validateAppointmentForm } from '../utils/validation';
import { IconCheck } from './Icons';

export default function AppointmentForm({ 
  visualPatchActive = false, 
  smartHealingDrift = false,
  onTriggerVisualPatch 
}) {
  const [formData, setFormData] = useState({
    date: '2026-10-24',
    timeSlot: '10:30 AM',
    specialty: 'Cardiology',
    doctor: 'Dr. Sarah Chen, MD (Cardiovascular Specialist)',
    reason: 'Routine post-medication follow-up and blood pressure assessment.'
  });

  const [loading, setLoading] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errors, setErrors] = useState({});
  const [clickAttemptCount, setClickAttemptCount] = useState(0);
  const [clickWarning, setClickWarning] = useState(false);

  const timeSlots = ['09:00 AM', '10:30 AM', '01:15 PM', '02:45 PM', '04:00 PM'];

  // Handle click on the blocking veil
  const handleVeilClick = (e) => {
    e.stopPropagation();
    setClickAttemptCount((prev) => prev + 1);
    setClickWarning(true);
    setTimeout(() => setClickWarning(false), 2500);
    console.warn('Click intercepted by loading-veil overlay.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = validateAppointmentForm(formData);
    if (!val.isValid) {
      setErrors(val.errors);
      return;
    }

    setLoading(true);
    try {
      const res = await submitAppointmentApi(formData);
      setSubmittedData(res);
    } catch (err) {
      alert('Submission error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="appointments" className="appointment-page animate-fade-in">
      <div className="section-head-card">
        <div className="section-title-wrap">
          <h2>Schedule Care Appointment</h2>
          <p>
            Connect with board-certified physicians across Valley Regional Medical Center.
            Includes digital clinical check-in and automated SMS reminders.
          </p>
        </div>
      </div>

      {submittedData ? (
        <div className="appointment-success-card animate-scale-up">
          <div className="success-icon-wrap">
            <IconCheck size={28} />
          </div>
          <h3>Appointment Confirmed</h3>
          <p className="success-conf">
            Confirmation Reference: <strong>{submittedData.confirmationId}</strong>
          </p>
          <div className="confirmation-details-box">
            <div className="conf-row">
              <span>Date & Time</span>
              <strong>{formData.date} at {formData.timeSlot}</strong>
            </div>
            <div className="conf-row">
              <span>Department</span>
              <strong>{formData.specialty}</strong>
            </div>
            <div className="conf-row">
              <span>Attending Physician</span>
              <strong>{formData.doctor}</strong>
            </div>
            <div className="conf-row">
              <span>Location</span>
              <strong>Valley Regional Hospital • Pavilion B, 3rd Floor</strong>
            </div>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => { setSubmittedData(null); setClickAttemptCount(0); }}
          >
            Schedule Another Consultation
          </button>
        </div>
      ) : (
        <div className="appointment-layout">
          {/* Form Container */}
          <div className={`appointment-form-card ${smartHealingDrift ? 'overlay-modal' : 'modal'}`}>
            <form onSubmit={handleSubmit} className="portal-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="apt-specialty">Department & Specialty <span className="req">*</span></label>
                  <select
                    id="apt-specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  >
                    <option value="Cardiology">Cardiology & Vascular Medicine</option>
                    <option value="Primary Care">Primary Care & Family Medicine</option>
                    <option value="Neurology">Neurology & Cognitive Health</option>
                    <option value="Endocrinology">Endocrinology & Metabolism</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="apt-doctor">Attending Physician <span className="req">*</span></label>
                  <select
                    id="apt-doctor"
                    value={formData.doctor}
                    onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                  >
                    <option value="Dr. Sarah Chen, MD (Cardiovascular Specialist)">Dr. Sarah Chen, MD (Cardiology)</option>
                    <option value="Dr. Marcus Vance, DO (Primary Care)">Dr. Marcus Vance, DO (Primary Care)</option>
                    <option value="Dr. Elena Rostova, MD (Neurology)">Dr. Elena Rostova, MD (Neurology)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="apt-date">Preferred Date <span className="req">*</span></label>
                  <input
                    id="apt-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                  {errors.date && <span className="field-err">{errors.date}</span>}
                </div>

                <div className="form-group">
                  <label>Available Consultation Windows <span className="req">*</span></label>
                  <div className="timeslot-chips">
                    {timeSlots.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        className={`slot-chip ${formData.timeSlot === slot ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, timeSlot: slot })}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="apt-reason">Clinical Notes & Symptoms</label>
                <textarea
                  id="apt-reason"
                  rows="3"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Detail any recent symptom changes or specific diagnostic queries..."
                ></textarea>
              </div>

              <div className="appointment-button-container relative">
                <button
                  type="submit"
                  id="appointment-submit-button"
                  data-patch-target="appointment-submit-btn"
                  className={smartHealingDrift ? "btn-primary appointment-submit" : "submit-appointment"}
                  style={{
                    position: 'relative',
                    zIndex: visualPatchActive ? 9999 : 1,
                    pointerEvents: visualPatchActive ? 'auto' : 'auto'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Submitting Consultation Request...' : 'Confirm Appointment Request'}
                </button>

                {!visualPatchActive && (
                  <div
                    className="loading-veil"
                    data-patch-target="appointment-loading-veil"
                    onClick={handleVeilClick}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.01)',
                      zIndex: 100,
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  />
                )}
              </div>
            </form>
          </div>

          {/* Side Info Panel */}
          <div className="appointment-side-info">
            <div className="panel-card">
              <h4>Clinical Visit Guidance</h4>
              <ul className="checklist">
                <li>• Arrive 15 minutes before the scheduled time window.</li>
                <li>• Present active insurance card and photo identification.</li>
                <li>• Bring current medication bottles or an updated dosage list.</li>
                <li>• Fasting of 8 hours is required if lab bloodwork is scheduled.</li>
              </ul>
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
