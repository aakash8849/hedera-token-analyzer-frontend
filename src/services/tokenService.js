import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function analyzeToken(tokenId) {
  try {
    const response = await axios.post(`${API_URL}/analyze`, { tokenId });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

export async function visualizeToken(tokenId) {
  try {
    const response = await axios.get(`${API_URL}/visualize/${tokenId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}