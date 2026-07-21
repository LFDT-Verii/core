import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import StepRail from '../components/StepRail.jsx';

const FieldError = ({ children }) =>
  children ? <span className="field-error">{children}</span> : null;

// eslint-disable-next-line better-mutation/no-mutation
FieldError.propTypes = { children: PropTypes.node };

const WalletResult = ({ wallet, selected, onSelect }) => (
  <li className={selected ? 'wallet-row selected' : 'wallet-row'}>
    <div className="wallet-identity">
      {wallet.logoUrl ? (
        <img src={wallet.logoUrl} alt="" />
      ) : (
        <span className="wallet-monogram" aria-hidden="true">
          {wallet.name.slice(0, 1)}
        </span>
      )}
      <span>
        <strong>{wallet.name}</strong>
        <small>{wallet.organizationName}</small>
      </span>
    </div>
    <div className="wallet-protocols" aria-label="Supported protocols">
      {wallet.protocols.map((protocol) => (
        <span key={protocol}>
          {protocol === 'VN_API' ? 'Velocity' : 'OpenID4VC'}
        </span>
      ))}
    </div>
    <button
      type="button"
      className="text-action"
      disabled={!wallet.eligible}
      onClick={() => onSelect(wallet)}
      aria-label={`Select ${wallet.name}`}
    >
      {selected ? 'Selected' : 'Select'}
    </button>
    {!wallet.eligible && (
      <small className="wallet-disabled">{wallet.disabledReason}</small>
    )}
  </li>
);

// eslint-disable-next-line better-mutation/no-mutation
WalletResult.propTypes = {
  wallet: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    organizationName: PropTypes.string.isRequired,
    logoUrl: PropTypes.string,
    protocols: PropTypes.arrayOf(PropTypes.string).isRequired,
    eligible: PropTypes.bool.isRequired,
    disabledReason: PropTypes.string,
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

const SetupPage = ({ api, config, onStarted }) => {
  const [query, setQuery] = useState('');
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState();
  const [walletError, setWalletError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const search = async (event) => {
    event.preventDefault();
    setSearchError('');
    try {
      setWallets(await api.searchWallets(query));
    } catch (error) {
      setSearchError(error.message);
    }
  };

  const begin = async (values) => {
    if (!selectedWallet) {
      setWalletError('Select a registered wallet.');
      return;
    }
    setWalletError('');
    setSubmitError('');
    setSubmitting(true);
    const walletTab = window.open('about:blank', 'wallet-certifier-wallet');
    if (walletTab) {
      // eslint-disable-next-line better-mutation/no-mutation
      walletTab.opener = null;
    }
    try {
      const run = await api.createRun({
        walletId: selectedWallet.id,
        applicantName: values.applicantName,
        applicantEmail: values.applicantEmail,
        capability: values.capability,
      });
      const interaction = await api.startRun(run.runId, run.interactionToken);
      if (walletTab) {
        // eslint-disable-next-line better-mutation/no-mutation
        walletTab.location.href = interaction.redirectUrl;
      }
      onStarted({ ...run, interaction, capability: values.capability });
    } catch (error) {
      walletTab?.close();
      setSubmitError(error.message);
      setSubmitting(false);
    }
  };

  return (
    <main className="workspace setup-workspace">
      <StepRail activeStep={1} />
      <section className="dossier" aria-labelledby="setup-heading">
        <header className="dossier-heading reveal reveal-one">
          <p className="eyebrow">Wallet capability assessment</p>
          <h1 id="setup-heading">Wallet Certifier</h1>
          <p>
            Select a registered wallet, identify the tester, and choose the
            capability to certify.
          </p>
        </header>

        <form
          className="ledger-form"
          onSubmit={handleSubmit(begin, () => {
            if (!selectedWallet) {
              setWalletError('Select a registered wallet.');
            }
          })}
          noValidate
        >
          <section className="ledger-section reveal reveal-two">
            <div className="section-number">01</div>
            <div className="section-content">
              <h2>Select the wallet</h2>
              <p>
                Search registered Holder App Providers on the Trust Registry.
              </p>
              <div className="search-line">
                <label htmlFor="wallet-search">Find your wallet</label>
                <input
                  id="wallet-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Wallet or organization name"
                />
                <button
                  type="button"
                  onClick={search}
                  disabled={query.length < 2}
                >
                  Search registry
                </button>
              </div>
              <FieldError>{searchError}</FieldError>
              {wallets.length > 0 && (
                <ul className="wallet-results" aria-label="Registered wallets">
                  {wallets.map((wallet) => (
                    <WalletResult
                      key={wallet.id}
                      wallet={wallet}
                      selected={selectedWallet?.id === wallet.id}
                      onSelect={(selection) => {
                        setSelectedWallet(selection);
                        setWalletError('');
                      }}
                    />
                  ))}
                </ul>
              )}
              <FieldError>{walletError}</FieldError>
              <p className="registration-note">
                Not listed?{' '}
                <a href={config.registrationUrl}>Register your wallet</a> before
                continuing.
              </p>
            </div>
          </section>

          <section className="ledger-section reveal reveal-three">
            <div className="section-number">02</div>
            <div className="section-content">
              <h2>Identify the tester</h2>
              <p>
                We use these details to personalize the setup badge and result.
              </p>
              <div className="field-grid">
                <label>
                  <span>Your name</span>
                  <input
                    {...register('applicantName', {
                      required: 'Enter your name.',
                    })}
                    autoComplete="name"
                  />
                  <FieldError>{errors.applicantName?.message}</FieldError>
                </label>
                <label>
                  <span>Work email</span>
                  <input
                    {...register('applicantEmail', {
                      required: 'Enter a valid email address.',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Enter a valid email address.',
                      },
                    })}
                    type="email"
                    autoComplete="email"
                  />
                  <FieldError>{errors.applicantEmail?.message}</FieldError>
                </label>
              </div>
            </div>
          </section>

          <section className="ledger-section reveal reveal-four">
            <div className="section-number">03</div>
            <div className="section-content">
              <h2>Choose the capability</h2>
              <p>Verification includes issuing this run’s setup badge first.</p>
              <div className="capability-options">
                <label>
                  <input
                    type="radio"
                    value="ISSUING"
                    {...register('capability', { required: true })}
                  />
                  <span>
                    <strong>Certify issuing</strong>
                    <small>Receive a personalized OpenBadgeCredential.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    value="VERIFICATION"
                    {...register('capability', { required: true })}
                  />
                  <span>
                    <strong>Certify verification</strong>
                    <small>Issue the setup badge, then share it back.</small>
                  </span>
                </label>
              </div>
              {errors.capability && (
                <FieldError>Choose a capability.</FieldError>
              )}
            </div>
          </section>

          <div className="form-action">
            <FieldError>{submitError}</FieldError>
            <p>
              A new tab will open for the wallet interaction. Keep this page
              open until the result appears.
            </p>
            <button
              className="primary-action"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Preparing certification…' : 'Begin certification'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
SetupPage.propTypes = {
  api: PropTypes.shape({
    searchWallets: PropTypes.func.isRequired,
    createRun: PropTypes.func.isRequired,
    startRun: PropTypes.func.isRequired,
  }).isRequired,
  config: PropTypes.shape({
    brandName: PropTypes.string.isRequired,
    environmentName: PropTypes.string.isRequired,
    registrationUrl: PropTypes.string.isRequired,
  }).isRequired,
  onStarted: PropTypes.func.isRequired,
};

export default SetupPage;
