import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { LinkedInRegistrationInput } from '../components/LinkedInRegistrationInput.jsx';

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
      return <FormProvider {...methods}>{children}</FormProvider>;
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
