/**
 * MediCare+ Patient Portal - Central API Client
 * Wraps network requests and provides simulated endpoints for Demo Scenarios
 */
import { getAuthToken } from './auth';

const LAB_DATA = [
  {
    id: 'LAB-4019',
    test: 'Comprehensive Metabolic Panel (CMP)',
    category: 'Chemistry',
    date: '2026-10-06',
    doctor: 'Dr. Sarah Chen, MD',
    status: 'Completed',
    flag: 'Normal',
    results: [
      { marker: 'Glucose (Fasting)', value: '94 mg/dL', refRange: '70 - 99 mg/dL', status: 'normal' },
      { marker: 'BUN (Blood Urea Nitrogen)', value: '14 mg/dL', refRange: '7 - 20 mg/dL', status: 'normal' },
      { marker: 'Creatinine', value: '0.85 mg/dL', refRange: '0.6 - 1.2 mg/dL', status: 'normal' },
      { marker: 'eGFR', value: '> 90 mL/min', refRange: '>= 60 mL/min', status: 'normal' },
      { marker: 'Sodium', value: '140 mEq/L', refRange: '136 - 145 mEq/L', status: 'normal' },
      { marker: 'Potassium', value: '4.2 mEq/L', refRange: '3.5 - 5.1 mEq/L', status: 'normal' }
    ]
  },
  {
    id: 'LAB-3982',
    test: 'Complete Blood Count (CBC) with Differential',
    category: 'Hematology',
    date: '2026-09-22',
    doctor: 'Dr. Marcus Vance, DO',
    status: 'Completed',
    flag: 'Normal',
    results: [
      { marker: 'White Blood Cell (WBC)', value: '6.4 x10³/µL', refRange: '4.0 - 11.0 x10³/µL', status: 'normal' },
      { marker: 'Red Blood Cell (RBC)', value: '4.82 x10⁶/µL', refRange: '4.30 - 5.90 x10⁶/µL', status: 'normal' },
      { marker: 'Hemoglobin', value: '15.1 g/dL', refRange: '13.5 - 17.5 g/dL', status: 'normal' },
      { marker: 'Hematocrit', value: '44.8%', refRange: '38.8 - 50.0%', status: 'normal' },
      { marker: 'Platelets', value: '254 x10³/µL', refRange: '150 - 450 x10³/µL', status: 'normal' }
    ]
  },
  {
    id: 'LAB-3910',
    test: 'Brain MRI with & without Contrast (Neuro)',
    category: 'Diagnostic Radiology',
    date: '2026-09-14',
    doctor: 'Dr. Elena Rostova, MD',
    status: 'Completed',
    flag: 'Reviewed',
    results: [
      { marker: 'Ventricular System', value: 'Normal size and configuration', refRange: 'Age-appropriate', status: 'normal' },
      { marker: 'White Matter', value: 'No acute infarction or mass effect', refRange: 'Clear', status: 'normal' },
      { marker: 'Vascular Structures', value: 'Patent major flow voids', refRange: 'Patent', status: 'normal' }
    ]
  },
  {
    id: 'LAB-3844',
    test: 'Lipid Profile Panel (Standard)',
    category: 'Cardiovascular',
    date: '2026-08-30',
    doctor: 'Dr. Sarah Chen, MD',
    status: 'Completed',
    flag: 'Attention',
    results: [
      { marker: 'Total Cholesterol', value: '208 mg/dL', refRange: '< 200 mg/dL', status: 'high' },
      { marker: 'HDL Cholesterol', value: '52 mg/dL', refRange: '> 40 mg/dL', status: 'normal' },
      { marker: 'LDL Cholesterol', value: '128 mg/dL', refRange: '< 100 mg/dL', status: 'high' },
      { marker: 'Triglycerides', value: '140 mg/dL', refRange: '< 150 mg/dL', status: 'normal' }
    ]
  }
];

export async function fetchLabResultsApi(patientId) {
  // Simulate network roundtrip
  await new Promise(resolve => setTimeout(resolve, 800));
  return LAB_DATA;
}

export async function submitAppointmentApi(appointmentData) {
  await new Promise(resolve => setTimeout(resolve, 600));
  return {
    confirmationId: 'APT-' + Math.floor(100000 + Math.random() * 900000),
    scheduledDate: appointmentData.date,
    specialty: appointmentData.specialty,
    physician: appointmentData.physician,
    status: 'Confirmed'
  };
}

/**
 * Bug #3 Target: Attempts to contact third party payment gateway
 * Without PATCHWORK network interception, this simulates 500 error / outage.
 */
export async function processPaymentApi(paymentPayload) {
  const targetUrl = 'https://payment-gateway.local/process';

  try {
    const response = await window.fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(paymentPayload)
    });

    if (response.status === 503) {
      // Intercepted by PATCHWORK!
      const data = await response.json();
      return {
        intercepted: true,
        status: 503,
        fallback_ui: data.fallback_ui || data.message || "Payment Gateway under scheduled maintenance."
      };
    }

    if (!response.ok) {
      throw new Error(`Payment Gateway Error (HTTP ${response.status})`);
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    // If request failed because payment-gateway.local is offline or errored
    throw new Error('Connection timeout to payment-gateway.local: 500 Internal Server Error (Outage detected)');
  }
}
