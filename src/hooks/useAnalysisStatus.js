import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export function useAnalysisStatus(tokenId) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const pollStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/analyze/${tokenId}/status`);
      setStatus(response.data.status);
      setProgress(response.data.progress);
      
      if (response.data.status === 'in_progress') {
        setTimeout(pollStatus, 2000);
      }
    } catch (error) {
      setError(error.message);
    }
  }, [tokenId]);

  useEffect(() => {
    if (tokenId) {
      pollStatus();
    }
    return () => setStatus(null);
  }, [tokenId, pollStatus]);

  return { status, progress, error };
}
