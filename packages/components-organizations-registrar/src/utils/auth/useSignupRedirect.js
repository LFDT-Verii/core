/*
 * Copyright 2025 Velocity Team
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
 *
 */
import { useLocation, useSearchParams } from 'react-router';
import { useStore } from 'react-admin';
import { useEffect } from 'react';
import { initTrace } from '../tracing.js';

const trace = initTrace('useSignupRedirect');
const REDIRECT_KEY = 'afterSignupRedirectUrl';

const useSignupRedirect = ({ auth }) => {
  const [searchParams] = useSearchParams();
  const signupUrlParam = searchParams.get('signup_url');

  const [signupUrl, setSignupUrl] = useStore('signupUrl', null);
  const isSignupProcess = signupUrlParam != null || signupUrl != null;

  const location = useLocation();

  useEffect(() => {
    trace({
      event: 'signup-redirect-state-changed',
      hasSignupUrlParam: signupUrlParam != null,
      hasStoredSignupUrl: signupUrl != null,
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      isSignupProcess,
    });
  }, [auth.isAuthenticated, auth.isLoading, isSignupProcess, signupUrl, signupUrlParam]);

  useEffect(() => {
    if (signupUrlParam !== signupUrl) {
      setSignupUrl(signupUrlParam);
    }
  }, [signupUrlParam, signupUrl, setSignupUrl]);
  // If a new signup URL is detected → start signup flow
  useEffect(() => {
    if (!signupUrl || signupUrlParam !== signupUrl) {
      return;
    }

    trace({ event: 'signup-url-redirect-requested', pathname: location.pathname });
    localStorage.setItem(REDIRECT_KEY, location.pathname);

    auth.logout().then(() => {
      window.location.replace(decodeURIComponent(signupUrl));
    });
  }, [signupUrl, signupUrlParam, location.pathname, auth]);

  return { isSignupProcess };
};

export default useSignupRedirect;
