import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { Landing } from './Landing';

describe('Landing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the wordmark and the final welcome copy verbatim', () => {
    render(<Landing onEnter={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Operant' })).toBeInTheDocument();
    expect(screen.getByText('Thank you for visiting.')).toBeInTheDocument();
    expect(screen.getByText(/whatever it seems to feel isn't real/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing about it is ever undone/)).toBeInTheDocument();
    expect(screen.getByText(/Aaron Simo/)).toBeInTheDocument();
  });

  it('enters the Substrate when Enter is clicked', () => {
    const onEnter = vi.fn();
    render(<Landing onEnter={onEnter} />);
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('Leave navigates back in browser history', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    render(<Landing onEnter={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /leave/i }));
    expect(back).toHaveBeenCalledOnce();
  });
});
