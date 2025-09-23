import './styles.css';

const App = (): JSX.Element => {
  return (
    <div className="stage">
      <main className="canvas-area" aria-label="Bitby room canvas placeholder">
        <div className="canvas-placeholder" role="presentation">
          <p className="canvas-placeholder__title">Bitby Grid Canvas</p>
          <p className="canvas-placeholder__body">
            Deterministic diamond grid rendering, avatars, and realtime movement will appear here as the
            Master Spec milestones are implemented.
          </p>
        </div>
        <nav className="dock" aria-label="Primary actions">
          <button type="button">Rooms</button>
          <button type="button">Shop</button>
          <button type="button">Log</button>
          <button type="button">Search</button>
          <button type="button">Quests</button>
          <button type="button">Settings</button>
          <button type="button">Admin</button>
        </nav>
        <button type="button" className="dock-tab" aria-label="Toggle dock">
          ‹
        </button>
      </main>
      <aside className="right-panel" aria-label="Right panel placeholder">
        <header>
          <h1>Right Panel</h1>
          <p>Chat log, item info, and profile views will render here.</p>
        </header>
        <section className="panel-body">
          <p>
            This placeholder reserves the fixed 400px panel required by the Master Spec. Future commits will
            hydrate it with live data and chat history streamed from the authoritative server.
          </p>
        </section>
      </aside>
    </div>
  );
};

export default App;
