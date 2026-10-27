import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dishhome_token') || sessionStorage.getItem('dishhome_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Response interceptor to catch 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('dishhome_token');
      sessionStorage.removeItem('dishhome_token');
      localStorage.removeItem('dishhome_user');
      sessionStorage.removeItem('dishhome_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
