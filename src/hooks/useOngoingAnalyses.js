import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const POLL_INTERVAL = 5000; // 5 seconds

export function useOngoingAnalyses() {
  const [analyses, setAnalyses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const fetchAnalyses = async () => {
      try {
        const response = await axios.get(`${API_URL}/analyze/ongoing`);
        if (mounted) {
          setAnalyses(response.data);
          timeoutId = setTimeout(fetchAnalyses, POLL_INTERVAL);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      }
    };

    fetchAnalyses();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return { analyses, error };
}
