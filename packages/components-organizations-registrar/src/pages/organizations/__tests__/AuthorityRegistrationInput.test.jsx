import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  AuthorityRegistrationInput,
  registrationNumbers,
} from '../components/AuthorityRegistrationInput.jsx';

const renderWithForm = (ui, defaultValues = {}) => {
  // eslint-disable-next-line react/prop-types
  const Wrapper = ({ children }) => {
    const methods = useForm({ defaultValues });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
  return render(ui, { wrapper: Wrapper });
};
describe('AuthorityRegistrationInput', () => {
  it('renders all authority radio buttons', () => {
    renderWithForm(<AuthorityRegistrationInput />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    Object.values(registrationNumbers).forEach(({ label }) => {
      const radio = screen.getByLabelText(label);
      fireEvent.click(radio);
      expect(radio).toBeChecked();
    });
  });
  it('check DunnAndBradstreet selected as default', () => {
    renderWithForm(<AuthorityRegistrationInput />);
    expect(screen.getByLabelText(registrationNumbers.DunnAndBradstreet.label)).toBeChecked();
  });

  it('shows only one textbox and allows input', () => {
    renderWithForm(<AuthorityRegistrationInput />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(1);

    fireEvent.change(inputs[0], { target: { value: '123456' } });
    expect(inputs[0].value).toBe('123456');
  });

  it('switches to NationalAuthority and shows both number and uri inputs', () => {
    renderWithForm(<AuthorityRegistrationInput />);
    const radio = screen.getByLabelText(registrationNumbers.NationalAuthority.label);
    fireEvent.click(radio);
    expect(radio).toBeChecked();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(
      screen.getByLabelText(/Local Country Registration Authority Website/i),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Local Country Registration ID/i)).toHaveLength(2);
  });

  it('renders vertical orientation properly', () => {
    renderWithForm(<AuthorityRegistrationInput orientation="vertical" />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});
