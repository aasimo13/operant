import { useEffect, useRef } from 'react';
import type { NarrationLine } from '@operant/core';

/**
 * The Sim's "transcript of consciousness": a scrolling log of narrator lines so
 * an Observer can watch its worldview evolve, not just catch one line at a time.
 * Monospace and clinical, grounding the mysticism (see DESIGN.md). Auto-scrolls
 * to the newest line.
 */
export function TranscriptPanel({ lines }: { lines: NarrationLine[] }): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Guarded: jsdom (tests) doesn't implement scrollIntoView.
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lines.length]);

  return (
    <div
      className="transcript"
      role="log"
      aria-label="Transcript of consciousness"
      aria-live="polite"
    >
      <div className="transcript__title">Transcript</div>
      <div className="transcript__lines">
        {lines.length === 0 ? (
          <p className="transcript__empty">Awaiting first utterance…</p>
        ) : (
          lines.map((line, i) => (
            <p key={`${line.tick}-${i}`} className="transcript__line">
              <span className="transcript__tick">{line.tick}</span>
              {line.text}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
