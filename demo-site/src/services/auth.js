/**
 * MediCare+ Patient Portal - Authentication & Session Service
 * Simulates enterprise session management with token lifecycle
 */

const SESSION_KEY = 'medicare_session';
const TOKEN_KEY = 'auth_token';

export const AuthState = {
  currentSession: null,
  loginTimestamp: Date.now(),
  tokenTTLSeconds: 60, // Per spec: session expires in 60s
  forceTimeoutEnabled: true
};

export function initAuth() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    const syntheticToken = 'jwt_medicare_pat_' + Math.random().toString(36).substring(2);
    localStorage.setItem(TOKEN_KEY, syntheticToken);
    localStorage.setItem('loginTime', Date.now().toString());
  }
  AuthState.loginTimestamp = parseInt(localStorage.getItem('loginTime') || Date.now().toString(), 10);
}

/**
 * Validates the current patient session.
 */
export async function validateSession() {
  const loginTime = parseInt(localStorage.getItem('loginTime') || Date.now().toString(), 10);
  const elapsedSeconds = (Date.now() - loginTime) / 1000;

  // Simulate network latency for auth check
  await new Promise(res => setTimeout(res, 300));

  if (AuthState.forceTimeoutEnabled && elapsedSeconds > AuthState.tokenTTLSeconds) {
    const error = new Error('HTTP 401 Unauthorized: Session token refresh failed. Token expired.');
    error.statusCode = 401;
    throw error;
  }

  return {
    valid: true,
    patientId: 'PT-8921',
    patientName: 'Alex Morgan',
    expiresIn: Math.max(0, Math.round(AuthState.tokenTTLSeconds - elapsedSeconds))
  };
}

export function getSessionRemainingTime() {
  const loginTime = parseInt(localStorage.getItem('loginTime') || Date.now().toString(), 10);
  const elapsedSeconds = (Date.now() - loginTime) / 1000;
  return Math.max(0, Math.round(AuthState.tokenTTLSeconds - elapsedSeconds));
}

export function resetSession() {
  localStorage.setItem('loginTime', Date.now().toString());
  AuthState.loginTimestamp = Date.now();
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || 'jwt_medicare_synthetic_token_ok';
}
