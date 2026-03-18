import axios from 'axios';

const BASE_URL = 'https://servilo-backend.onrender.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const loginAPI = (data) => api.post('/auth/login', data);
export const getStatsAPI = () => api.get('/auth/admin/stats');
export const getAllUsersAPI = () => api.get('/auth/admin/users');
export const deleteUserAPI = (id) => api.delete(`/auth/admin/users/${id}`);
export const getAllShopsAdminAPI = () => api.get('/shops/admin/all');
export const approveShopAPI = (id) => api.put(`/shops/${id}/approve`);
export const deleteShopAPI = (id) => api.delete(`/shops/${id}`);

export default api;