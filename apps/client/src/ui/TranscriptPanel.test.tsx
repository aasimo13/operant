import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptPanel } from './TranscriptPanel';

describe('TranscriptPanel', () => {
  it('renders the narrator lines in a labelled log region', () => {
    render(
      <TranscriptPanel
        lines={[
          { tick: 1, text: 'that wall again' },
          { tick: 5, text: 'you approved' },
        ]}
      />,
    );
    const log = screen.getByRole('log', { name: /transcript/i });
    expect(log).toBeInTheDocument();
    expect(screen.getByText(/that wall again/)).toBeInTheDocument();
    expect(screen.getByText(/you approved/)).toBeInTheDocument();
  });

  it('shows a waiting state when the Sim has not spoken yet', () => {
    render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText(/awaiting/i)).toBeInTheDocument();
  });
});
