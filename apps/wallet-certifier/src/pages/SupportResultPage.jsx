import React from 'react';
import PropTypes from 'prop-types';

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'long',
      }).format(new Date(value))
    : 'Not recorded';

const SupportResultPage = ({ run }) => (
  <main className="result-workspace support-workspace">
    <div className="result-index">
      <p className="eyebrow">Private support view</p>
      <span>Run</span>
      <code>{run.runId}</code>
      <span>Capability</span>
      <strong>{run.capability.toLowerCase()}</strong>
    </div>
    <section className="result-dossier" aria-live="polite">
      <div className="result-verdict">
        <p className="eyebrow">Sanitized operational record</p>
        <h1>Support diagnostics</h1>
        <p>
          This view contains run references and delivery status only. Applicant
          details and credential evidence are intentionally excluded.
        </p>
        <dl className="support-facts">
          <div>
            <dt>Outcome</dt>
            <dd>{run.state.replaceAll('_', ' ')}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>{run.walletName ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{run.walletOrganizationName ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{formatDate(run.completedAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="support-sections">
        <section className="credential-result">
          <header>
            <strong>Notification delivery</strong>
            <span>{run.notifications.length} jobs</span>
          </header>
          <ul className="support-list">
            {run.notifications.map((notification) => (
              <li key={notification.role}>
                <span>{notification.role.toLowerCase()}</span>
                <strong>{notification.status.toLowerCase()}</strong>
                <small>{notification.attemptCount ?? 0} attempts</small>
              </li>
            ))}
          </ul>
        </section>
        <section className="credential-result">
          <header>
            <strong>Run journal</strong>
            <span>{run.journal.length} entries</span>
          </header>
          <ol className="support-list">
            {run.journal.map((entry, index) => (
              <li key={`${entry.state}-${entry.at}-${index}`}>
                <span>{entry.state.replaceAll('_', ' ')}</span>
                <time dateTime={entry.at}>{formatDate(entry.at)}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  </main>
);

// eslint-disable-next-line better-mutation/no-mutation
SupportResultPage.propTypes = {
  run: PropTypes.shape({
    runId: PropTypes.string.isRequired,
    capability: PropTypes.string.isRequired,
    state: PropTypes.string.isRequired,
    walletName: PropTypes.string,
    walletOrganizationName: PropTypes.string,
    completedAt: PropTypes.string,
    notifications: PropTypes.arrayOf(PropTypes.object).isRequired,
    journal: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
};

export default SupportResultPage;
