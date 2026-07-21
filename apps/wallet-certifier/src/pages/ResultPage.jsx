import React from 'react';
import PropTypes from 'prop-types';
import CheckList from '../components/CheckList.jsx';
import EvidenceSection from '../components/EvidenceSection.jsx';
import StatusDot from '../components/StatusDot.jsx';

const VerifiedLine = ({ children }) => (
  <div className="verified-line">
    <StatusDot />
    <strong>{children}</strong>
  </div>
);

// eslint-disable-next-line better-mutation/no-mutation
VerifiedLine.propTypes = { children: PropTypes.node.isRequired };

const CredentialResult = ({ credential, index }) => (
  <article
    className="credential-result"
    data-testid={`credential-result-${index + 1}`}
  >
    <header>
      {credential.verified ? (
        <VerifiedLine>Credential verified</VerifiedLine>
      ) : (
        <strong className="failed-line">Credential not verified</strong>
      )}
      <span>Credential {String(index + 1).padStart(2, '0')}</span>
    </header>
    <CheckList checks={credential.checks} />
    <EvidenceSection json={credential.json} jwt={credential.jwt} />
  </article>
);

// eslint-disable-next-line better-mutation/no-mutation
CredentialResult.propTypes = {
  credential: PropTypes.shape({
    verified: PropTypes.bool.isRequired,
    checks: PropTypes.object.isRequired,
    json: PropTypes.object.isRequired,
    jwt: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

const CompletedAt = ({ value }) => (
  <p className="completion-time">
    Completed{' '}
    <time dateTime={value}>
      {new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'long',
      }).format(new Date(value))}
    </time>
  </p>
);

// eslint-disable-next-line better-mutation/no-mutation
CompletedAt.propTypes = { value: PropTypes.string.isRequired };

const IssuingResult = ({ result }) => (
  <>
    <div className="result-verdict">
      <VerifiedLine>Credential issued</VerifiedLine>
      <h1>Issuing certified.</h1>
      <p>The wallet received the personalized OpenBadgeCredential in time.</p>
      <CompletedAt value={result.completedAt} />
    </div>
    <CredentialResult
      index={0}
      credential={{ ...result.credential, verified: true, checks: {} }}
    />
  </>
);

// eslint-disable-next-line better-mutation/no-mutation
IssuingResult.propTypes = { result: PropTypes.object.isRequired };

const VerificationResult = ({ result }) => (
  <>
    <div className="result-verdict">
      {result.presentation.verified ? (
        <VerifiedLine>Presentation verified</VerifiedLine>
      ) : (
        <strong className="failed-line">Presentation not verified</strong>
      )}
      <h1>
        {result.passed ? 'Verification certified.' : 'Verification failed.'}
      </h1>
      <p>
        {result.setupBadgePresent
          ? 'The presentation contains this run’s setup badge.'
          : 'The presentation does not contain this run’s setup badge.'}
      </p>
      <CompletedAt value={result.completedAt} />
      <CheckList checks={result.presentation.checks} />
    </div>
    {result.credentials.map((credential, index) => (
      <CredentialResult
        key={`${credential.jwt}-${index}`}
        credential={credential}
        index={index}
      />
    ))}
  </>
);

// eslint-disable-next-line better-mutation/no-mutation
VerificationResult.propTypes = { result: PropTypes.object.isRequired };

const FailureResult = ({ run }) => (
  <div className="result-verdict failure-verdict">
    <p className="eyebrow">Result / {run.state.replaceAll('_', ' ')}</p>
    <h1>Certification not completed.</h1>
    <p>{run.failure?.message ?? 'The certification could not be completed.'}</p>
    <a className="primary-action inline-action" href="/">
      Start another test
    </a>
  </div>
);

// eslint-disable-next-line better-mutation/no-mutation
FailureResult.propTypes = { run: PropTypes.object.isRequired };

const ResultBody = ({ run }) => {
  if (!(['PASSED', 'FAILED'].includes(run.state) && run.result)) {
    return <FailureResult run={run} />;
  }
  if (run.capability === 'VERIFICATION') {
    return <VerificationResult result={run.result} />;
  }
  return <IssuingResult result={run.result} />;
};

// eslint-disable-next-line better-mutation/no-mutation
ResultBody.propTypes = { run: PropTypes.object.isRequired };

const ResultPage = ({ run }) => {
  const successfulResult =
    ['PASSED', 'FAILED'].includes(run.state) && run.result;
  return (
    <main className="result-workspace">
      <div className="result-index">
        <p className="eyebrow">Certification result</p>
        <span>Run</span>
        <code>{run.runId}</code>
        <span>Capability</span>
        <strong>{run.capability.toLowerCase()}</strong>
      </div>
      <section className="result-dossier" aria-live="polite">
        <ResultBody run={run} />
        {successfulResult && (
          <div className="result-footer-action">
            <a href="/">Start another test</a>
          </div>
        )}
      </section>
    </main>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
ResultPage.propTypes = { run: PropTypes.object.isRequired };

export default ResultPage;
