import axios from 'axios';

const BASE_URL = "https://servilo-backend.onrender.com/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// ── Request interceptor: attach admin token ──────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: normalize error messages ───────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const data    = error.response?.data;

    if (status === 429) {
      // Rate limit hit — surface a clear, actionable message
      const retryMin = data?.retryAfterSeconds
        ? Math.ceil(data.retryAfterSeconds / 60)
        : 15;
      error.message =
        data?.message ||
        `Too many requests. Please wait ${retryMin} minute(s) before trying again.`;
    } else if (status === 401) {
      error.message = 'Session expired. Please log in again.';
    } else if (status === 403) {
      error.message = 'Access denied. Admin privileges required.';
    } else if (!error.response) {
      error.message = 'Network error. Check your connection and try again.';
    } else {
      error.message = data?.message || 'An unexpected error occurred.';
    }

    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────
export const loginAPI = (data) => api.post('/auth/login', data);

// ── Admin: Stats & Users ──────────────────────────────────
export const getStatsAPI    = () => api.get('/auth/admin/stats');
export const getAllUsersAPI  = () => api.get('/auth/admin/users');
export const deleteUserAPI  = (id) => api.delete(`/auth/admin/users/${id}`);

// ── Admin: Shops ──────────────────────────────────────────
export const getAllShopsAdminAPI = () => api.get('/shops/admin/all');
export const approveShopAPI     = (id) => api.put(`/shops/${id}/approve`);
export const deleteShopAPI      = (id) => api.delete(`/shops/${id}`);

export default api;