import React, { useId } from 'react';
import PropTypes from 'prop-types';

const EvidenceSection = ({ json, jwt }) => {
  const evidenceId = useId();
  const jsonHeadingId = `json-evidence-heading-${evidenceId}`;
  const jwtHeadingId = `jwt-evidence-heading-${evidenceId}`;

  return (
    <div className="evidence-section">
      <section aria-labelledby={jsonHeadingId}>
        <h4 id={jsonHeadingId}>Credential JSON</h4>
        <pre>{JSON.stringify(json, null, 2)}</pre>
      </section>
      <section aria-labelledby={jwtHeadingId}>
        <h4 id={jwtHeadingId}>JWT</h4>
        <pre className="jwt-evidence">{jwt}</pre>
      </section>
    </div>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
EvidenceSection.propTypes = {
  json: PropTypes.object.isRequired,
  jwt: PropTypes.string.isRequired,
};

export default EvidenceSection;
