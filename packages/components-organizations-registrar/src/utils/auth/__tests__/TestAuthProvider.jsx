import { mock } from 'node:test';
import { AuthContext } from '@/utils/auth/AuthContext';

// eslint-disable-next-line react/prop-types
export const TestAuthProvider = ({ children }) => (
  <AuthContext.Provider
    value={{
      isLoading: false,
      isAuthenticated: true,
      user: { sub: 'user_123' },
      loginWithRedirect: mock.fn(),
      getAccessToken: mock.fn(() => Promise.resolve('1234')),
      getAccessTokenWithPopup: mock.fn(() => Promise.resolve('1234')),
      logout: mock.fn(),
    }}
  >
    {children}
  </AuthContext.Provider>
);
