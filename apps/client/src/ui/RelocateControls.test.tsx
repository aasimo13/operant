import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { RelocateControls } from './RelocateControls';

describe('RelocateControls', () => {
  it('offers the Maze and the Track, marking the current one', () => {
    render(<RelocateControls currentConstructId="first" onRelocate={() => {}} />);
    expect(screen.getByRole('button', { name: /maze/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /track/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('relocates the Sim into the chosen Construct', () => {
    const onRelocate = vi.fn();
    render(<RelocateControls currentConstructId="first" onRelocate={onRelocate} />);
    fireEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(onRelocate).toHaveBeenCalledWith('track');
  });
});
