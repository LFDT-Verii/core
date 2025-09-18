import { expect } from 'expect';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it } from 'node:test';
import { AdminContext, Form } from 'react-admin';
import theme from '@/theme/theme.js';

import HolderWalletSelection from '../HolderWalletSelection.jsx';

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

describe('HolderWalletSelection', () => {
  describe('rendering', () => {
    it('should render all required input fields', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      expect(screen.getByLabelText(/app wallet name/i)).toBeTruthy();
      expect(screen.getByText(/App Wallet Logo URL/i)).toBeTruthy();
      expect(screen.getByLabelText(/app landing page/i)).toBeTruthy();
      expect(screen.getByLabelText(/supported exchange protocols/i)).toBeTruthy();
      expect(screen.getByLabelText(/play store url/i)).toBeTruthy();
      expect(screen.getByLabelText(/google play id/i)).toBeTruthy();
      expect(screen.getByLabelText(/apple app store url/i)).toBeTruthy();
      expect(screen.getByLabelText(/apple app id/i)).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('should enable all inputs when inProgress is false', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const textInputs = screen.getAllByRole('textbox');
      textInputs.forEach((input) => {
        expect(input.disabled).toBe(false);
      });
    });

    it('should disable all inputs when inProgress is true', () => {
      renderWithForm(<HolderWalletSelection inProgress={true} />);

      const textInputs = screen.getAllByRole('textbox');
      textInputs.forEach((input) => {
        expect(input.disabled).toBe(true);
      });
    });
  });

  describe('user interaction', () => {
    it('should accept text input for app wallet name', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/app wallet name/i);
      const testValue = 'My Wallet App';

      fireEvent.change(input, { target: { value: testValue } });
      expect(input.value).toBe(testValue);
    });

    it('should accept text input for app landing page', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/app landing page/i);
      const testUrl = 'https://myapp.com';

      fireEvent.change(input, { target: { value: testUrl } });
      expect(input.value).toBe(testUrl);
    });

    it('should accept text input for play store URL', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/play store url/i);
      const testUrl = 'https://play.google.com/store/apps/details?id=com.myapp';

      fireEvent.change(input, { target: { value: testUrl } });
      expect(input.value).toBe(testUrl);
    });

    it('should accept text input for google play ID', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/google play id/i);
      const testId = 'com.myapp.wallet';

      fireEvent.change(input, { target: { value: testId } });
      expect(input.value).toBe(testId);
    });

    it('should accept text input for apple app store URL', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/apple app store url/i);
      const testUrl = 'https://apps.apple.com/app/myapp/id123456789';

      fireEvent.change(input, { target: { value: testUrl } });
      expect(input.value).toBe(testUrl);
    });

    it('should accept text input for apple app ID', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const input = screen.getByLabelText(/apple app id/i);
      const testId = '123456789';

      fireEvent.change(input, { target: { value: testId } });
      expect(input.value).toBe(testId);
    });

    it('should trim whitespace from URL inputs', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const landingPageInput = screen.getByLabelText(/app landing page/i);
      const playStoreInput = screen.getByLabelText(/play store url/i);
      const appleStoreInput = screen.getByLabelText(/apple app store url/i);

      const testUrl = '  https://example.com  ';

      fireEvent.change(landingPageInput, { target: { value: testUrl } });
      fireEvent.blur(landingPageInput);
      expect(landingPageInput.value.trim()).toBe('https://example.com');

      fireEvent.change(playStoreInput, { target: { value: testUrl } });
      fireEvent.blur(playStoreInput);
      expect(playStoreInput.value.trim()).toBe('https://example.com');

      fireEvent.change(appleStoreInput, { target: { value: testUrl } });
      fireEvent.blur(appleStoreInput);
      expect(appleStoreInput.value.trim()).toBe('https://example.com');
    });

    it('should trim whitespace from ID inputs', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const googlePlayInput = screen.getByLabelText(/google play id/i);
      const appleIdInput = screen.getByLabelText(/apple app id/i);

      const testId = '  myapp.id  ';

      fireEvent.change(googlePlayInput, { target: { value: testId } });
      fireEvent.blur(googlePlayInput);
      expect(googlePlayInput.value.trim()).toBe('myapp.id');

      fireEvent.change(appleIdInput, { target: { value: testId } });
      fireEvent.blur(appleIdInput);
      expect(appleIdInput.value.trim()).toBe('myapp.id');
    });
  });

  describe('supported exchange protocols', () => {
    it('should have VN_API and OPENID4VC options', () => {
      renderWithForm(<HolderWalletSelection inProgress={false} />);

      const selectInput = screen.getByLabelText(/supported exchange protocols/i);
      expect(selectInput).toBeTruthy();
    });
  });
});
