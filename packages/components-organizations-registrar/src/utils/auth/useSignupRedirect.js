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

const useSignupRedirect = ({ auth, options = {} }) => {
  const [searchParams] = useSearchParams();
  const signupUrlParam = searchParams.get('signup_url');

  const [signupUrl, setSignupUrl] = useStore('signupUrl', null);

  const redirectKey = options.redirectKey ?? 'afterSignupRedirectUrl';
  const location = useLocation();

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

    // eslint-disable-next-line no-undef
    localStorage.setItem(redirectKey, location.pathname);

    auth.logout().then(() => {
      // eslint-disable-next-line no-undef
      window.location.replace(decodeURIComponent(signupUrl));
    });
  }, [signupUrl, signupUrlParam, redirectKey, location, auth]);

  useEffect(() => {
    if (signupUrl || auth.isLoading || auth.isAuthenticated) {
      return;
    }

    // eslint-disable-next-line no-undef
    const returnTo = localStorage.getItem(redirectKey) || location.pathname;

    auth.login({ appState: { returnTo } }).then(() => {
      // eslint-disable-next-line no-undef
      localStorage.removeItem(redirectKey);
    });
  }, [signupUrl, auth.isLoading, auth.isAuthenticated, auth, location, redirectKey]);

  return { isSignupProcess: signupUrl != null };
};

export default useSignupRedirect;
