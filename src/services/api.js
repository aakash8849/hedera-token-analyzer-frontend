import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://hedera-token-analyzer-api.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const analyzeToken = async (tokenId) => {
  const response = await api.post('/analyze', { tokenId });
  return response.data;
};

export const visualizeToken = async (tokenId) => {
  const response = await api.get(`/visualize/${tokenId}`);
  return response.data;
};

export default api;
