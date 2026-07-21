import React from 'react';
import PropTypes from 'prop-types';

const labels = ['Wallet', 'Identity', 'Capability'];

const StepRail = ({ activeStep = 1 }) => (
  <nav className="step-rail" aria-label="Certification steps">
    <p className="eyebrow">Certification file</p>
    <ol>
      {labels.map((label, index) => {
        const step = index + 1;
        return (
          <li
            key={label}
            className={step === activeStep ? 'active' : undefined}
            aria-current={step === activeStep ? 'step' : undefined}
          >
            <span>{String(step).padStart(2, '0')}</span>
            {label}
          </li>
        );
      })}
    </ol>
    <p className="rail-note">
      Phase 01
      <br />
      Velocity Network protocol
    </p>
  </nav>
);

// eslint-disable-next-line better-mutation/no-mutation
StepRail.propTypes = { activeStep: PropTypes.number };

export default StepRail;
