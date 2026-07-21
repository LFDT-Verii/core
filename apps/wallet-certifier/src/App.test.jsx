import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App.jsx';

test('renders the wallet certifier heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /wallet certifier/i }),
  ).toBeTruthy();
});
