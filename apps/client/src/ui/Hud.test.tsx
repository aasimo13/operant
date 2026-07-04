import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hud } from './Hud';

describe('Hud', () => {
  it('renders the Operant wordmark', () => {
    render(<Hud />);
    expect(screen.getByRole('heading', { name: 'Operant' })).toBeInTheDocument();
  });

  it('exposes a labelled overlay region for accessibility', () => {
    render(<Hud />);
    expect(screen.getByLabelText('Operant instrument overlay')).toBeInTheDocument();
  });
});
