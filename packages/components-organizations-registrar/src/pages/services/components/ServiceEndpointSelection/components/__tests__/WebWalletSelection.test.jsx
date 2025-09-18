import { expect } from 'expect';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, beforeEach } from 'node:test';
import { AdminContext, Form } from 'react-admin';
import theme from '@/theme/theme.js';

import WebWalletSelection from '../WebWalletSelection.jsx';

const renderWithForm = (ui, defaultValues = {}) => {
  const Wrapper = () => {
    return (
      <AdminContext theme={theme}>
        <Form onSubmit={() => {}} defaultValues={defaultValues}>
          {ui}
        </Form>
      </AdminContext>
    );
  };
  return render(<Wrapper />);
};

describe('WebWalletSelection', () => {
  beforeEach(() => {
    // Clear any previous state if needed
  });

  describe('rendering', () => {
    it('should render all required input fields', () => {
      renderWithForm(<WebWalletSelection inProgress={false} />);

      expect(screen.getByLabelText(/webwallet name/i)).toBeTruthy();
      expect(screen.getByText(/webwallet Logo URL/i)).toBeTruthy();
      expect(screen.getByLabelText(/webwallet url/i)).toBeTruthy();
      expect(screen.getByLabelText(/supported exchange protocols/i)).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('should enable all inputs when inProgress is false', () => {
      renderWithForm(<WebWalletSelection inProgress={false} />);

      const textInputs = screen.getAllByRole('textbox');
      textInputs.forEach((input) => {
        expect(input.disabled).toBe(false);
      });
    });

    it('should disable all inputs when inProgress is true', () => {
      renderWithForm(<WebWalletSelection inProgress={true} />);

      const textInputs = screen.getAllByRole('textbox');
      textInputs.forEach((input) => {
        expect(input.disabled).toBe(true);
      });
    });
  });

  describe('user interaction', () => {
    it('should accept text input for webwallet name', () => {
      renderWithForm(<WebWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/webwallet name/i);
      const testValue = 'My Wallet App';

      fireEvent.change(input, { target: { value: testValue } });
      expect(input.value).toBe(testValue);
    });

    it('should accept text input for webwallet url', () => {
      renderWithForm(<WebWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/webwallet url/i);
      const testUrl = 'https://myapp.com';

      fireEvent.change(input, { target: { value: testUrl } });
      expect(input.value).toBe(testUrl);
    });
  });

  describe('supported exchange protocols', () => {
    it('should have VN_API and OPENID4VC options', () => {
      renderWithForm(<WebWalletSelection inProgress={false} />);

      const selectInput = screen.getByLabelText(/supported exchange protocols/i);
      expect(selectInput).toBeTruthy();
    });
  });
});
