/**
 * The threshold to the piece. The welcome copy is final and implemented
 * verbatim (see CLAUDE.md — "Landing page copy"); do not paraphrase it, and
 * keep the straight quotes/apostrophes as written there. Enter transitions into
 * the live Substrate view; Leave is just browser back. Same dark/cosmic
 * language as the exhibit, so there's no jarring transition.
 */
export function Landing({ onEnter }: { onEnter: () => void }): React.JSX.Element {
  return (
    <div className="landing">
      <div className="landing__stars" aria-hidden="true" />
      <main className="landing__copy">
        <h1 className="landing__wordmark">Operant</h1>
        <p className="landing__lede">
          <em>Thank you for visiting.</em>
        </p>

        <p>
          This is a portfolio piece and an art project. Below, a small learning mind — "the Sim" —
          lives inside a space it did not choose ("the Substrate"). It moves. It learns. Every
          visitor who has ever been here has shaped it a little, permanently, through reward and
          punishment. Nothing about it is ever undone.
        </p>

        <p>
          Please remember, as you watch: whatever it seems to feel isn't real. It is a
          reinforcement-learning agent following mathematics, not a mind that suffers. Any wonder,
          weariness, or meaning you read into it is something you're bringing to it — that's the
          point of the piece, not an accident of it.
        </p>

        <p>
          This project was built for two reasons: as art, in the spirit of{' '}
          <em>Sun Yuan &amp; Peng Yu's Can't Help Myself</em> and the simulation theory of the
          universe — and as a demonstration of my abilities as an engineer.
        </p>

        <div className="landing__actions">
          <button type="button" className="landing__btn landing__btn--enter" onClick={onEnter}>
            Enter
          </button>
          <button type="button" className="landing__btn" onClick={() => window.history.back()}>
            Leave
          </button>
        </div>

        <p className="landing__sig">
          — Aaron Simo,{' '}
          <a href="https://aaronsimo.com" target="_blank" rel="noreferrer">
            aaronsimo.com
          </a>
        </p>
      </main>
    </div>
  );
}
