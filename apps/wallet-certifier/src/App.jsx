import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { api as defaultApi } from './api';
import AppShell from './components/AppShell.jsx';
import SetupPage from './pages/SetupPage.jsx';
import { theme } from './theme';

const defaultConfig = {
  brandName: 'Velocity Network Foundation',
  environmentName: 'devnet',
  registrationUrl: 'https://velocitynetwork.foundation/',
};

const AppRoutes = ({ api, config }) => {
  const navigate = useNavigate();
  const onStarted = (run) => {
    sessionStorage.setItem(
      `wallet-certifier:${run.runId}`,
      JSON.stringify(run),
    );
    navigate(`/runs/${run.runId}`);
  };

  return (
    <Routes>
      <Route
        path="*"
        element={<SetupPage api={api} config={config} onStarted={onStarted} />}
      />
    </Routes>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
AppRoutes.propTypes = {
  api: PropTypes.object.isRequired,
  config: PropTypes.object.isRequired,
};

const App = ({ api = defaultApi }) => {
  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    let active = true;
    api
      .getConfig?.()
      .then((value) => {
        if (active) {
          setConfig(value);
        }
      })
      .catch(() => {});
    return () => {
      // eslint-disable-next-line better-mutation/no-mutation
      active = false;
    };
  }, [api]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppShell config={config}>
          <AppRoutes api={api} config={config} />
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
App.propTypes = { api: PropTypes.object };

export default App;
