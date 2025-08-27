import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { describe, it } from 'node:test';
import theme from '@/theme/theme.js';
import { AdminContext } from 'react-admin';
import { LinkedInRegistrationInput } from '../components/LinkedInRegistrationInput.jsx';

expect.extend(matchers);

describe('LinkedInRegistrationInput', () => {
  const formData = {
    registrationNumbers: [
      { authority: 'DunnAndBradstreet', number: '12345' },
      { authority: 'LinkedIn', number: 'linkedin-abc' },
    ],
  };

  const renderWithForm = (ui, defaultValues = {}) => {
    // eslint-disable-next-line react/prop-types
    const Wrapper = ({ children }) => {
      const methods = useForm({ defaultValues });
      return (
        <AdminContext theme={theme}>
          <FormProvider {...methods}>
            <form>{children}</form>
          </FormProvider>
        </AdminContext>
      );
    };
    return render(ui, { wrapper: Wrapper });
  };

  it('renders the LinkedIn input with empty formData', () => {
    renderWithForm(<LinkedInRegistrationInput formData={{}} />);
    expect(screen.getByLabelText(/LinkedIn Company Page ID/i)).toBeInTheDocument();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe('');
  });
  it('renders the input with correct LinkedIn number', () => {
    renderWithForm(<LinkedInRegistrationInput formData={formData} />, formData);
    expect(screen.getByLabelText(/LinkedIn Company Page ID/i)).toBeInTheDocument();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe('linkedin-abc');
  });
  it('updates the LinkedIn number in formData', () => {
    renderWithForm(<LinkedInRegistrationInput formData={formData} />, formData);
    const input = screen.getByLabelText(/LinkedIn Company Page ID/i);
    expect(input.value).toBe('linkedin-abc');

    input.value = 'new-linkedin-id';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.value).toBe('new-linkedin-id');
  });
});
