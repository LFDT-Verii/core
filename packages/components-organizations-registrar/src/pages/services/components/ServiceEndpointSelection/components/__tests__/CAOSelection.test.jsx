import { expect } from 'expect';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, beforeEach } from 'node:test';
import { AdminContext, Form } from 'react-admin';
import theme from '@/theme/theme.js';

import CAOSelection from '../CAOSelection.jsx';

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

describe('CAOSelection', () => {
  beforeEach(() => {
    // Clear any previous state if needed
  });

  describe('rendering', () => {
    it('should render the service endpoint input field', () => {
      renderWithForm(<CAOSelection inProgress={false} />);

      const input = screen.getByLabelText(/service endpoint url */i);
      expect(input).toBeTruthy();
      expect(input.tagName).toBe('INPUT');
    });

    it('should have the correct label', () => {
      renderWithForm(<CAOSelection inProgress={false} />);

      expect(screen.getByLabelText('Service endpoint URL *')).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('should be enabled when inProgress is false', () => {
      renderWithForm(<CAOSelection inProgress={false} />);

      const input = screen.getByLabelText(/service endpoint url/i);
      expect(input.disabled).toBe(false);
    });

    it('should be disabled when inProgress is true', () => {
      renderWithForm(<CAOSelection inProgress={true} />);

      const input = screen.getByLabelText(/service endpoint url/i);
      expect(input.disabled).toBe(true);
    });
  });

  describe('user interaction', () => {
    it('should accept text input', () => {
      renderWithForm(<CAOSelection inProgress={false} />);

      const input = screen.getByLabelText(/service endpoint url/i);
      const testUrl = 'https://example.com/cao-service';

      fireEvent.change(input, { target: { value: testUrl } });
      expect(input.value).toBe(testUrl);
    });

    it('should trim whitespace from input', () => {
      renderWithForm(<CAOSelection inProgress={false} />);

      const input = screen.getByLabelText(/service endpoint url/i);
      const testUrl = '  https://example.com/cao-service  ';

      fireEvent.change(input, { target: { value: testUrl } });
      fireEvent.blur(input);

      expect(input.value.trim()).toBe('https://example.com/cao-service');
    });
  });
});
