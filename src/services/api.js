import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const analyzeToken = (tokenId) => api.post('/analyze', { tokenId });
export const visualizeToken = (tokenId) => api.get(`/visualize/${tokenId}`);

export default api;