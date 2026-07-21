import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ResultPage from './ResultPage.jsx';

const ResultLinkPage = ({ api, runId }) => {
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('token'),
  );
  const [run, setRun] = useState();
  const [error, setError] = useState(() =>
    token ? '' : 'This result link is incomplete or has expired.',
  );

  useEffect(() => {
    window.history.replaceState({}, '', window.location.pathname);
    if (!token) {
      return;
    }
    api
      .createResultSession(runId, token)
      .then(() => api.getRun(runId))
      .then(setRun)
      .catch((requestError) => setError(requestError.message));
  }, [api, runId, token]);

  if (error) {
    return (
      <main className="waiting-workspace">
        <section className="transition-ledger">
          <p className="eyebrow">Result access</p>
          <h1>Result unavailable.</h1>
          <p>{error}</p>
          <a href="/">Start another test</a>
        </section>
      </main>
    );
  }
  if (!run) {
    return (
      <main className="waiting-workspace">
        <section className="transition-ledger" role="status">
          Loading certification result…
        </section>
      </main>
    );
  }
  return <ResultPage run={run} />;
};

// eslint-disable-next-line better-mutation/no-mutation
ResultLinkPage.propTypes = {
  api: PropTypes.object.isRequired,
  runId: PropTypes.string.isRequired,
};

export default ResultLinkPage;
