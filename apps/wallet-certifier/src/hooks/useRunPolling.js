import { useEffect, useState } from 'react';

const TERMINAL_STATES = new Set([
  'PASSED',
  'FAILED',
  'REJECTED',
  'TIMED_OUT',
  'ERROR',
]);

const useRunPolling = ({ api, runId, token }) => {
  const [run, setRun] = useState();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const value = await api.getRun(runId, token);
        if (!active) {
          return;
        }
        setRun(value);
        setError('');
        if (!TERMINAL_STATES.has(value.state)) {
          const delay = document.hidden ? 15000 : 3000;
          // eslint-disable-next-line better-mutation/no-mutation
          timer = window.setTimeout(poll, delay);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          // eslint-disable-next-line better-mutation/no-mutation
          timer = window.setTimeout(poll, 5000);
        }
      }
    };
    poll();
    return () => {
      // eslint-disable-next-line better-mutation/no-mutation
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, runId, token]);

  return { run, error };
};

export default useRunPolling;
