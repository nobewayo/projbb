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
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const chatMessagesRef = useRef<HTMLOListElement | null>(null);

  const chatLogEntries = useMemo(
    () => placeholderChatHistory.slice(-100).reverse(),
    [],
  );

  useEffect(() => {
    if (!isChatVisible) {
      setShowBackToTop(false);
      return;
    }

    const container = chatMessagesRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [isChatVisible, chatLogEntries]);

  useEffect(() => {
    if (!isChatVisible) {
      return;
    }

    const container = chatMessagesRef.current;
    if (!container) {
      return;
    }

    const handleScroll = (): void => {
      setShowBackToTop(container.scrollTop > 8);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isChatVisible]);

  const username = 'TestUser';
  const coinBalance = 1280;
  const level = 12;
  const newsTicker = useMemo(
    () => [
      'Server maintenance scheduled for 02:00 UTC.',
      'New plaza furniture pack arrives tomorrow.',
      'Beta invitations expand to wave three next week.',
    ],
    [],
  );
  const marqueeEntries = useMemo(() => newsTicker.concat(newsTicker), [newsTicker]);
  const chatToggleLabel = isChatVisible ? 'Hide chat log' : 'Show chat log';

  return (
    <div className="stage">
      <header className="stage__top-bar" aria-label="Player overview and news">
        <div className="top-bar__profile" aria-label="Player overview">
          <span className="top-bar__username">{username}</span>
          <span className="top-bar__meta">
            <span className="top-bar__coins">{coinBalance.toLocaleString()} coins</span>
            <span className="top-bar__divider" aria-hidden="true">•</span>
            <span className="top-bar__level">Level {level}</span>
          </span>
        </div>
        <div className="top-bar__news" aria-label="Latest news" role="presentation">
          <div className="top-bar__news-track">
            {marqueeEntries.map((entry, index) => (
              <span key={`${entry}-${index}`} className="top-bar__news-item">
                {entry}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="top-bar__chat-button"
          onClick={() => setIsChatVisible((prev) => !prev)}
          aria-pressed={isChatVisible}
          aria-label={chatToggleLabel}
        >
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
            <path
              fill="currentColor"
              d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5.586L9 20.414V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
            />
          </svg>
          <span className="sr-only">{chatToggleLabel}</span>
        </button>
      </header>
      <div className="stage__content">
        <main className="canvas-area" aria-label="Bitby room canvas placeholder">
          <div className="canvas-placeholder" role="presentation">
            <p className="canvas-placeholder__title">Bitby Grid Canvas</p>
            <p className="canvas-placeholder__body">
              Deterministic diamond grid rendering, avatars, and realtime movement will appear here as the
              Master Spec milestones are implemented.
            </p>
          </div>
        </main>
        <aside className="right-panel" aria-label="Right panel placeholder">
          <header className="right-panel__header">
            <h1>Right Panel</h1>
            <p>Chat history, item info, and profile views will render here.</p>
          </header>
          <section className="panel-body">
            <p>
              This placeholder reserves the fixed 500px panel required by the Master Spec. Future commits will hydrate it with
              live data and chat history streamed from the authoritative server alongside contextual actions and quest details.
            </p>
            <p>
              The surrounding chrome already respects the deterministic canvas boundary so future Pixi/WebGL rendering can drop
              in without shifting layout. Inventory summaries, quest steps, and pinned chat snippets will be able to stack here
              without reflowing the playfield.
            </p>
            <p>
              Additional placeholder copy demonstrates how the panel fills vertically now that the freestanding chat resides
              outside the column. Upcoming iterations will thread in party management, item tooltips, and moderation queues.
            </p>
            <ul>
              <li>Server stream placeholders: movement, chat, catalog deltas.</li>
              <li>Context modules: player cards, quest tracker, admin overrides.</li>
              <li>Live metrics: visitors in room, event timers, seasonal notices.</li>
            </ul>
          </section>
        </aside>
      </div>
      <nav className="primary-menu" aria-label="Primary actions">
        {dockButtons.map((label) => (
          <button key={label} type="button">
            {label}
          </button>
        ))}
      </nav>
      <aside
        className={isChatVisible ? 'chat-drawer chat-drawer--open' : 'chat-drawer chat-drawer--collapsed'}
        aria-label="Chat history"
      >
        <div className="chat-drawer__panel" aria-hidden={!isChatVisible}>
          <header className="chat-drawer__header">
            <h2>Chat Log</h2>
            <button
              type="button"
              className="chat-drawer__close"
              onClick={() => setIsChatVisible(false)}
              aria-label="Close chat log"
            >
              <svg viewBox="0 0 16 16" role="presentation" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 0 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06z"
                />
              </svg>
            </button>
          </header>
          <div className="chat-drawer__body">
            <div className="chat-log__messages-wrapper">
              <ol
                id="chat-log-messages"
                className="chat-log__messages"
                ref={chatMessagesRef}
                aria-hidden={!isChatVisible}
              >
                {chatLogEntries.map((message) => (
                  <li
                    key={message.id}
                    className="chat-log__message"
                    data-time={message.time}
                    tabIndex={0}
                  >
                    <span className="chat-log__actor">{message.actor}</span>
                    <span className="chat-log__body">{message.body}</span>
                  </li>
                ))}
              </ol>
              {isChatVisible && showBackToTop ? (
                <button
                  type="button"
                  className="chat-log__back-to-top"
                  onClick={() => {
                    const container = chatMessagesRef.current;
                    if (container) {
                      container.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                >
                  Back to top
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {!isChatVisible ? (
          <button
            type="button"
            className="chat-drawer__handle"
            onClick={() => setIsChatVisible(true)}
            aria-label="Show chat log"
          >
            <span aria-hidden="true">‹</span>
            <span>Log</span>
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
      </aside>
    </div>
  );
};

export default App;
