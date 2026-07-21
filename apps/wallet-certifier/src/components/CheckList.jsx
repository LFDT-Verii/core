import React from 'react';
import PropTypes from 'prop-types';

const labels = {
  tamper: 'Tamper',
  trustedIssuer: 'Trusted issuer',
  trustedHolder: 'Trusted holder',
  revocation: 'Revocation',
  expiry: 'Expiry',
};

const statusLabel = (status) => {
  if (status === 'PASS') {
    return 'Passed';
  }
  if (status === 'NOT_APPLICABLE') {
    return 'Not applicable';
  }
  if (status === 'SKIPPED') {
    return 'Skipped';
  }
  return 'Failed';
};

const CheckList = ({ checks = {} }) => (
  <dl className="check-list">
    {Object.entries(checks).map(([name, status]) => (
      <div key={name} className={status === 'FAIL' ? 'failed' : undefined}>
        <dt>{labels[name] ?? name}</dt>
        <dd>
          <span aria-hidden="true">{status === 'FAIL' ? '×' : '✓'}</span>
          {statusLabel(status)}
        </dd>
      </div>
    ))}
  </dl>
);

// eslint-disable-next-line better-mutation/no-mutation
CheckList.propTypes = { checks: PropTypes.object };

export default CheckList;
