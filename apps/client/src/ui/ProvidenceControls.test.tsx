import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { ProvidenceControls } from './ProvidenceControls';

describe('ProvidenceControls', () => {
  it('offers reward and punish, each firing its handler', () => {
    const onReward = vi.fn();
    const onPunish = vi.fn();
    render(<ProvidenceControls onReward={onReward} onPunish={onPunish} />);

    fireEvent.click(screen.getByRole('button', { name: /reward/i }));
    fireEvent.click(screen.getByRole('button', { name: /punish/i }));

    expect(onReward).toHaveBeenCalledOnce();
    expect(onPunish).toHaveBeenCalledOnce();
  });

  it('labels itself as Providence for the Observer', () => {
    render(<ProvidenceControls onReward={() => {}} onPunish={() => {}} />);
    expect(screen.getByLabelText(/providence/i)).toBeInTheDocument();
  });
});
