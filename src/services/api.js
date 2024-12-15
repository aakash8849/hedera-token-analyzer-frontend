// hedera-token-analyzer-frontend-main/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;  // Remove /api since it's in the routes

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const analyzeToken = async (tokenId) => {
  try {
    const response = await api.post('/api/analyze', { tokenId }); // Add /api here
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to analyze token');
  }
};

export const visualizeToken = async (tokenId) => {
  try {
    const response = await api.get(`/api/visualize/${tokenId}`); // Add /api here
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to visualize token');
  }
};

export default api;
