import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { ViewControls } from './ViewControls';

describe('ViewControls', () => {
  const noop = () => {};

  it('offers the three viewpoints and marks the active one pressed', () => {
    render(<ViewControls mode="third" fov={55} onModeChange={noop} onFovChange={noop} />);
    expect(screen.getByRole('button', { name: /first person/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /third person/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /god view/i })).toBeInTheDocument();
  });

  it('changes viewpoint when a button is clicked', () => {
    const onModeChange = vi.fn();
    render(<ViewControls mode="third" fov={55} onModeChange={onModeChange} onFovChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /first person/i }));
    expect(onModeChange).toHaveBeenCalledWith('first');
  });

  it('shows a FOV slider for first/third person but not god view', () => {
    const { rerender } = render(
      <ViewControls mode="third" fov={55} onModeChange={noop} onFovChange={noop} />,
    );
    expect(screen.getByRole('slider', { name: /field of view/i })).toBeInTheDocument();

    rerender(<ViewControls mode="god" fov={55} onModeChange={noop} onFovChange={noop} />);
    expect(screen.queryByRole('slider', { name: /field of view/i })).toBeNull();
  });

  it('reports a numeric FOV when the slider moves', () => {
    const onFovChange = vi.fn();
    render(<ViewControls mode="first" fov={70} onModeChange={noop} onFovChange={onFovChange} />);
    fireEvent.change(screen.getByRole('slider', { name: /field of view/i }), {
      target: { value: '85' },
    });
    expect(onFovChange).toHaveBeenCalledWith(85);
  });
});
