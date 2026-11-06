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
import { useEffect, useRef } from 'react';
import { initTrace } from '../tracing.js';

const trace = initTrace('useSignupRedirect');
const REDIRECT_KEY = 'afterSignupRedirectUrl';

// The registrar API sets `signup_url` to an Auth0 password link. Follow only https links on the
// configured Auth0 domain, so a crafted link can't send the browser elsewhere or run script.
const toAuth0PasswordUrl = (signupUrl, authDomain) => {
  if (!signupUrl || !authDomain) {
    return null;
  }
  try {
    const url = new URL(decodeURIComponent(signupUrl));
    return url.protocol === 'https:' && url.host === authDomain ? url.href : null;
  } catch {
    return null;
  }
};

// An invitation to someone without an account carries an Auth0 password link in `signup_url`.
// Read it from the URL, not react-admin's store: this hook runs outside <Admin>, where that store
// isn't set up and drops writes. Any other `signup_url` is ignored, and the invitee signs in as usual.
const useSignupRedirect = ({ auth, authDomain }) => {
  const [searchParams] = useSearchParams();
  const signupUrl = toAuth0PasswordUrl(searchParams.get('signup_url'), authDomain);
  const isSignupProcess = signupUrl != null;

  const location = useLocation();
  const hasStartedRedirect = useRef(false);

  useEffect(() => {
    trace({
      event: 'signup-redirect-state-changed',
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      isSignupProcess,
    });
  }, [auth.isAuthenticated, auth.isLoading, isSignupProcess]);

  // Logging out changes `auth`, which runs this effect again, so start the redirect only once.
  useEffect(() => {
    if (!signupUrl || hasStartedRedirect.current) {
      return;
    }
    // eslint-disable-next-line better-mutation/no-mutation
    hasStartedRedirect.current = true;

    trace({ event: 'signup-url-redirect-requested', pathname: location.pathname });
    localStorage.setItem(REDIRECT_KEY, location.pathname);

    auth.logout({ source: 'signup-redirect' }).then(() => {
      window.location.replace(signupUrl);
    });
  }, [signupUrl, location.pathname, auth]);

  return { isSignupProcess };
};

export default useSignupRedirect;
