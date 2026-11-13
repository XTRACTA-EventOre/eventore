export function createApiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/api\/?/, '').replace(/^\/+/, '')}`;
}

export function apiUrl(path) {
  return createApiUrl(import.meta.env.VITE_API_BASE_URL || '/api', path);
}
