/**
 * MediCare+ Form Validation Helpers
 */

export function validateAppointmentForm(formData) {
  const errors = {};
  if (!formData.date) {
    errors.date = 'Appointment date is required';
  }
  if (!formData.specialty) {
    errors.specialty = 'Specialty is required';
  }
  if (!formData.timeSlot) {
    errors.timeSlot = 'Please select a time slot';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validatePaymentForm(cardData) {
  const errors = {};
  const cleanedNum = (cardData.cardNumber || '').replace(/\s+/g, '');
  if (!cleanedNum || cleanedNum.length < 15) {
    errors.cardNumber = 'Valid 16-digit credit card number required';
  }
  if (!cardData.expiry || !cardData.expiry.includes('/')) {
    errors.expiry = 'MM/YY format required';
  }
  if (!cardData.cvv || cardData.cvv.length < 3) {
    errors.cvv = '3-digit CVV required';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
