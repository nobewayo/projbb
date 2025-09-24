import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import GridCanvas from './canvas/GridCanvas';
import './styles.css';
import { useRealtimeConnection } from './ws/useRealtimeConnection';
import type { GridTile } from './canvas/types';
import { createTileKey } from './canvas/geometry';

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

const panelSections = [
  {
    title: 'Room overview',
    body:
      'Live occupants, furniture states, and queued moderation events surface here once the realtime feeds are connected. Expect inline moderation cards, visitor summaries, and streaming alerts to pack this column so admins never lose context while monitoring rooms.',
  },
  {
    title: 'Quest tracker',
    body:
      'Track daily quests, event timers, and party tasks. Progress updates from the authoritative server stream directly into this stack, keeping collaborators aligned on milestones without needing to leave the canvas or pop additional dialogs.',
  },
  {
    title: 'Pinned threads',
    body:
      'Moderators can pin essential announcements or support replies for quick reference without leaving the canvas. Long-form guidance, policy notes, and escalation timelines can all live here as fully formatted text blocks.',
  },
];

const App = (): JSX.Element => {
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(
    () => import.meta.env.DEV,
  );
  const [showSystemMessages, setShowSystemMessages] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [showHoverWhenGridHidden, setShowHoverWhenGridHidden] = useState(true);
  const [areMoveAnimationsEnabled, setAreMoveAnimationsEnabled] = useState(true);
  const chatMessagesRef = useRef<HTMLOListElement | null>(null);
  const connection = useRealtimeConnection();

  const chatLogEntries = useMemo(() => {
    const baseLog = showSystemMessages
      ? placeholderChatHistory
      : placeholderChatHistory.filter((message) => message.actor !== 'System');

    return baseLog.slice(-100);
  }, [showSystemMessages]);

  const primaryMenuStyle = useMemo(
    () => ({ '--menu-count': dockButtons.length } as CSSProperties),
    [],
  );

  useEffect(() => {
    if (!isChatVisible) {
      setShowBackToTop(false);
      return;
    }

    const container = chatMessagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setShowBackToTop(false);
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
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      setShowBackToTop(distanceFromBottom > 4);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isChatVisible]);

  const username = connection.user?.username ?? 'TestUser';
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
  const chatToggleTooltip = 'Chat Log';
  const supportTooltip = 'Support';
  const systemToggleLabel = showSystemMessages
    ? 'Hide system messages'
    : 'Show system messages';
  const systemToggleTooltip = showSystemMessages ? 'Hide System Logs' : 'Show System Logs';

  const lockedTileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const flag of connection.tileFlags) {
      if (flag.locked) {
        keys.add(createTileKey(flag.x, flag.y));
      }
    }
    return keys;
  }, [connection.tileFlags]);

  const occupiedTileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const occupant of connection.occupants) {
      keys.add(createTileKey(occupant.position.x, occupant.position.y));
    }
    return keys;
  }, [connection.occupants]);

  const handleTileClick = useCallback(
    (tile: GridTile): void => {
      if (connection.status !== 'connected') {
        return;
      }

      if (lockedTileKeys.has(tile.key)) {
        return;
      }

      if (occupiedTileKeys.has(tile.key)) {
        return;
      }

      connection.sendMove(tile.gridX, tile.gridY);
    },
    [connection.sendMove, connection.status, lockedTileKeys, occupiedTileKeys],
  );

  const overlayCopy = useMemo(() => {
    switch (connection.status) {
      case 'connecting':
        return {
          title: 'Connecting to Bitby…',
          message: 'Establishing a secure realtime channel to the authority server.',
        } as const;
      case 'authenticating':
        return {
          title: 'Authenticating…',
          message:
            'Validating the development session token before streaming the room snapshot.',
        } as const;
      case 'reconnecting': {
        const retryFragment =
          connection.retryInSeconds !== null
            ? `Retrying in ${connection.retryInSeconds}s…`
            : 'Attempting to restore the realtime session…';
        const errorFragment = connection.lastError ?? null;

        const segments = [errorFragment, retryFragment].filter(
          (segment): segment is string => Boolean(segment),
        );

        return {
          title: 'Connection lost',
          message: segments.join(' · '),
        } as const;
      }
      case 'connected':
      default:
        return { title: '', message: '' } as const;
    }
  }, [connection.lastError, connection.retryInSeconds, connection.status]);

  const handleMenuButtonClick = (label: string): void => {
    if (label === 'Admin') {
      setIsAdminPanelVisible((prev) => !prev);
    }
  };

  const adminShortcuts = useMemo(
    () => [
      {
        label: 'Reload room',
        onClick: () => {
          if (import.meta.env.DEV) {
            console.debug('[admin] Reload room requested');
          }
        },
      },
      {
        label: isGridVisible ? 'Hide grid' : 'Show grid',
        onClick: () => {
          setIsGridVisible((prev) => !prev);
        },
        pressed: !isGridVisible,
      },
      {
        label: showHoverWhenGridHidden
          ? 'Disable hidden hover highlight'
          : 'Enable hidden hover highlight',
        onClick: () => {
          setShowHoverWhenGridHidden((prev) => !prev);
        },
        pressed: showHoverWhenGridHidden,
      },
      {
        label: areMoveAnimationsEnabled
          ? 'Disable move animations'
          : 'Enable move animations',
        onClick: () => {
          setAreMoveAnimationsEnabled((prev) => !prev);
        },
        pressed: !areMoveAnimationsEnabled,
      },
      {
        label: 'Latency trace',
        onClick: () => {
          if (import.meta.env.DEV) {
            console.debug('[admin] Latency trace requested');
          }
        },
      },
    ],
    [areMoveAnimationsEnabled, isGridVisible, showHoverWhenGridHidden],
  );

  return (
    <div className="stage-shell">
      {connection.status !== 'connected' ? (
        <div
          className="reconnect-overlay"
          role="alertdialog"
          aria-live="assertive"
          aria-modal="true"
        >
          <div className="reconnect-overlay__panel">
            <span className="reconnect-overlay__spinner" aria-hidden="true" />
            <div className="reconnect-overlay__copy">
              <h2 className="reconnect-overlay__title">{overlayCopy.title}</h2>
              {overlayCopy.message ? (
                <p className="reconnect-overlay__message">{overlayCopy.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="stage">
        <header className="stage__top-bar" aria-label="Player overview and news">
          <div className="top-bar__profile" aria-label="Player overview">
            <span className="top-bar__username">{username}</span>
            <span className="top-bar__meta">
              <span className="top-bar__level">Level {level}</span>
              <span className="top-bar__divider" aria-hidden="true">
                •
              </span>
              <span className="top-bar__coins">{coinBalance.toLocaleString()} coins</span>
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
          <div className="top-bar__actions">
            <button
              type="button"
              className="top-bar__icon-button has-tooltip top-bar__support-button"
              aria-label={supportTooltip}
              data-tooltip={supportTooltip}
            >
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 14.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 13a.75.75 0 0 1-.75-.75A2.252 2.252 0 0 1 12.7 10a1.5 1.5 0 1 0-2.45-1.15.75.75 0 0 1-1.5 0 3 3 0 1 1 4.5 2.6 1.5 1.5 0 0 0-.75 1.3.75.75 0 0 1-.75.75Z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="top-bar__icon-button has-tooltip top-bar__chat-button"
              onClick={() => setIsChatVisible((prev) => !prev)}
              aria-pressed={isChatVisible}
              aria-label={chatToggleLabel}
              data-tooltip={chatToggleTooltip}
            >
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5.586L9 20.414V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                />
              </svg>
              <span className="sr-only">{chatToggleLabel}</span>
            </button>
          </div>
        </header>
        <div className="stage__content">
          <main className="canvas-area" aria-label="Bitby room canvas">
            <GridCanvas
              occupants={connection.occupants}
              tileFlags={connection.tileFlags}
              pendingMoveTarget={connection.pendingMoveTarget}
              onTileClick={handleTileClick}
              localOccupantId={connection.user?.id ?? null}
              showGrid={isGridVisible}
              showHoverWhenGridHidden={showHoverWhenGridHidden}
              moveAnimationsEnabled={areMoveAnimationsEnabled}
            />
          </main>
          <nav
            className="primary-menu"
            aria-label="Primary actions"
            style={primaryMenuStyle}
          >
            {dockButtons.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleMenuButtonClick(label)}
                aria-pressed={label === 'Admin' ? isAdminPanelVisible : undefined}
                data-active={label === 'Admin' ? isAdminPanelVisible : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
          <aside className="right-panel" aria-label="Right panel placeholder">
            <header className="right-panel__header">
              <h1>Right Panel</h1>
              <span className="right-panel__header-divider" aria-hidden="true" />
            </header>
            <section className="right-panel__sections" aria-label="Upcoming panel modules">
              {panelSections.map((section) => (
                <article key={section.title} className="right-panel__section">
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </article>
              ))}
            </section>
          </aside>
        </div>
        <aside
          className={isChatVisible ? 'chat-drawer chat-drawer--open' : 'chat-drawer chat-drawer--collapsed'}
          aria-label="Chat history"
        >
          <div className="chat-drawer__panel" aria-hidden={!isChatVisible}>
            <header className="chat-drawer__header">
              <h2>Chat Log</h2>
              <div className="chat-drawer__actions">
                <button
                  type="button"
                  className={
                    showSystemMessages
                      ? 'chat-drawer__system-toggle has-tooltip'
                      : 'chat-drawer__system-toggle chat-drawer__system-toggle--muted has-tooltip'
                  }
                  onClick={() => setShowSystemMessages((prev) => !prev)}
                  aria-pressed={showSystemMessages}
                  aria-label={systemToggleLabel}
                  data-tooltip={systemToggleTooltip}
                >
                  !
                </button>
              </div>
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
                      <div className="chat-log__message-inner">
                        <span className="chat-log__actor">{message.actor}</span>
                        <span className="chat-log__body">{message.body}</span>
                      </div>
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
        </aside>
      </div>
      <nav
        className={
          isAdminPanelVisible
            ? 'admin-quick-menu admin-quick-menu--visible'
            : 'admin-quick-menu'
        }
        aria-label="Admin quick menu"
        aria-hidden={!isAdminPanelVisible}
        role="group"
      >
        {adminShortcuts.map((item) => (
          <button
            key={item.label}
            type="button"
            className="admin-quick-menu__button"
            onClick={item.onClick}
            aria-pressed={item.pressed}
            data-active={item.pressed}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
