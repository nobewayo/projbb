import { useMemo, useState } from 'react';
import './styles.css';

const dockButtons = [
  'Rooms',
  'Shop',
  'Log',
  'Search',
  'Quests',
  'Settings',
  'Admin',
];

const App = (): JSX.Element => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  const dockTabLabel = useMemo(
    () => (isDockCollapsed ? 'Expand primary dock' : 'Collapse primary dock'),
    [isDockCollapsed],
  );

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
        <nav
          id="primary-dock"
          className={isDockCollapsed ? 'dock dock--collapsed' : 'dock'}
          aria-label="Primary actions"
          aria-hidden={isDockCollapsed}
        >
          {dockButtons.map((label) => (
            <button key={label} type="button">
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="dock-tab"
          aria-label={dockTabLabel}
          aria-controls="primary-dock"
          aria-expanded={!isDockCollapsed}
          onClick={() => setIsDockCollapsed((prev) => !prev)}
        >
          {isDockCollapsed ? '›' : '‹'}
        </button>
      </main>
      <aside className="right-panel" aria-label="Right panel placeholder">
        <header className="right-panel__header">
          <h1>Right Panel</h1>
          <p>Chat log, item info, and profile views will render here.</p>
        </header>
        <section className="panel-body">
          <p>
            This placeholder reserves the fixed 400px panel required by the Master Spec. Future commits will
            hydrate it with live data and chat history streamed from the authoritative server.
          </p>
          <p>
            The surrounding chrome already respects the deterministic canvas boundary so future Pixi/WebGL
            rendering can drop in without shifting layout.
          </p>
        </section>
        <section className="chat-log" aria-label="Chat log placeholder">
          <header className="chat-log__header">
            <h2>Chat Log</h2>
            <span className="chat-log__status">Live feed pending realtime wiring</span>
          </header>
          <div className="chat-log__messages">
            <article>
              <h3>system</h3>
              <p>Welcome to Bitby. Realtime chat will populate this log.</p>
            </article>
            <article>
              <h3>test</h3>
              <p>Movement, inventory, and quest updates will appear once the authoritative server broadcasts them.</p>
            </article>
          </div>
        </section>
      </aside>
    </div>
  );
};

export default App;
