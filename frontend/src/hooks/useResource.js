import { useCallback, useEffect, useState } from 'react';

export function useResource(load) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await load());
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
