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
    id: 'system-0',
    actor: 'system',
    body: 'Welcome to Bitby. Realtime chat will populate this log.',
    time: '08:00',
  },
  {
    id: 'system-1',
    actor: 'system',
    body: 'Daily quests rotate at midnight UTC. Claim rewards before the reset!',
    time: '08:02',
  },
  {
    id: 'test-0',
    actor: 'test',
    body: 'Movement loop placeholder: walking toward tile (5, 8).',
    time: '08:04',
  },
  {
    id: 'system-2',
    actor: 'system',
    body: 'Admin: Spawned a practice bot near the fountain for collision testing.',
    time: '08:05',
  },
  {
    id: 'test2-0',
    actor: 'test2',
    body: 'Inventory sync placeholder: picked up a wooden stool.',
    time: '08:07',
  },
  {
    id: 'system-3',
    actor: 'system',
    body: 'Room broadcast: Lighting preset changed to dusk ambience.',
    time: '08:08',
  },
  {
    id: 'test-1',
    actor: 'test',
    body: 'Chat placeholder: “Can someone open the quest panel?”',
    time: '08:10',
  },
  {
    id: 'system-4',
    actor: 'system',
    body: 'Economy update placeholder: Daily coin stipend delivered.',
    time: '08:12',
  },
  {
    id: 'test3-0',
    actor: 'test3',
    body: 'Quest tracker placeholder: Completed “Arrange the lounge chairs.”',
    time: '08:14',
  },
  {
    id: 'test4-0',
    actor: 'test4',
    body: 'Movement placeholder: teleport anchor verified.',
    time: '08:16',
  },
  {
    id: 'system-5',
    actor: 'system',
    body: 'Room presence placeholder: 8 visitors online in the plaza.',
    time: '08:18',
  },
  {
    id: 'system-6',
    actor: 'system',
    body: 'Reminder: Chat history shows the latest 100 entries. Older logs archive to the server.',
    time: '08:20',
  },
];

const App = (): JSX.Element => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const chatLogEntries = useMemo(
    () => placeholderChatHistory.slice(-100),
    [],
  );

  useEffect(() => {
    if (isChatCollapsed) {
      return;
    }

    const container = chatMessagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isChatCollapsed, chatLogEntries]);

  const dockTabLabel = useMemo(
    () => (isDockCollapsed ? 'Expand primary dock' : 'Collapse primary dock'),
    [isDockCollapsed],
  );

  const chatToggleLabel = useMemo(
    () => (isChatCollapsed ? 'Expand chat log' : 'Collapse chat log'),
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
        <section
          className={isChatCollapsed ? 'chat-log chat-log--collapsed' : 'chat-log'}
          aria-label="Chat log placeholder"
        >
          <header className="chat-log__header">
            <div className="chat-log__title">
              <h2>Chat log</h2>
              <p className="chat-log__status">
                Showing last {chatLogEntries.length} of {placeholderChatHistory.length} updates
              </p>
            </div>
            <button
              type="button"
              className="chat-log__toggle"
              onClick={() => setIsChatCollapsed((prev) => !prev)}
              aria-expanded={!isChatCollapsed}
              aria-controls="chat-log-messages"
              aria-label={chatToggleLabel}
            >
              {isChatCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </header>
          <div id="chat-log-messages" className="chat-log__messages" ref={chatMessagesRef}>
            {chatLogEntries.map((message) => (
              <article key={message.id}>
                <header>
                  <h3>{message.actor}</h3>
                  <time dateTime={message.time}>{message.time}</time>
                </header>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default App;
