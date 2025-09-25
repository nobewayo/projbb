import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import GridCanvas, { type CanvasItem, type CanvasOccupant } from './canvas/GridCanvas';
import './styles.css';
import { useRealtimeConnection } from './ws/useRealtimeConnection';
import type { GridTile } from './canvas/types';
import { createTileKey } from './canvas/geometry';
import plantTexture from './assets/items/plant.png';
import couchTexture from './assets/items/couch.png';

const dockButtons = [
  'Rooms',
  'Shop',
  'Log',
  'Search',
  'Quests',
  'Settings',
  'Admin',
];

const ITEM_TEXTURES: Record<string, string> = {
  plant: plantTexture,
  couch: couchTexture,
};

const DEFAULT_ITEM_TEXTURE = plantTexture;

type ChatMessage = {
  id: string;
  actor: string;
  body: string;
  time: string;
  isSystem?: boolean;
};

type ContextMenuPosition = {
  x: number;
  y: number;
};

type TileContextMenuState = {
  type: 'tile';
  tile: GridTile;
  items: CanvasItem[];
  focusedItemId: string | null;
  position: ContextMenuPosition;
};

type OccupantContextMenuState = {
  type: 'occupant';
  occupant: CanvasOccupant;
  tile: GridTile;
  position: ContextMenuPosition;
};

type ContextMenuState = TileContextMenuState | OccupantContextMenuState;

type PickupAvailability = {
  canPickup: boolean;
  message: string;
};

type OccupantMenuAction = 'profile' | 'trade' | 'mute' | 'report';

interface ActiveContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onSelectItemInfo: (item: CanvasItem) => void;
  onSelectItemPickup: (item: CanvasItem) => void;
  getPickupAvailability: (item: CanvasItem) => PickupAvailability;
  onSelectOccupantAction: (action: OccupantMenuAction, occupant: CanvasOccupant) => void;
  localOccupantId: string | null;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled])';
const MENU_MARGIN = 12;

