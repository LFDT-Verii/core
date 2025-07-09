import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminContext, memoryStore } from 'react-admin';

import SetKeyIndividuals from '../SetKeyIndividuals.jsx';

const defaultData = {
  adminEmail: 'admin@example.com',
  adminGivenName: 'AdminFirst',
  adminFamilyName: 'AdminLast',
  adminTitle: 'Administrator',
  signatoryEmail: 'sign@example.com',
  signatoryGivenName: 'SignerFirst',
  signatoryFamilyName: 'SignerLast',
  signatoryTitle: 'Signatory Officer',
};

describe('SetKeyIndividuals', () => {
  const mockSubmit = jest.fn();
  const mockBack = jest.fn();

  const renderComponent = (defaultValues) =>
    render(
      <AdminContext store={memoryStore()}>
        <SetKeyIndividuals
          onSubmit={mockSubmit}
          onBack={mockBack}
          defaultValues={defaultValues}
          loading={false}
        >
          <div>Child content</div>
        </SetKeyIndividuals>
      </AdminContext>,
    );

  it('renders all form fields', () => {
    renderComponent({});
    expect(screen.getByText('Administrator’s Details')).toBeInTheDocument();
    const emailFieldRequired = screen.getAllByLabelText('Email *');
    expect(emailFieldRequired).toHaveLength(1);
    expect(screen.getByLabelText('First name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name *')).toBeInTheDocument();

    expect(screen.getByText('Signatory Authority’s Details')).toBeInTheDocument();
    const emailField = screen.getAllByLabelText('Email');
    expect(emailField).toHaveLength(1);
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();

    const jobTitleField = screen.getAllByLabelText('Job Title');
    expect(jobTitleField).toHaveLength(2);
  });

  it('renders default values', () => {
    renderComponent(defaultData);

    expect(screen.getByLabelText('Email *')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('First name *')).toHaveValue('AdminFirst');
    expect(screen.getByLabelText('Last name *')).toHaveValue('AdminLast');

    expect(screen.getByLabelText('Email')).toHaveValue('sign@example.com');
    expect(screen.getByLabelText('First name')).toHaveValue('SignerFirst');
    expect(screen.getByLabelText('Last name')).toHaveValue('SignerLast');

    expect(screen.getAllByLabelText('Job Title')[0]).toHaveValue('Administrator');
    expect(screen.getAllByLabelText('Job Title')[1]).toHaveValue('Signatory Officer');
  });

  it('calls onBack when Back button is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders the submit button with text "Invite Client"', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /invite client/i })).toBeInTheDocument();
  });

  it('renders tooltip hints for both sections', () => {
    renderComponent({});

    expect(
      screen.getByLabelText(
        // eslint-disable-next-line max-len
        'The administrator is the person managing the organization’s registration in the Velocity Network Registrar. Typically, this would be the person filling in the details of the organization in the registrar.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        // eslint-disable-next-line max-len
        'The signatory is the person authorized to sign the organization’s participation agreement in the Velocity Network. Once the administrator registers the organization in the Velocity Network Registrar, an email will be sent to the signatory authority, asking them to accept the registration and confirm the participation agreement.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        // eslint-disable-next-line max-len
        'Please ensure that the email address provided is a personal corporate email (e.g., sam@acme.com). Generic or role-based email addresses (e.g., manager@acme.com) will not be accepted.',
      ),
    ).toBeInTheDocument();
  });
});
