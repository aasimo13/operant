// A faithful in-page stand-in for the simulation host, installed before the app
// boots. It replaces window.WebSocket with a fake that speaks the same protocol:
// a welcome snapshot on connect, then a tick roughly every 250ms, and it records
// every outbound client message on window.__operantSent for assertions. Enough
// to exercise the client's real flows without a live server.
(() => {
  const wear = { baselineWear: 0.2, recentStrain: 0.1, wear: 0.24 };
  const chronicle = {
    age: 4242,
    goalsReached: 7,
    wallBumps: 12,
    rewards: 3,
    punishments: 5,
    interventions: 1,
    distance: 380,
    worldsEndured: 2,
    recentWorlds: [
      { name: 'The First Construct', enteredAtTick: 0 },
      { name: 'The Circuit', enteredAtTick: 2000 },
    ],
  };
  const construct = {
    id: 'first',
    name: 'The First Construct',
    width: 10,
    height: 10,
    walls: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => false)),
    checkpoints: [],
  };

  let tick = 4242;
  const sent = [];
  window.__operantSent = sent;
  window.__operantSockets = [];

  const goal = { x: 9, y: 9 };
  const stateAt = (x, y) => ({ position: { x, y }, goal, tickCount: tick, epsilon: 0.12, wear });

  class FakeWS {
    constructor(url) {
      this.url = url;
      this.readyState = FakeWS.CONNECTING;
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      window.__operantSockets.push(this);
      setTimeout(() => {
        this.readyState = FakeWS.OPEN;
        if (this.onopen) this.onopen({});
        this._emit({
          type: 'welcome',
          construct,
          state: stateAt(0, 0),
          recent: [],
          transcript: [{ tick: tick - 3, text: 'I keep on. Only the going.' }],
          queue: [],
          chronicle,
          watching: 1,
        });
        this._timer = setInterval(() => this._tick(), 250);
      }, 25);
    }
    _emit(obj) {
      if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
    }
    _tick() {
      if (this.readyState !== FakeWS.OPEN) return;
      tick += 1;
      const x = tick % 10;
      const y = Math.floor(tick / 10) % 10;
      const px = (x + 9) % 10;
      this._emit({
        type: 'tick',
        state: stateAt(x, y),
        record: {
          tick,
          action: 'right',
          from: { x: px, y },
          to: { x, y },
          reward: -1,
          hitWall: false,
          reachedGoal: false,
          goalRelocated: false,
        },
        providence: null,
      });
    }
    send(data) {
      try {
        sent.push(JSON.parse(data));
      } catch {
        sent.push(data);
      }
    }
    close() {
      this.readyState = FakeWS.CLOSED;
      clearInterval(this._timer);
      if (this.onclose) this.onclose({});
    }
    addEventListener() {}
    removeEventListener() {}
  }
  FakeWS.CONNECTING = 0;
  FakeWS.OPEN = 1;
  FakeWS.CLOSING = 2;
  FakeWS.CLOSED = 3;

  window.WebSocket = FakeWS;
})();
