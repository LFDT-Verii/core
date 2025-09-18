import * as matchers from '@testing-library/jest-dom/matchers';
import { describe, it, mock, before } from 'node:test';
import { expect } from 'expect';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockOnSave = mock.fn();
const mockOnClose = mock.fn();
const mockUseIsIssuingInspection = mock.fn(() => ({ isIssuingOrInspection: false, isCAO: false }));

mock.module('@/pages/services/hooks/useIsIssuingInspection', {
  namedExports: {
    useIsIssuingInspection: mockUseIsIssuingInspection,
  },
  defaultExport: mockUseIsIssuingInspection,
});
expect.extend(matchers);

// eslint-disable-next-line react/prop-types
const InterceptOnCreateMock = ({ isInterceptOnCreateOpen, onClose }) => {
  return isInterceptOnCreateOpen ? (
    <div data-testid="intercept-popup">
      Intercept Active
      <button onClick={onClose}>Close Intercept</button>
    </div>
  ) : null;
};

describe('ServicesEdit', () => {
  let ServicesEdit;
  before(async () => {
    ServicesEdit = (await import('../ServicesEdit.jsx')).default;
  });
  const selectedService = {
    id: 'test-id',
    type: 'some-type-id',
    serviceEndpoint: 'https://example.com/test#fragment',
  };

  it('renders popup with form and allows modifying', async () => {
    render(
      <MemoryRouter>
        <ServicesEdit
          selectedService={selectedService}
          onSave={mockOnSave}
          onClose={mockOnClose}
          InterceptOnCreate={InterceptOnCreateMock}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Edit your service details here:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service endpoint URL/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/Service endpoint URL/i);
    fireEvent.change(input, { target: { value: 'https://changed.com' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() =>
      expect(mockOnSave.mock.calls[0].arguments[0]).toEqual({
        id: 'test-id',
        serviceEndpoint: 'https://changed.com',
        type: 'some-type-id',
      }),
    );
  });

  it('shows InterceptOnCreate when triggered by save', async () => {
    render(
      <MemoryRouter>
        <ServicesEdit
          selectedService={selectedService}
          onSave={mockOnSave}
          onClose={mockOnClose}
          InterceptOnCreate={InterceptOnCreateMock}
        />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Service endpoint URL/i);
    fireEvent.change(input, { target: { value: 'https://changed.com' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await screen.findByTestId('intercept-popup');
  });

  it('shows validation error if service endpoint is empty', async () => {
    render(
      <MemoryRouter>
        <ServicesEdit
          selectedService={{ ...selectedService, serviceEndpoint: '' }}
          onSave={mockOnSave}
          onClose={mockOnClose}
          InterceptOnCreate={InterceptOnCreateMock}
        />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Service endpoint URL/i);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => screen.findByText('Service endpoint URL field is required'));
  });

  it('shows URL validation error if isCAO is true and URL is invalid', async () => {
    mockUseIsIssuingInspection.mock.mockImplementationOnce(() => ({
      isIssuingOrInspection: false,
      isCAO: true,
    }));

    render(
      <MemoryRouter>
        <ServicesEdit
          selectedService={{ ...selectedService, serviceEndpoint: '' }}
          onSave={mockOnSave}
          onClose={mockOnClose}
          InterceptOnCreate={InterceptOnCreateMock}
        />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Service endpoint URL/i);
    fireEvent.change(input, { target: { value: 'not-a-valid-url' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    const error = await screen.findByText('Please type in a valid URL');
    expect(error).toBeInTheDocument();
  });
});
