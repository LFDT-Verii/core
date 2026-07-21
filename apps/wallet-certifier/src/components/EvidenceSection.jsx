import React from 'react';
import PropTypes from 'prop-types';

const EvidenceSection = ({ json, jwt }) => (
  <div className="evidence-section">
    <section aria-labelledby="json-evidence-heading">
      <h4 id="json-evidence-heading">Credential JSON</h4>
      <pre>{JSON.stringify(json, null, 2)}</pre>
    </section>
    <section aria-labelledby="jwt-evidence-heading">
      <h4 id="jwt-evidence-heading">JWT</h4>
      <pre className="jwt-evidence">{jwt}</pre>
    </section>
  </div>
);

// eslint-disable-next-line better-mutation/no-mutation
EvidenceSection.propTypes = {
  json: PropTypes.object.isRequired,
  jwt: PropTypes.string.isRequired,
};

export default EvidenceSection;
