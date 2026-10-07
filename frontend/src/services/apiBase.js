const defaultApiBaseUrl = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');
