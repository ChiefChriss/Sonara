export function getApiBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (import.meta as any).env?.VITE_API_BASE_URL
      : undefined;
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }

  return 'http://127.0.0.1:8000';
}
