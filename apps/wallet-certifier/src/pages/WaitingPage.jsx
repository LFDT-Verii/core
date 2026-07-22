import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import useRunPolling from '../hooks/useRunPolling';
import ResultPage from './ResultPage.jsx';

const copyFor = (state) => {
  if (state === 'DISCLOSING') {
    return {
      eyebrow: 'Verification / disclosure',
      heading: 'Share the setup badge.',
      body: 'Approve the request in your wallet and include the badge issued in the first step. Any additional credential types are accepted.',
      status: 'Waiting for your wallet to share credentials',
    };
  }
  return {
    eyebrow: 'Certification / issuing',
    heading: 'Issue the setup badge.',
    body: 'Approve the personalized OpenBadgeCredential in your selected wallet.',
    status: 'Waiting for your wallet to issue the credential',
  };
};

const formatRemaining = (deadline, now) => {
  const milliseconds = Math.max(0, new Date(deadline).getTime() - now);
  const seconds = Math.ceil(milliseconds / 1000);
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
};

const remaining = (deadline, now) => {
  if (!deadline) {
    return '10:00';
  }
  const initialTime = new Date(deadline).getTime() - 10 * 60 * 1000;
  return formatRemaining(deadline, now || initialTime);
};

// This component intentionally models the finite UI states in one visible
// orchestration point; the rendering details live in focused child components.
// eslint-disable-next-line complexity
const WaitingPage = ({ api, runId, initialRun }) => {
  const { run, error } = useRunPolling({
    api,
    runId,
    token: initialRun?.interactionToken,
  });
  const [interaction, setInteraction] = useState(initialRun?.interaction);
  const [now, setNow] = useState(0);
  const [startingDisclosure, setStartingDisclosure] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (
    run &&
    ['PASSED', 'FAILED', 'REJECTED', 'TIMED_OUT', 'ERROR'].includes(run.state)
  ) {
    return <ResultPage run={run} />;
  }

  const state = interaction?.state ?? run?.state ?? 'ISSUING';
  const content = copyFor(state);
  const preparingDisclosure =
    run?.state === 'PREPARING_DISCLOSURE' &&
    interaction?.state !== 'DISCLOSING';

  const continueToDisclosure = async () => {
    const walletTab = window.open('about:blank', 'wallet-certifier-wallet');
    if (walletTab) {
      // eslint-disable-next-line better-mutation/no-mutation
      walletTab.opener = null;
    }
    setStartingDisclosure(true);
    setStartError('');
    try {
      const value = await api.startRun(runId, initialRun?.interactionToken);
      if (walletTab) {
        // eslint-disable-next-line better-mutation/no-mutation
        walletTab.location.href = value.redirectUrl;
      }
      setInteraction(value);
      sessionStorage.setItem(
        `wallet-certifier:${runId}`,
        JSON.stringify({ ...initialRun, interaction: value }),
      );
    } catch (requestError) {
      walletTab?.close();
      setStartError(requestError.message);
    } finally {
      setStartingDisclosure(false);
    }
  };

  if (preparingDisclosure) {
    return (
      <main className="waiting-workspace">
        <section className="transition-ledger">
          <p className="eyebrow">Verification / setup complete</p>
          <h1>Setup badge issued.</h1>
          <p>
            Continue when you are ready to share this exact badge back for
            verification. A new wallet tab will open.
          </p>
          {startError && <p className="field-error">{startError}</p>}
          <button
            type="button"
            className="primary-action"
            onClick={continueToDisclosure}
            disabled={startingDisclosure}
          >
            {startingDisclosure
              ? 'Preparing request…'
              : 'Continue to verification'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="waiting-workspace">
      <section className="waiting-copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.heading}</h1>
        <p>{content.body}</p>
        <div className="waiting-warning">
          <strong>Do not close this page.</strong>
          <span>The result will appear here when processing is complete.</span>
        </div>
        <div className="progress-rule" aria-hidden="true">
          <span />
        </div>
        <p className="live-status" role="status">
          {content.status}
        </p>
        {(error || startError) && (
          <p className="field-error">{error || startError}</p>
        )}
      </section>
      <aside className="wallet-action">
        <p className="eyebrow">Wallet action</p>
        <div className="countdown">
          <span>Time remaining</span>
          <strong>{remaining(interaction?.actionDeadline, now)}</strong>
        </div>
        {interaction?.qrValue && (
          <div className="qr-field">
            <QRCodeSVG
              value={interaction.qrValue}
              size={188}
              bgColor="#faf7f0"
              fgColor="#0d0d0c"
              title="Wallet QR code"
            />
          </div>
        )}
        <p>Scan with your wallet if the app did not open automatically.</p>
        {interaction?.redirectUrl && (
          <a
            className="secondary-action"
            href={interaction.redirectUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open wallet interaction
          </a>
        )}
      </aside>
    </main>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
WaitingPage.propTypes = {
  api: PropTypes.object.isRequired,
  runId: PropTypes.string.isRequired,
  initialRun: PropTypes.object,
};

export default WaitingPage;
