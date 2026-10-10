export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const savedUser = localStorage.getItem('patchwork_user');
  let userId = 'asha';
  if (savedUser) {
    try {
      userId = JSON.parse(savedUser).id || 'asha';
    } catch {}
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API Error ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.error) errorMsg = body.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  get: <T = any>(url: string) => apiFetch<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, data?: any) =>
    apiFetch<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T = any>(url: string, data?: any) =>
    apiFetch<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T = any>(url: string, data?: any) =>
    apiFetch<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T = any>(url: string, data?: any) =>
    apiFetch<T>(url, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }),
};
