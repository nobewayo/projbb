import { useEffect, useMemo, useRef, useState } from 'react';
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

type ChatMessage = {
  id: string;
  actor: string;
  body: string;
  time: string;
};

const placeholderChatHistory: ChatMessage[] = [
  {
    id: 'system-1',
    actor: 'System',
    body: 'Welcome to Bitby. Realtime chat will populate this log.',
    time: '17:58',
  },
  {
    id: 'system-2',
    actor: 'System',
    body: 'Daily quests rotate at midnight UTC. Claim rewards before the reset!',
    time: '17:59',
  },
  {
    id: 'player-0',
    actor: 'Player',
    body: 'Movement loop placeholder: walking toward tile (5, 8).',
    time: '18:00',
  },
  {
    id: 'system-3',
    actor: 'System',
    body: 'Admin: Spawned a practice bot near the fountain for collision testing.',
    time: '18:01',
  },
  {
    id: 'player-1',
    actor: 'Player',
    body: 'Quest tracker placeholder: Completed “Arrange the lounge chairs.”',
    time: '18:02',
  },
  {
    id: 'system-4',
    actor: 'System',
    body: 'Economy update placeholder: Daily coin stipend delivered.',
    time: '18:03',
  },
  {
    id: 'system-5',
    actor: 'System',
    body: 'Room presence placeholder: 8 visitors online in the plaza.',
    time: '18:04',
  },
  {
    id: 'player-2',
    actor: 'Player',
    body: 'Hey folks, checking the plaza lighting real quick.',
    time: '18:05',
  },
  {
    id: 'system-6',
    actor: 'System',
    body: 'Reminder: Chat history shows the latest 100 entries. Older logs archive to the server.',
    time: '18:06',
  },
];

const App = (): JSX.Element => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const chatMessagesRef = useRef<HTMLOListElement | null>(null);

  const chatLogEntries = useMemo(
    () => placeholderChatHistory.slice(-100).reverse(),
    [],
  );

  useEffect(() => {
    if (isChatCollapsed) {
      return;
    }

    const container = chatMessagesRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [isChatCollapsed, chatLogEntries]);

  const dockTabLabel = useMemo(
    () => (isDockCollapsed ? 'Expand primary dock' : 'Collapse primary dock'),
    [isDockCollapsed],
  );

  const chatToggleLabel = useMemo(
    () => (isChatCollapsed ? 'Expand chat history' : 'Collapse chat history'),
    [isChatCollapsed],
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
          <p>Chat history, item info, and profile views will render here.</p>
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
        <section
          className={isChatCollapsed ? 'chat-log chat-log--collapsed' : 'chat-log'}
          aria-label="Chat history"
        >
          {isChatCollapsed ? null : (
            <ol id="chat-log-messages" className="chat-log__messages" ref={chatMessagesRef}>
              {chatLogEntries.map((message) => (
                <li key={message.id}>
                  <span className="chat-log__time">({message.time})</span>
                  <span className="chat-log__actor">{message.actor}:</span>
                  <span className="chat-log__body">{message.body}</span>
                </li>
              ))}
            </ol>
          )}
          <button
            type="button"
            className={isChatCollapsed ? 'chat-log__toggle chat-log__toggle--collapsed' : 'chat-log__toggle'}
            onClick={() => setIsChatCollapsed((prev) => !prev)}
            aria-expanded={!isChatCollapsed}
            aria-controls="chat-log-messages"
          >
            <span aria-hidden="true">{isChatCollapsed ? '▲' : '▼'}</span>
            <span className="sr-only">{chatToggleLabel}</span>
          </button>
        </section>
      </aside>
    </div>
  );
};

export default App;