const ActiveContextMenu = forwardRef<HTMLDivElement | null, ActiveContextMenuProps>(
  (
    {
      state,
      onClose,
      onSelectItemInfo,
      onSelectItemPickup,
      getPickupAvailability,
      onSelectOccupantAction,
      localOccupantId,
    },
    ref,
  ) => {
    const menuRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
      ref,
      () => menuRef.current,
    );

    useLayoutEffect(() => {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      menu.style.opacity = '0';
      menu.style.left = `${state.position.x}px`;
      menu.style.top = `${state.position.y}px`;

      const adjustPosition = (): void => {
        const rect = menu.getBoundingClientRect();
        let left = state.position.x;
        let top = state.position.y;

        if (left + rect.width + MENU_MARGIN > window.innerWidth) {
          left = Math.max(MENU_MARGIN, window.innerWidth - rect.width - MENU_MARGIN);
        } else {
          left = Math.max(MENU_MARGIN, left);
        }

        if (top + rect.height + MENU_MARGIN > window.innerHeight) {
          top = Math.max(MENU_MARGIN, window.innerHeight - rect.height - MENU_MARGIN);
        } else {
          top = Math.max(MENU_MARGIN, top);
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.opacity = '1';
      };

      const frame = requestAnimationFrame(adjustPosition);
      return () => {
        cancelAnimationFrame(frame);
      };
    }, [state]);

    useEffect(() => {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      const firstButton = menu.querySelector<HTMLButtonElement>(FOCUSABLE_SELECTOR);
      if (firstButton) {
        firstButton.focus();
      } else {
        menu.focus();
      }
    }, [state]);

    const focusByOffset = useCallback((offset: number) => {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }
      const elements = Array.from(
        menu.querySelectorAll<HTMLButtonElement>(FOCUSABLE_SELECTOR),
      );
      if (elements.length === 0) {
        return;
      }
      const activeElement = document.activeElement;
      const currentIndex = Math.max(
        0,
        elements.findIndex((element) => element === activeElement),
      );
      const nextIndex = (currentIndex + offset + elements.length) % elements.length;
      elements[nextIndex].focus();
    }, []);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusByOffset(1);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusByOffset(-1);
        }
      },
      [focusByOffset, onClose],
    );

    const renderTileMenu = (payload: TileContextMenuState): JSX.Element => {
      const { tile, items, focusedItemId } = payload;
      return (
        <>
          <header className="context-menu__header">
            <div>
              <span className="context-menu__title">Felt ({tile.gridX}, {tile.gridY})</span>
            </div>
            <p className="context-menu__subtitle">
              {items.length === 1
                ? '1 genstand på feltet'
                : `${items.length} genstande på feltet`}
            </p>
          </header>
          {items.length === 0 ? (
            <p className="context-menu__empty">Ingen genstande på dette felt.</p>
          ) : (
            <ul className="context-menu__list">
              {items.map((item) => {
                const availability = getPickupAvailability(item);
                const isFocused = focusedItemId === item.id;
                return (
                  <li
                    key={item.id}
                    className={
                      isFocused
                        ? 'context-menu__list-item context-menu__list-item--focused'
                        : 'context-menu__list-item'
                    }
                    data-can-pickup={availability.canPickup || undefined}
                  >
                    <div className="context-menu__item-row">
                      <span className="context-menu__item-name">{item.name}</span>
                      <span className="context-menu__item-meta">
                        ({item.tileX}, {item.tileY})
                      </span>
                    </div>
                    <div className="context-menu__actions" role="group" aria-label={`Handlinger for ${item.name}`}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => onSelectItemInfo(item)}
                      >
                        Info
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => onSelectItemPickup(item)}
                        disabled={!availability.canPickup}
                      >
                        Saml Op
                      </button>
                    </div>
                    <p className="context-menu__status" role="status">
                      {availability.message}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      );
    };

    const renderOccupantMenu = (payload: OccupantContextMenuState): JSX.Element => {
      const { occupant, tile } = payload;
      const isSelf = localOccupantId !== null && localOccupantId === occupant.id;

      const actions: Array<{
        action: OccupantMenuAction;
        label: string;
        description?: string;
        disabled?: boolean;
      }> = [
        {
          action: 'profile',
          label: 'View profile',
          description: 'Åbn spillerkortet i højre panel',
        },
        {
          action: 'trade',
          label: 'Trade',
          description: 'Start en byttehandel',
          disabled: isSelf || occupant.roles.includes('npc'),
        },
        {
          action: 'mute',
          label: 'Mute',
          description: 'Skjul spillerens chat',
          disabled: isSelf,
        },
        {
          action: 'report',
          label: 'Report',
          description: 'Indsend en rapport til moderatorerne',
          disabled: isSelf,
        },
      ];

      return (
        <>
          <header className="context-menu__header">
            <div>
              <span className="context-menu__title">{occupant.username}</span>
              <span className="context-menu__roles">
                {occupant.roles.map((role) => role.toUpperCase()).join(' · ') || 'PLAYER'}
              </span>
            </div>
            <p className="context-menu__subtitle">
              Står på felt ({tile.gridX}, {tile.gridY})
            </p>
          </header>
          <ul className="context-menu__list context-menu__list--actions">
            {actions.map((item) => (
              <li key={item.action} className="context-menu__list-item">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => onSelectOccupantAction(item.action, occupant)}
                >
                  <span className="context-menu__item-name">{item.label}</span>
                  {item.description ? (
                    <span className="context-menu__item-meta">{item.description}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      );
    };

    return (
      <div
        ref={menuRef}
        className={
          state.type === 'tile'
            ? 'context-menu context-menu--tile'
            : 'context-menu context-menu--occupant'
        }
        role="menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-menu-type={state.type}
      >
        {state.type === 'tile' ? renderTileMenu(state) : renderOccupantMenu(state)}
      </div>
    );
  },
);

ActiveContextMenu.displayName = 'ActiveContextMenu';


const placeholderChatHistory: ChatMessage[] = [
  {
    id: 'system-1',
    actor: 'System',
    body: 'Welcome to Bitby. Realtime chat will populate this log.',
    time: '17:58',
    isSystem: true,
  },
  {
    id: 'system-2',
    actor: 'System',
    body: 'Daily quests rotate at midnight UTC. Claim rewards before the reset!',
    time: '17:59',
    isSystem: true,
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
    isSystem: true,
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
    isSystem: true,
  },
  {
    id: 'system-5',
    actor: 'System',
    body: 'Room presence placeholder: 8 visitors online in the plaza.',
    time: '18:04',
    isSystem: true,
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
    isSystem: true,
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
  const [chatDraft, setChatDraft] = useState('');
  const chatDraftRef = useRef(chatDraft);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const chatMessagesRef = useRef<HTMLOListElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const connection = useRealtimeConnection();
  const { sendChat, updateTypingPreview, clearTypingPreview } = connection;

  useEffect(() => {
    chatDraftRef.current = chatDraft;
  }, [chatDraft]);

  useEffect(() => {
    const isEditableElement = (element: Element | null): boolean => {
      if (!element) {
        return false;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return true;
      }

      const htmlElement = element as HTMLElement;
      return htmlElement.isContentEditable;
    };

    const commitDraft = (next: string) => {
      chatDraftRef.current = next;
      setChatDraft(next);
      if (next.length === 0) {
        clearTypingPreview();
      } else {
        updateTypingPreview(next);
      }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const active = document.activeElement;
      if (isEditableElement(active)) {
        return;
      }

      if (event.key === 'Enter') {
        if (chatDraftRef.current.trim().length === 0) {
          return;
        }

        event.preventDefault();
        const sent = sendChat(chatDraftRef.current);
        if (sent) {
          commitDraft('');
        }
        return;
      }

      if (event.key === 'Escape') {
        if (chatDraftRef.current.length === 0) {
          return;
        }

        event.preventDefault();
        commitDraft('');
        return;
      }

      if (event.key === 'Backspace') {
        if (chatDraftRef.current.length === 0) {
          return;
        }

        event.preventDefault();
        commitDraft(chatDraftRef.current.slice(0, -1));
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        commitDraft(`${chatDraftRef.current} `);
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      if (/^\s$/.test(event.key)) {
        event.preventDefault();
        commitDraft(`${chatDraftRef.current} `);
        return;
      }

      event.preventDefault();
      commitDraft(`${chatDraftRef.current}${event.key}`);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [clearTypingPreview, sendChat, updateTypingPreview]);
  useEffect(() => {
    const preferences = connection.chatPreferences;
    if (
      preferences &&
      typeof preferences.showSystemMessages === 'boolean' &&
      preferences.showSystemMessages !== showSystemMessages
    ) {
      setShowSystemMessages(preferences.showSystemMessages);
    }
  }, [connection.chatPreferences, showSystemMessages]);
  const handleSystemToggle = useCallback(() => {
    setShowSystemMessages((previous) => {
      const next = !previous;
      connection.updateShowSystemMessages(next);
      return next;
    });
  }, [connection]);
  const closeContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);
  const { pendingPickupItemIds, lastPickupResult, clearPickupResult, sendPickup } = connection;
  const itemCacheRef = useRef(new Map<string, CanvasItem>());
  const canvasItems = useMemo<CanvasItem[]>(() => {
    const items = connection.items.map((item) => {
      const texture = ITEM_TEXTURES[item.textureKey] ?? DEFAULT_ITEM_TEXTURE;
      const canvasItem: CanvasItem = {
        id: item.id,
        name: item.name,
        description: item.description,
        tileX: item.tileX,
        tileY: item.tileY,
        texture,
      };
      itemCacheRef.current.set(item.id, canvasItem);
      return canvasItem;
    });
    return items;
  }, [connection.items]);

  const chatLogEntries = useMemo(() => {
    const formattedHistory: ChatMessage[] = connection.chatLog.map((message) => {
      const timestamp = new Date(message.createdAt);
      const time = Number.isNaN(timestamp.getTime())
        ? ''
        : timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isSystem = message.roles.some((role) => role.toLowerCase() === 'system');
      return {
        id: message.id,
        actor: message.username,
        body: message.body,
        time,
        isSystem,
      };
    });

    const source = formattedHistory.length > 0 ? formattedHistory : placeholderChatHistory;
    const filtered = showSystemMessages
      ? source
      : source.filter((message) => !message.isSystem && message.actor !== 'System');

    return filtered.slice(-100);
  }, [connection.chatLog, showSystemMessages]);

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
    if (!contextMenuState) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const menu = contextMenuRef.current;
      if (menu && menu.contains(event.target as Node)) {
        return;
      }
      setContextMenuState(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setContextMenuState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuState]);

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

  const noPickupTileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const flag of connection.tileFlags) {
      if (flag.noPickup) {
        keys.add(createTileKey(flag.x, flag.y));
      }
    }
    return keys;
  }, [connection.tileFlags]);

  const selectedItem = useMemo(
    () => (selectedItemId ? itemCacheRef.current.get(selectedItemId) ?? null : null),
    [canvasItems, selectedItemId],
  );

  const selectedItemTileKey = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    return createTileKey(selectedItem.tileX, selectedItem.tileY);
  }, [selectedItem]);

  const pickupResultForSelectedItem = useMemo(() => {
    if (!selectedItemId || !lastPickupResult) {
      return null;
    }
    return lastPickupResult.itemId === selectedItemId ? lastPickupResult : null;
  }, [lastPickupResult, selectedItemId]);

  const isPickupPending = useMemo(
    () => (selectedItemId ? pendingPickupItemIds.includes(selectedItemId) : false),
    [pendingPickupItemIds, selectedItemId],
  );

  const isSelectedItemPresent = useMemo(
    () => (selectedItemId ? connection.items.some((item) => item.id === selectedItemId) : false),
    [connection.items, selectedItemId],
  );

  const localOccupant = useMemo(() => {
    if (!connection.user) {
      return null;
    }
    return (
      connection.occupants.find((occupant) => occupant.id === connection.user?.id) ?? null
    );
  }, [connection.occupants, connection.user]);

  const pickupStatusMessage = useMemo(() => {
    if (!selectedItem) {
      return '';
    }
    if (pickupResultForSelectedItem) {
      return pickupResultForSelectedItem.message;
    }
    if (isPickupPending) {
      return 'Afventer serverbekræftelse…';
    }
    if (!isSelectedItemPresent) {
      return 'Genstanden er ikke længere i rummet.';
    }
    if (!localOccupant) {
      return 'Forbind til rummet for at samle op.';
    }
    if (selectedItemTileKey && noPickupTileKeys.has(selectedItemTileKey)) {
      return 'Kan ikke samle op her';
    }
    if (
      localOccupant.position.x !== selectedItem.tileX ||
      localOccupant.position.y !== selectedItem.tileY
    ) {
      return 'Stil dig på feltet for at samle op';
    }
    return 'Klar til at samle op';
  }, [
    isPickupPending,
    isSelectedItemPresent,
    localOccupant,
    noPickupTileKeys,
    pickupResultForSelectedItem,
    selectedItem,
    selectedItemTileKey,
  ]);

  const pickupStatusTone = useMemo(() => {
    if (!selectedItem || !pickupStatusMessage) {
      return 'pending';
    }
    if (pickupResultForSelectedItem?.status === 'ok') {
      return 'ready';
    }
    if (pickupResultForSelectedItem?.status === 'error') {
      return 'blocked';
    }
    if (isPickupPending) {
      return 'pending';
    }
    if (!isSelectedItemPresent || pickupStatusMessage === 'Kan ikke samle op her') {
      return 'blocked';
    }
    if (pickupStatusMessage === 'Klar til at samle op') {
      return 'ready';
    }
    return 'pending';
  }, [
    isPickupPending,
    isSelectedItemPresent,
    pickupResultForSelectedItem,
    pickupStatusMessage,
    selectedItem,
  ]);

  const canPickupSelectedItem = Boolean(
    selectedItem &&
      isSelectedItemPresent &&
      !isPickupPending &&
      (!pickupResultForSelectedItem || pickupResultForSelectedItem.status === 'error') &&
      localOccupant &&
      localOccupant.position.x === selectedItem.tileX &&
      localOccupant.position.y === selectedItem.tileY &&
      !(selectedItemTileKey && noPickupTileKeys.has(selectedItemTileKey)),
  );

  const shouldShowPickupHint =
    pickupStatusMessage.length > 0 &&
    (pickupResultForSelectedItem !== null ||
      isPickupPending ||
      pickupStatusMessage !== 'Klar til at samle op');

  const getPickupAvailability = useCallback(
    (item: CanvasItem): PickupAvailability => {
      const tileKey = createTileKey(item.tileX, item.tileY);
      const isPending = pendingPickupItemIds.includes(item.id);
      const result =
        lastPickupResult && lastPickupResult.itemId === item.id
          ? lastPickupResult
          : null;
      const isPresent = connection.items.some((candidate) => candidate.id === item.id);

      if (isPending) {
        return { canPickup: false, message: 'Pickup behandles…' };
      }

      if (!localOccupant) {
        return { canPickup: false, message: 'Afventer forbindelse' };
      }

      if (
        localOccupant.position.x !== item.tileX ||
        localOccupant.position.y !== item.tileY
      ) {
        return { canPickup: false, message: 'Stå på feltet for at samle op' };
      }

      if (noPickupTileKeys.has(tileKey)) {
        return { canPickup: false, message: 'Pickup blokeret på dette felt' };
      }

      if (!isPresent && (!result || result.status !== 'ok')) {
        return { canPickup: false, message: 'Genstanden er allerede væk' };
      }

      if (result?.status === 'ok') {
        return { canPickup: false, message: 'Allerede samlet op' };
      }

      if (result?.status === 'error') {
        return { canPickup: true, message: 'Prøv igen' };
      }

      return { canPickup: true, message: 'Klar til at samle op' };
    },
    [
      connection.items,
      lastPickupResult,
      localOccupant,
      noPickupTileKeys,
      pendingPickupItemIds,
    ],
  );

  const handleItemClick = useCallback(
    (item: CanvasItem): void => {
      itemCacheRef.current.set(item.id, item);
      if (lastPickupResult && lastPickupResult.itemId !== item.id) {
        clearPickupResult(lastPickupResult.itemId);
      }
      setSelectedItemId(item.id);
    },
    [clearPickupResult, lastPickupResult],
  );

  const handlePickupSelectedItem = useCallback(() => {
    if (!selectedItem || !canPickupSelectedItem) {
      return;
    }
    const sent = sendPickup(selectedItem.id);
    if (sent && import.meta.env.DEV) {
      console.debug('[items] Pickup requested', {
        itemId: selectedItem.id,
        name: selectedItem.name,
      });
    }
  }, [canPickupSelectedItem, selectedItem, sendPickup]);

  const handleClearSelectedItem = useCallback(() => {
    if (selectedItemId) {
      clearPickupResult(selectedItemId);
    }
    setSelectedItemId(null);
  }, [clearPickupResult, selectedItemId]);

  const handleContextMenuItemInfo = useCallback(
    (item: CanvasItem) => {
      handleItemClick(item);
      closeContextMenu();
    },
    [closeContextMenu, handleItemClick],
  );

  const handleContextMenuItemPickup = useCallback(
    (item: CanvasItem) => {
      const availability = getPickupAvailability(item);
      if (!availability.canPickup) {
        return;
      }
      const sent = sendPickup(item.id);
      if (sent && import.meta.env.DEV) {
        console.debug('[items] Pickup requested from context menu', {
          itemId: item.id,
          name: item.name,
        });
      }
      closeContextMenu();
    },
    [closeContextMenu, getPickupAvailability, sendPickup],
  );

  const handleOccupantMenuAction = useCallback(
    (action: OccupantMenuAction, occupant: CanvasOccupant) => {
      closeContextMenu();
      if (import.meta.env.DEV) {
        console.debug('[avatars] Context menu action', { action, occupant });
      }
    },
    [closeContextMenu],
  );

  const handleTileContextMenu = useCallback(
    ({ tile, items, clientX, clientY }: {
      tile: GridTile;
      items: CanvasItem[];
      clientX: number;
      clientY: number;
    }) => {
      items.forEach((entry) => {
        itemCacheRef.current.set(entry.id, entry);
      });
      setContextMenuState({
        type: 'tile',
        tile,
        items,
        focusedItemId: null,
        position: { x: clientX, y: clientY },
      });
    },
    [],
  );

  const handleItemContextMenu = useCallback(
    ({
      tile,
      item,
      items,
      clientX,
      clientY,
    }: {
      tile: GridTile;
      item: CanvasItem;
      items: CanvasItem[];
      clientX: number;
      clientY: number;
    }) => {
      items.forEach((entry) => {
        itemCacheRef.current.set(entry.id, entry);
      });
      setContextMenuState({
        type: 'tile',
        tile,
        items,
        focusedItemId: item.id,
        position: { x: clientX, y: clientY },
      });
    },
    [],
  );

  const handleOccupantContextMenu = useCallback(
    ({
      occupant,
      tile,
      clientX,
      clientY,
    }: {
      occupant: CanvasOccupant;
      tile: GridTile;
      clientX: number;
      clientY: number;
    }) => {
      setContextMenuState({
        type: 'occupant',
        occupant,
        tile,
        position: { x: clientX, y: clientY },
      });
    },
    [],
  );

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    setContextMenuState((previous) => {
      if (!previous) {
        return previous;
      }

      if (previous.type === 'tile') {
        const latestItems = canvasItems.filter(
          (item) =>
            item.tileX === previous.tile.gridX && item.tileY === previous.tile.gridY,
        );
        const focusedExists =
          previous.focusedItemId !== null &&
          latestItems.some((item) => item.id === previous.focusedItemId);
        const sameLength = latestItems.length === previous.items.length;
        const sameIds =
          sameLength &&
          latestItems.every((item, index) => item.id === previous.items[index]?.id);
        if (sameIds && (focusedExists || previous.focusedItemId === null)) {
          return previous;
        }
        return {
          ...previous,
          items: latestItems,
          focusedItemId: focusedExists ? previous.focusedItemId : null,
        };
      }

      const latestOccupant = connection.occupants.find(
        (candidate) => candidate.id === previous.occupant.id,
      );
      if (!latestOccupant) {
        return null;
      }

      if (
        latestOccupant.position.x !== previous.tile.gridX ||
        latestOccupant.position.y !== previous.tile.gridY
      ) {
        return null;
      }

      return previous;
    });
  }, [canvasItems, connection.occupants, contextMenuState]);

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
              items={canvasItems}
              onItemClick={handleItemClick}
              onTileContextMenu={handleTileContextMenu}
              onItemContextMenu={handleItemContextMenu}
              onOccupantContextMenu={handleOccupantContextMenu}
              localOccupantId={connection.user?.id ?? null}
              showGrid={isGridVisible}
              showHoverWhenGridHidden={showHoverWhenGridHidden}
              moveAnimationsEnabled={areMoveAnimationsEnabled}
              typingIndicators={connection.typingIndicators}
              chatBubbles={connection.chatBubbles}
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
          <aside className="right-panel" aria-label={selectedItem ? 'Item information panel' : 'Right panel placeholder'}>
            <header className="right-panel__header">
              <div className="right-panel__heading">
                <h1>{selectedItem ? 'Item Info' : 'Right Panel'}</h1>
                {selectedItem ? (
                  <p className="right-panel__subtitle">{selectedItem.name}</p>
                ) : null}
              </div>
              <span className="right-panel__header-divider" aria-hidden="true" />
            </header>
            <section
              className={
                selectedItem
                  ? 'right-panel__sections right-panel__sections--item'
                  : 'right-panel__sections'
              }
              aria-label={selectedItem ? 'Selected item details' : 'Upcoming panel modules'}
            >
              {selectedItem ? (
                <article key={selectedItem.id} className="item-info">
                  <header className="item-info__header">
                    <h2>{selectedItem.name}</h2>
                    <p>{selectedItem.description}</p>
                  </header>
                  <dl className="item-info__meta">
                    <div>
                      <dt>Placering</dt>
                      <dd>
                        <span className="item-info__coordinate">
                          ({selectedItem.tileX}, {selectedItem.tileY})
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Pickup status</dt>
                      <dd className={`item-info__status item-info__status--${pickupStatusTone}`}>
                        {pickupStatusMessage}
                      </dd>
                    </div>
                  </dl>
                  <div className="item-info__actions">
                    <button
                      type="button"
                      onClick={handlePickupSelectedItem}
                      disabled={!canPickupSelectedItem}
                    >
                      Saml Op
                    </button>
                    <button
                      type="button"
                      className="item-info__secondary"
                      onClick={handleClearSelectedItem}
                    >
                      Tilbage til panel
                    </button>
                  </div>
                  {shouldShowPickupHint ? (
                    <p className="item-info__hint">{pickupStatusMessage}</p>
                  ) : null}
                </article>
              ) : (
                panelSections.map((section) => (
                  <article key={section.title} className="right-panel__section">
                    <h2>{section.title}</h2>
                    <p>{section.body}</p>
                  </article>
                ))
              )}
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
                  onClick={handleSystemToggle}
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
      {contextMenuState ? (
        <ActiveContextMenu
          ref={contextMenuRef}
          state={contextMenuState}
          onClose={closeContextMenu}
          onSelectItemInfo={handleContextMenuItemInfo}
          onSelectItemPickup={handleContextMenuItemPickup}
          getPickupAvailability={getPickupAvailability}
          onSelectOccupantAction={handleOccupantMenuAction}
          localOccupantId={connection.user?.id ?? null}
        />
      ) : null}
    </div>
  );
};

export default App;
