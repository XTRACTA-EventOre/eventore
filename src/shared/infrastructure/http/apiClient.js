import { apiUrl } from './apiUrl.js';

export async function requestApi(path, options) {
  const response = await fetch(apiUrl(path), { credentials: 'include', ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? 'No se pudo completar la operación');
    error.status = response.status; error.code = body?.error?.code; throw error;
  }
  return body;
}
