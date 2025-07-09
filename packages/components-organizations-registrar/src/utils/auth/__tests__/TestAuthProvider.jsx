import { AuthContext } from '../AuthContext';

// eslint-disable-next-line react/prop-types
export const TestAuthProvider = ({ children }) => (
  <AuthContext.Provider
    value={{
      isLoading: false,
      isAuthenticated: true,
      user: { sub: 'user_123' },
      loginWithRedirect: jest.fn(),
      getAccessToken: jest.fn(() => Promise.resolve('1234')),
      getAccessTokenWithPopup: jest.fn(() => Promise.resolve('1234')),
      logout: jest.fn(),
    }}
  >
    {children}
  </AuthContext.Provider>
);
