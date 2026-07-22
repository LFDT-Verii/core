import { useEffect, useState } from 'react';

const TERMINAL_STATES = new Set([
  'PASSED',
  'FAILED',
  'REJECTED',
  'TIMED_OUT',
  'ERROR',
]);

const isRetryableError = (requestError) =>
  requestError.status == null ||
  requestError.status === 429 ||
  requestError.status >= 500;

const useRunPolling = ({ api, runId, token }) => {
  const [run, setRun] = useState();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timer;
    const handleError = (requestError, poll) => {
      if (!active) {
        return;
      }
      setError(requestError.message);
      if (!isRetryableError(requestError)) {
        return;
      }
      // eslint-disable-next-line better-mutation/no-mutation
      timer = window.setTimeout(poll, 5000);
    };
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
        handleError(requestError, poll);
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
