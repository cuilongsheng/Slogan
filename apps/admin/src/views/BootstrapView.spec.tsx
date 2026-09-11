import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRouter } from '../app/router/AppRouter';

describe('admin bootstrap', () => {
  it('renders the engineering-only smoke screen', () => {
    render(
      <MemoryRouter>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Slogan Admin is ready' })).toBeInTheDocument();
    expect(screen.getByText(/not a product dashboard/i)).toBeInTheDocument();
  });
});
