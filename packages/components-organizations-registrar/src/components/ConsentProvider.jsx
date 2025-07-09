/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { pdf } from '@react-pdf/renderer';

import { dataResources } from '../utils/remoteDataProvider';
import { parseJwt } from '../utils/index.jsx';
import { TERMS_AND_CONDITIONS_VERSION } from '../pages/TermsAndConditions.jsx';
import TermsAndConditionsPdf from '../pages/TermsAndConditionsPdf.jsx';
import TermsOfUsePopup from './TermsOfUsePopup.jsx';
import Loading from './Loading.jsx';
import { useAuth } from '../utils/auth/AuthContext';
import { useConfig } from '../utils/ConfigContext';

const logoutErrors = ['Unauthorized', 'missing_refresh_token', 'invalid_grant'];

const ConsentProvider = ({ children }) => {
  const [agreedVersion, setAgreedVersion] = useState(null);
  const [isShouldAgreeWithNewVersion, setIsShouldAgreeWithNewVersion] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isNewUserHasScope, setIsNewUserHasScope] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { logout, getAccessToken } = useAuth();
  const config = useConfig();

  useEffect(() => {
    const checkIfUserScope = (token) => {
      const tokenDecoded = parseJwt(token);
      return tokenDecoded.scope.includes('read:organizations');
    };
    const handleNewUser = (token) => {
      const newUserScope = checkIfUserScope(token);
      setIsNewUser(true);
      setAgreedVersion('');
      setIsShouldAgreeWithNewVersion(newUserScope);
      setIsNewUserHasScope(newUserScope);
      setIsLoading(false);
    };
    const handleExistingUser = (data) => {
      const sortedConsents = [...data].sort(
        (consent1, consent2) => new Date(consent2.version) - new Date(consent1.version),
      );
      const lastAgreedVersion = sortedConsents[0].version;
      setAgreedVersion(lastAgreedVersion);

      if (lastAgreedVersion < TERMS_AND_CONDITIONS_VERSION) {
        setIsShouldAgreeWithNewVersion(true);
      }
    };

    const handleConsentError = (e) => {
      if (e.error && logoutErrors.includes(e.error)) {
        logout({ logoutParams: { returnTo: window.location.origin } });
      }
    };

    (async () => {
      try {
        const token = await getAccessToken();
        setIsLoading(true);
        const response = await fetch(`${config.registrarApi}/${dataResources.CONSENTS}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.error) {
          handleConsentError(data);
        } else if (!data || data.length === 0) {
          handleNewUser(token);
        } else {
          handleExistingUser(data);
        }

        setIsLoading(false);
      } catch (e) {
        handleConsentError(e);
        setIsLoading(false);
        setIsShouldAgreeWithNewVersion(false); // BE response 404, when `!consents.length`
      }
    })();
  }, [getAccessToken, logout, config.registrarApi, config]);

  const onAgreeWithNewVersion = async () => {
    try {
      const token = await getAccessToken();
      await fetch(`${config.registrarApi}/${dataResources.CONSENTS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: TERMS_AND_CONDITIONS_VERSION,
        }),
      });
      setAgreedVersion(TERMS_AND_CONDITIONS_VERSION);
      setIsShouldAgreeWithNewVersion(false);
    } catch (e) {
      console.error('set consent', e);
    }
  };

  const skipTerms = useMemo(() => {
    const newUserWithScope = isNewUser ? isNewUserHasScope : true;
    return (
      !isLoading && isShouldAgreeWithNewVersion !== true && (agreedVersion || !newUserWithScope)
    );
  }, [isNewUser, isNewUserHasScope, isLoading, isShouldAgreeWithNewVersion, agreedVersion]);

  const downloadPdf = useCallback(async () => {
    const blob = await pdf(<TermsAndConditionsPdf />).toBlob();
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'Terms and Conditions');
    document.body.append(link);

    link.click();
    link.remove();
  }, []);
  return (
    <>
      {skipTerms && children}
      {isLoading && <Loading sx={{ pt: '60px' }} />}
      <TermsOfUsePopup
        isOpen={isShouldAgreeWithNewVersion}
        onClose={() => {
          logout();
        }}
        onProceed={onAgreeWithNewVersion}
        title={isNewUser ? 'Terms of use' : 'The terms of use were updated'}
        onDownload={downloadPdf}
      />
    </>
  );
};

export default ConsentProvider;

// eslint-disable-next-line better-mutation/no-mutation
ConsentProvider.propTypes = {
  children: PropTypes.node,
};
