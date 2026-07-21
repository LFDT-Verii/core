import React from 'react';
import PropTypes from 'prop-types';

const AppShell = ({ children, config }) => (
  <div className="app-shell">
    <header className="masthead">
      <a className="brand" href="/" aria-label="Wallet Certifier home">
        {config.logoUrl ? (
          <img src={config.logoUrl} alt={config.brandName} />
        ) : (
          <span className="brand-mark" aria-hidden="true">
            VN
          </span>
        )}
        <span>
          <strong>{config.brandName}</strong>
          <small>Wallet Certifier</small>
        </span>
      </a>
      <div className="environment-label">
        <span aria-hidden="true" />
        {config.environmentName}
      </div>
    </header>
    {children}
    <footer className="footer">
      <span>Velocity Network Foundation</span>
      <span>Independent wallet capability test</span>
    </footer>
  </div>
);

// eslint-disable-next-line better-mutation/no-mutation
AppShell.propTypes = {
  children: PropTypes.node.isRequired,
  config: PropTypes.shape({
    brandName: PropTypes.string.isRequired,
    environmentName: PropTypes.string.isRequired,
    logoUrl: PropTypes.string,
  }).isRequired,
};

export default AppShell;
