import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const analyzeToken = async (tokenId) => {
  try {
    const response = await api.post('/analyze', { tokenId });
    return response;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to analyze token');
  }
};

export const getAnalysisStatus = async (tokenId) => {
  try {
    const response = await api.get(`/analyze/${tokenId}/status`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to get analysis status');
  }
};

export const visualizeToken = async (tokenId) => {
  try {
    const response = await api.get(`/visualize/${tokenId}`);
    // Data is now coming directly from Neo4j in the correct format
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to visualize token');
  }
};

export default api;
