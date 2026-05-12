import axios from 'axios';
import { APP_CONFIG } from '../config/app.config';

const api = axios.create({
  baseURL: APP_CONFIG.backendBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export default api;
