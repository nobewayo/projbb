# Bitby — Master Spec v3.7 (Consolidated, Full)

> **Implementation guardrail**
> Follow this spec by default. It encodes non-negotiables like **grid determinism** and **server authority**.
> This document is **not set in stone**: if a human explicitly requests a change or a small tactical deviation is required, you may deviate **minimally**, must **comment** the deviation in code, and must **not** alter anything rendered inside the **grid window** unless told to.
> **Maintenance:** Update this Master Spec whenever requirements shift so downstream documentation and implementations stay aligned.

---

## 0) Product Overview

- Denmark-style “diamond grid” chat: **pre-rendered 3D room backgrounds, pre-rendered 3D avatars, pre-rendered 3D items** — all shipped as **2D sprites** (PNG/JPG, optional frame sequences). **No runtime 3D** in the client.  
- **Deterministic canvas**: the grid window renders identically for all clients; themes only affect UI chrome (panels, dock, menus).  
- **Fast, accurate tile movement** is the #1 priority.  
- Rooms are unique instances (items/players/bots/background per room).  
- Monetization is **phase-gated** to the end; **ad banners** may be enabled early (never inside the grid window).

---

## 1) Transport, Auth & Topology

**Transport**
- Native **WebSocket** over **WSS** (no Socket.IO).  
- Required subprotocol: **`bitby.v1`**; close with **1002** if missing/wrong.  
- Server pings every **15s**; disconnect after **2 missed pongs**. Client pings if server quiet > 20s.  
- **Max WS message size:** **64 KB** → reject with `payload_too_large`.

**Message envelope (canonical for all ops)**
```json
{ "op":"string", "seq":123, "ts":1737654321, "data":{ ... } }
```
- `seq`: client-side monotonically increasing; echoed in acks.

**Auth**
- REST `/auth/login` with username + Argon2id password → JWT (HS256).  
- On WS open: `{op:"auth", seq, data:{token}}` → `auth:ok` with profile + room snapshot.  
- JWT short TTL; rotation via REST.

**Topology**
- Node.js (TypeScript) stateless WS/API + **Postgres** (primary data) + **Redis** (presence/pubsub/caches).  
- TLS at LB/ingress; WS upgrade pass-through.  
- No sticky sessions (room state in Redis). Soft instance cap ~**3–5k WS / 2 vCPU**.

---

## 2) Grid Geometry (Deterministic & Unambiguous)

**Constants**
- `tileW = 75px`, `tileH = 90px`, `rowStep = tileH/2 = 45px`
- **Per-row columns:** even `y` → **10**, odd `y` → **11**, across exactly **10 rows** (`y = 0…9`).

**Anchoring (top-right)**
- `rowRightSpan(y) = cols(y)*tileW + (y%2 ? tileW/2 : 0)`
- `Wmax = max_y(rowRightSpan(y))` across visible rows
- Canvas width `canvasW` **excludes** the right panel but reserves fixed gutters:
  - `gutterTop = 50`
  - `gutterLeft = gutterRight = 25`
  - `gutterBottom = 0`
  - `originX = max(gutterLeft, canvasW - gutterRight - Wmax)`
  - `originY = gutterTop`

**Tile → screen**
```
sx = originX + x*tileW + (y%2 ? tileW/2 : 0)
sy = originY + y*(tileH/2)
```

**Diamond hit test (fixed)**
```
dx = (px - (sx + tileW/2)) / (tileW/2)
dy = (py - (sy + tileH/2)) / (tileH/2)
abs(dx) + abs(dy) <= 1
```

**Rectangular field (full diamonds only)**
- Tile `(x,y)` is valid iff:
```
[sx,sy] = toScreen(x,y)
sy >= originY && (sy + tileH) <= (originY + gridH)
```
- With `tileH=90`, `rowStep=45`, use **`gridH=495`** to span the fixed **10-row** field → natural **10/9 vertical alternation** by parity (no special cases).
- **Left gutter** remains empty to the canvas edge.

**Per-tile flags (room config)**
- `locked` (movement blocked)  
- `noPickup` (pickup disabled)  
- `link_url` or `link_room_id` (open right-panel page / teleport to another room)

**Z-order & names**
- **Items below avatars**.  
- Avatar stack key: sort by **(y, then x)** so a person “under” (greater y) renders **in front**.  
- Usernames draw **behind** their own avatar (may be occluded by someone in front).  
- Pickup affordances render **topmost** and **must not** trigger movement.

---

## 3) Core UX

**Stage frame**
- Stage chrome is pinned to a fixed footprint defined by the design tokens so the top bar, canvas window, right panel, bottom dock, and chat drawer remain pixel-perfect even if the browser viewport shrinks. The layout anchors to the left gutter on desktop so the freestanding chat drawer stays within a 1920 × 1080 stage without introducing scrollbars, and the canvas surface must stretch from the status bar directly down to the bottom dock with no vertical whitespace.

**Right panel**
- Fixed width **500px**, full height; **not** slideable, with header copy tucked close to the top edge, a slim accent divider beneath the title, and dense text sections that stretch across the column so the footprint stays visually active without form fields. It spans the entire canvas + menu stack so the dock aligns beneath the playfield, and every corner stays square except for the rounded bottom-right junction.
- Chat history renders in a freestanding, fully rounded card immediately to the panel’s right with a fixed **5px** gutter separating them, stretching from the top status bar to the bottom menu. It opens by default and can be hidden only via the top-bar chat icon without shifting the canvas or panel. Native scrollbars stay hidden while a **“Back to top”** affordance appears only after scrolling, timestamps wait 500 ms on hover/focus with the tooltip anchored to the hovered card, rows alternate colour, start flush beneath the header, and now run edge-to-edge while the message copy sits inside a 3 px inset down to the drawer base. The chat header exposes an **!** toggle that instantly hides/shows system messages (with a tooltip reflecting the current state) without disturbing surrounding layout.
- Item **Info** opens in the panel (no popups).

**Primary menu bar**
- Permanently attached beneath the playfield, matching the canvas width exactly with only the bottom-left corner rounded so it nests into the stage radius while all other corners stay square. Buttons stay compact (~36px tall) and auto-resize to evenly fill the available width regardless of button count.
- Buttons: **Rooms, Shop, Log, Search, Quests, Settings, Admin**.
- Menu cannot be collapsed or hidden; it remains fixed to the stage bottom.

**Top status bar**
- Flush with the stage top edge and shows player name, an accent-coloured single-line readout that lists **Level → coins** in that order, plus a looping news ticker.
- Paired round icon buttons sit on the far right: a **? Support** button and a **chat bubble** toggle. Both surface labelled tooltips on hover/focus so their purpose remains clear.

**Admin quick menu**
- A pill-shaped, button-only admin quick menu sits just below the bottom dock (outside the main stage container) with a nearly flush **2px** gap separating the two. It only appears when the bottom-bar **Admin** button is active, lists quick actions (e.g., reload room, toggle grid, latency trace), rests on its own layer so no surrounding layout shifts when toggled, and will later gate to admin accounts. During development builds it spawns visible by default so screenshots/demos always capture the admin affordances.

**Input precedence**
1) **Left-click item** (painted rect/alpha) → open **Item Info** in panel.  
2) **Left-click avatar** does **not** consume; preserve **click-through**.  
3) **Left-click tile** → **move** (optimistic; server validates).

**Right-click**
- **Grid**: show **only items** on that tile.  
  - Actions per item: **Info** (always) → panel; **Saml Op** only if user **stands** on that tile and tile not `noPickup`.  
- **Player**: right-click avatar → player menu (profile/actions).  
- Always `preventDefault()`; long-press on touch.

**Typing bubble**
- Preview bubble follows avatar while typing; **more visible** (reduced transparency, but readable).  
- When message is sent: commit bubble and append to panel log. If typing while a sent bubble exists, temporarily hide the sent bubble behind the preview.

---

## 4) Avatar Rendering (Pre-Rendered 3D → 2D Paper-Doll)

**Art pipeline**
- All avatar assets originate from 3D and are **pre-rendered** to **2D PNG** layers aligned to a common **pose origin** (foot midpoint).  
- Each clothing/hair/accessory exports **layer PNGs** + **slot offsets** (`dx,dy,scale,flipX`) at **1×**, optionally **2×**.  
- Optional idle/blink/gesture via short **frame sequences**.

**Pose origin**
- Avatar **foot midpoint** at the tile’s bottom center. Slot offsets are relative to this origin.

**Layer order (back → front)**
1) shadow  
2) skin_base (masked recolor for skin tone)  
3) pants  
4) shoes  
5) shirt  
6) beard (default over shirt)  
7) hair_back  
8) handheld_back  
9) jacket (optional)  
10) handheld_front (multiple allowed; ordered, with **weight** cap)  
11) hair_front  
12) glasses  
13) hat  
14) UI bubbles (not part of paper-doll)

**Offsets per proto/slot**
```json
{ "dx":0, "dy":-6, "scale":1.0, "flipX":false }
```
- 1× coordinates; multiply by DPR at render time.  
- If an offset pushes a layer entirely off the **75×125** avatar bbox, **clamp** to edges and log a warning.

**Conflicts & masks**
- Protos may declare `hidesSlots: ["hair_front","hat"]`.  
- `hairCutMask` from hat clips hair layers. If both clash, hair is kept unless `hidesSlots` says otherwise.

**Performance**
- **Composite caching**: pre-compose the outfit (including recolors) into an offscreen target; **LRU** keyed by SHA-256 of slots+colorways+offsets.  
- **Two-level cache**: (1) tinted region cache (per region) → (2) outfit composite cache.
```yaml
renderCache:
  maxComposites: 2000
  maxTintedRegions: 5000
  devicePixelRatioCeiling: 2
```

**Alternate “sprite-pack” mode (optional)**
- For premium outfits, ship **fully baked outfit sprites** (single PNG per frame/pose).  
- Select per outfit: **paper-doll** (layered) or **sprite-pack** (flat).

---

## 5) Recolor System

**Proto fields**
```json
{
  "recolorable": true,
  "recolor_mode": "hsl",
  "recolor_masks": { "regions":[
    { "id":"fabric", "maskUrl":"/assets/..._fabric_mask.png" },
    { "id":"wood",   "maskUrl":"/assets/..._wood_mask.png" }
  ]},
  "recolor_limits": {
    "hsl":  { "h":[0,360], "s":[0,0.6], "l":[0.2,0.85] },
    "tint": { "amount":[0,0.7] }
  },
  "recolor_presets": { "cloud":"hsl(210,0.12,0.88)" }
}
```

**Client apply**
- Prefer **GPU** (WebGL shader/filter) to recolor masked regions; CPU fallback via offscreen canvas.  
- Multi-region items: tint each region separately, then composite.

**Server validate**
- Ensure region ids exist; mode matches; values within limits; store normalized colorway.
```yaml
recolor:
  cacheMaxRegions: 5000
  cacheMaxComposites: 2000
  eviction: "LRU"
  presetsPrebakeToCDN: true
```

---

## 6) Items, Wear & Handhelds

**Items**
- **Pre-rendered 3D** shipped as **2D sprites** (PNG).  
- Each item has a **pivot** at its base; bottom edge may **not** render below the tile bottom (clamp or reject).  
- Optional idle animation via frames.

**Wear slots**
- `hat, hair, glasses, beard, shirt, pants, shoes, handheld (multi)`.

**Handhelds with weight**
```yaml
handhelds:
  maxWeight: 10
  perUserEquipLimit: 5
  duplicatePolicy: "uniqueProto"  # or "allow"
```
- Each handheld proto defines `weight` (1–10). Sum ≤ maxWeight; only one per exact proto unless policy allows duplicates.

**Pickups**
- Only from the same tile; suppressed if `noPickup`.  
- Pickup UI must be **topmost** and **not** cause movement underneath.

---

## 7) Economy & Transfers

**Coins**
- Append-only **ledger** (`coin_ledger`); balance = SUM(ledger).  
- Purchases, trades, grants write ledger entries with reason/ref.

**Item transfers**
- `pending → applied | reverted`; watchdog reverts **pending > 30s**.  
- Metrics: `bitby_item_transfers_total{status}`.

---

## 8) Realtime Protocol (Selected Ops)

**Auth**
```json
{ "op":"auth", "seq":1, "ts":..., "data":{ "token":"<JWT>" } }
{ "op":"auth:ok", "seq":1, "ts":..., "data":{
  "user":{...}, "room":{...},
  "catalogVersion":42, "layout":{...}, "lockedTiles":[...]
}}
```

**Move**
```json
{ "op":"move", "seq":7, "ts":..., "data":{ "x":6, "y":8 } }
{ "op":"move:ok",  "seq":7, "ts":..., "data":{ "x":6, "y":8, "roomSeq":991 } }
{ "op":"move:err", "seq":7, "ts":..., "data":{ "code":"locked_tile", "at":{"x":6,"y":8}, "roomSeq":992 } }
```

**Chat**
```json
{ "op":"chat:send", "seq":9, "ts":..., "data":{ "body":"hej", "idempotency":"k9v..." } }
{ "op":"chat:new",  "ts":..., "data":{ "id":"m123", "userId":"u2", "body":"hej", "roomSeq":1001 } }
```

**Catalog**
```json
{ "op":"catalog:delta", "ts":..., "data":{ "from":41, "to":42, "patch":[...], "sig":"hmac..." } }
```

---

## 9) State Sync, Backpressure & Recovery

**roomSeq**
- Incremented for every broadcast tick; coalesce allowed.

**Client limits**
- If client **misses > 10** sequential `roomSeq` updates → request **`room:full`** snapshot.  
- Server throttles full snapshots per room (e.g., **5/sec**) with jitter; reply with `retry_after_ms` if capped.

**Server coalesce mode**
- If room queue > **1000** or lag > **300ms**, coalesce into summary frames at ~20 Hz; keep roomSeq monotonic.

**Backpressure**
- Per-connection send queue caps: **200 msgs** or **1 MB**; drop **non-critical** first (typing/presence).  
- Metrics: `bitby_ws_send_queue_len`, `bitby_ws_backpressure_drops_total`.

**Reconnect**
- Exponential backoff (200ms → 5s), jitter; send last `roomSeq` & `catalogVersion`.
- UI: display **blocking reconnect overlay**; disable all input (movement, clicks, menus) until WS re-auth & room snapshot/delta are applied.

---

## 10) Security & Anti-Abuse

**REST**
- HTTPS only; **CSRF** (double-submit cookie or SameSite=strict + token).  
- Parameterized SQL (no string concatenation).  
- Rate limits (per IP): `/auth/login` ≤ 5/min; `/catalog` ≤ 30/min; uploads ≤ 10/min.

**WS**
- Per-user (progressive penalties): move ≤ **12/s**, chat ≤ **6/s**, typing ≤ **6/s**, item ≤ **3/s**, join/teleport ≤ **2/min**.  
- Per-IP connection cap: **20**.  
- Progressive penalties: warn → slow mode → temp kick → ban.

**Uploads**
- Extension allow-list + content-type sniff + size cap + AV scan + image moderation.

**Anti-AFK**
- Keep-alive prompt or micro-captcha after N minutes; failure → AFK or soft kick in busy rooms.

**Anti-cheat**
- Client caches locked tiles; server authoritative.  
- Autoclicker detection via **min inter-click**, burst/avg stats, variance, progressive penalties.

---

## 11) Catalog & Caching

**Catalog (prototypes)**
- `catalog_item_proto`: `id, name, kind(furniture|wearable|handheld|bot), slot?, is_handheld?, weight?`, `sprite_urls jsonb`, `paper_doll_layer`, `default_offsets jsonb`, recolor fields, `version int`.

**Instances**
- `item_instance`: unique id per owned/placed item (`owner_id`, `room_id`, `x,y`, `colorway`, `state`).  
- Wear: `wear_slot(user_id, slot, item_instance_id, colorway, offsets)`, `wear_handheld(user_id, item_instance_id, order_index)`.  
- Avatar: `avatar(user_id, room_id, x, y, skin_colorway, skin_mask_url)`.

**Versioning & signatures**
- Client gets **full** catalog + **HMAC signature** on join; receives **deltas** thereafter.  
- If `>5` versions behind → force **full** fetch.  
- Client caches are signed; tamper → reject & refetch.

---

## 12) Database (Postgres) — Core Schema

> UUIDs, JSONB where appropriate, `timestamptz` timestamps. Key columns shown.

```sql
-- Users & auth
CREATE TABLE app_user (
  id uuid PRIMARY KEY,
  username citext UNIQUE,
  display_name text,
  role text CHECK (role IN ('owner','moderator','vip','user')),
  pass_hash text,
  coins bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  flags jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX idx_user_username ON app_user (username);

CREATE TABLE session (
  id uuid PRIMARY KEY, user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  token_id uuid UNIQUE, issued_at timestamptz, expires_at timestamptz,
  ip inet, ua text
);

-- Rooms & layout
CREATE TABLE room (
  id uuid PRIMARY KEY, key text UNIQUE, name text,
  kind text CHECK (kind IN ('public','private')),
  owner_id uuid REFERENCES app_user(id),
  layout jsonb NOT NULL,  -- tileW/H, gridH, rowsEvenCols, rowsOddCols, anchor, paddings
  created_at timestamptz DEFAULT now()
);

CREATE TABLE room_tile_flag (
  room_id uuid REFERENCES room(id) ON DELETE CASCADE,
  x int, y int,
  locked boolean DEFAULT false,
  no_pickup boolean DEFAULT false,
  link_url text, link_room_id uuid REFERENCES room(id),
  PRIMARY KEY (room_id,x,y)
);

-- Catalog
CREATE TABLE catalog_item_proto (
  id uuid PRIMARY KEY, name text, kind text, slot text,
  is_handheld boolean DEFAULT false, weight int DEFAULT 1,
  sprite_urls jsonb, paper_doll_layer text,
  default_offsets jsonb,
  recolorable boolean DEFAULT false, recolor_mode text,
  recolor_masks jsonb, recolor_presets jsonb, recolor_limits jsonb,
  version int NOT NULL
);
CREATE INDEX idx_catalog_version ON catalog_item_proto(version);

-- Items
CREATE TABLE item_instance (
  id uuid PRIMARY KEY, proto_id uuid REFERENCES catalog_item_proto(id),
  owner_id uuid REFERENCES app_user(id),
  room_id uuid REFERENCES room(id),
  x int, y int, colorway jsonb, state jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_item_roomxy ON item_instance(room_id,y,x);
CREATE INDEX idx_item_owner ON item_instance(owner_id);

-- Wear
CREATE TABLE wear_slot (
  user_id uuid, slot text, item_instance_id uuid REFERENCES item_instance(id),
  colorway jsonb, offsets jsonb,
  PRIMARY KEY (user_id, slot)
);
CREATE TABLE wear_handheld (
  user_id uuid, item_instance_id uuid REFERENCES item_instance(id),
  order_index int, PRIMARY KEY (user_id, item_instance_id)
);

-- Avatar (position & skin)
CREATE TABLE avatar (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  room_id uuid REFERENCES room(id), x int, y int,
  skin_colorway jsonb, skin_mask_url text, updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_avatar_room ON avatar(room_id);

-- Economy
CREATE TABLE coin_ledger (
  id bigserial PRIMARY KEY, user_id uuid REFERENCES app_user(id),
  delta bigint, reason text, ref_id uuid, created_at timestamptz DEFAULT now()
);
CREATE TABLE item_transfer (
  id uuid PRIMARY KEY, from_user uuid, to_user uuid,
  item_id uuid REFERENCES item_instance(id),
  status text CHECK (status IN ('pending','applied','reverted')),
  started_at timestamptz DEFAULT now(), finalized_at timestamptz
);

-- Chat & moderation
CREATE TABLE chat_message (
  id bigserial PRIMARY KEY, room_id uuid REFERENCES room(id),
  user_id uuid REFERENCES app_user(id), body text,
  ts timestamptz DEFAULT now(), deleted boolean DEFAULT false
);
CREATE INDEX idx_chat_room_ts ON chat_message(room_id, ts, id);

-- Bots & plugins
CREATE TABLE bot (
  id uuid PRIMARY KEY, room_id uuid REFERENCES room(id), name text,
  behavior jsonb, script_id uuid
);
CREATE INDEX idx_bot_room ON bot(room_id);
CREATE TABLE plugin_script (
  id uuid PRIMARY KEY, name text, code text, manifest jsonb, enabled boolean DEFAULT true
);

-- Audit
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY, user_id uuid, action text, ctx jsonb, ts timestamptz DEFAULT now()
);
```

**Indexes (extras)**  
`wear_slot (user_id, slot)`, `item_transfer (status, started_at)`, `coin_ledger (user_id, created_at)`

**Transactions**
- Moves: **Redis only**, no DB write.  
- Critical ops (ledger/trades/purchases): **REPEATABLE READ + FOR UPDATE** or **SERIALIZABLE**.  
- On `40P01/40001`: retry ≤3 with jitter; else error.  
- Pending → applied/reverted (no partials).

**Pooling & migrations**
- `pg` pool per instance (min 10 / max 50; tune).  
- **pgBouncer** (transaction mode) in prod.  
- Migrations via node-pg-migrate/Prisma/Drizzle; CI blocks deploy on failure.

---

## 13) Redis, Pub/Sub, Presence

**Redis**
- Managed Redis with **Sentinel/Cluster**; reconnect with jittered backoff.  
- `maxmemory` policy `volatile-lru`; TTL for ephemeral keys.

**Channels**
- `room.{roomId}.events`  
- `user.{userId}.notify`  
- `catalog.updates`  
- `system.broadcast` / `system.config.v{n}`

**Presence/state**
- Positions, typing, locked tiles, layout caches in Redis.  
- Snapshot avatar positions to DB every **30–60s** and on room exit.

---

## 14) Admin, Bots & Plugins

**Admin**
- Room editor: lock tiles, set `noPickup`, tile links (URL/room), background, layout consts.  
- Offsets editor: slot offsets saved to proto (applies to everyone).  
- Catalog editor: create once (e.g., “Green Plant”) → instances uniform.  
- Users: roles, coins, grant/spawn items, move, kick/ban, audit.  
- Bots: click actions to open panel URL, give items, check inventory, run quests.  
- Users can buy **private rooms** for **100 coins**; Teleport shows public + owned rooms.

**Bots**
- Server-side entities (`bot` table), rendered as clickable sprites or NPC items.  
- Actions: `openPanelUrl(url)`, `giveItem(protoId,count,ifHasNot?)`, `checkInventory(protoId)`, `startQuest/advanceQuest`.  
- Quest state: `user_quest_state(user_id, quest_id, step, vars jsonb)`.

**Plugins** (security & resource limits)
- Runtime: **isolated-vm** in **Worker Threads**.  
- Per-hook limits: **50ms** hard cap (target p95 ≤ 10ms); worker memory limits (e.g., `{ maxOldGenerationSizeMb: 64 }`).  
- Hooks async; if deadline exceeded → **terminate worker**, dispose isolate, count error; **quarantine** plugin after repeated timeouts.  
- JSON-RPC only; **no FS/net/process/eval**; permissioned manifest:
```json
{ "name":"quest-mgr",
  "perms":["readRoom","readUser","writeChat","grantItem:bounded","coins.modify:bounded"] }
```
- Metrics: `bitby_plugin_execution_time_ms{plugin,hook}`, `bitby_plugin_errors_total`.

---

## 15) Assets & CDN (Sprite Specifics)

- Sprite sheets (1× / 2×) + JSON maps; names include **SHA-256** content hash; immutable caching.  
- **Rooms**: pre-rendered 3D backgrounds (large PNG/JPG).  
- **Avatars**: per-slot layers and/or **sprite-pack frames** (idle/blink/gesture).  
- **Items**: single-view sprites + optional frames.

**Metadata JSON example**
```json
{
  "scale": 1.0,
  "pivot": { "x": 0.5, "y": 1.0 },
  "frames": { "idle":[0,1,2], "blink":[10,11] },
  "bbox": { "w":75, "h":125 },
  "layers": ["skin_base","shirt","hair_front"],
  "offsets": { "shirt": {"dx":0,"dy":-6} }
}
```

**Preload & fallback**
- **Critical-first**: room background, visible item sprites, visible users’ layers; then warm cache for nearby rooms/common items.  
- Retry: 3 attempts (100/500/2000ms); fallback `/assets/missing.png`.  
- If a critical layer fails: render base skin + label; mark **degraded**; metric + retry.  
- Load **2×** sheets if `devicePixelRatio ≥ 1.5`.

---

## 16) UI / Theme (Chrome Only)

**Scope**
- Theme affects **UI chrome** (panel, dock, menus, forms, toasts).  
- Theme **must never** change canvas visuals (grid/avatars/items/bubbles).

**Tokens**
- Light: `#2F80ED` primary, `#6FCF97` success, `#F2C94C` accent, bg `#F7FAFF`, surface `#FFF`, text `#0F141A`, outline `#D8E3F0`.  
- Dark:  `#4DA3FF` primary, `#22D1A0` success, `#FFD166` accent, bg `#0B0E13`, surface `#111824`, text `#EAF2FF`, outline `#223042`.  
- Corners `14px`; shadow `0 10px 28px rgba(0,0,0,.08)`.  
- Type: Inter 14px; headings: h1 24, h2 18, h3 16.

**Components**
- Buttons: Primary (filled), Ghost (outlined); min hit 40×40.  
- Context menu: z-index high; title “On this tile”; Info/Saml Op inline; click-through not allowed while open.  
- Primary menu bar: fixed to the stage bottom, spans canvas + panel, cannot collapse, and keeps only the bottom-left corner round while the remaining corners stay square.
- A11y: focus ring 2px, contrast AA+, keyboardable; `Esc` closes menus; respect `prefers-reduced-motion`.  
- Visual stability test: switching theme must **not** alter any canvas pixels (checksum render).

---

## 17) Observability, Alerts & Runbooks

**Health & SLOs**
- `/healthz` (liveness), `/readyz` (readiness).  
- SLOs: auth p95 < 300ms; move RTT p95 < 120ms (same region); WS disconnect rate < 0.5%/hr.

**Metrics (Prometheus)**
- WS: `bitby_ws_active`, `bitby_ws_send_queue_len`, `bitby_ws_backpressure_drops_total`  
- Redis: `bitby_redis_lag_ms`, `bitby_redis_reconnections_total`  
- Catalog: `bitby_catalog_delta_applied_total`, `bitby_catalog_full_fetch_total`  
- Movement/Items: `bitby_move_reject_total{reason}`, `bitby_snapbacks_total`, `bitby_item_pickups_total`, `bitby_item_transfers_total{status}`  
- Security: `bitby_rate_limit_violations_total{op}`, `bitby_ip_conn_limit_drops_total`, `bitby_ghost_connections_total`  
- Plugins: `bitby_plugin_execution_time_ms{plugin,hook}`, `bitby_plugin_errors_total`  
- Rooms: `bitby_room_population{room}`, `bitby_room_events_total{type}`

**Alert thresholds**
```yaml
alerts:
  redisLagMs:              { warn: 200,  crit: 500 }      # sustained 5m
  wsActivePctCapacity:     { warn: 85,   crit: 92 }
  snapbacksPerMin:         { warn: 30,   crit: 100 }      # per room
  fullSnapshotsPerMin:     { warn: 20,   crit: 60 }       # per room
  catalogFullFetchBurst:   { warn: 20,   crit: 50 }       # /10m
  cdn404PerMin:            { warn: 25,   crit: 100 }
  dbDeadlocksPerMin:       { warn: 3,    crit: 10 }
```

**Runbooks (samples)**
- **Redis lag > 500ms**: check network/CPU; fail over; coalesce mode on; reduce typing broadcasts.  
- **WS > 92% cap**: autoscale; ensure LB healthy; verify backpressure drops ≈ 0.  
- **Snapbacks spike**: check new locks/flags; verify locked-tile cache version; push delta.  
- **Catalog full fetch spike**: verify publisher; if deltas >5 rapidly, raise `deltaBackfillMax` or throttle edits.  
- **CDN 404 burst**: verify deploy order; ensure hash manifest published; roll back if needed.  
- **DB pool saturation**: increase pool; inspect slow queries; enable read-only for shop/transfers temporarily.

**Error tracking**
- Sentry (client/server) with build hashes; configurable sample rates.

---

## 18) Deployment, Environments & Config

**Environments**
- dev / staging / prod, isolated DB/Redis and config.

**Docker**
- Containers: api, ws, worker, web (static). **Blue/green** preferred; WS drain on redeploy.

**Migrations**
- Up/down with CI gating; block deploy on failure; rollback strategy in place.

**Config storage & hot reload**
- Config table in Postgres (versioned) + file in dev.  
- Admin change → publish `system.config.v{n}` via Redis.  
- Instances pull, **validate schema**, apply **hot-reloadable** keys: rate limits, plugin budgets, sync thresholds, cache sizes, asset retry.  
- Non-hot keys (transport frame sizes, DB pool sizing, runtime engine) set **`restartRequired=true`**.

**Example config schema**
```yaml
grid:
  tileW: 75
  tileH: 90
  topPadding: 40
  gridH: 495
  rowsEvenCols: 15
  rowsOddCols: 14
  anchor: "top-right"

transport:
  ws:
    subprotocol: "bitby.v1"
    maxMessageBytes: 65536
    heartbeatSec: 15
    backpressure: { maxQueuedMsgs: 200, maxQueuedBytes: 1048576 }

limits:
  movePerSec: 12
  chatPerSec: 6
  typingPerSec: 6
  itemPerSec: 3
  joinPerMin: 2
  ipConnMax: 20

assets:
  cdnBase: "https://cdn.bitby.dk"
  spriteSheets: true
  fallbackImage: "/assets/missing.png"
  retryPolicy: { attempts: 3, backoffMs: [100, 500, 2000] }
  density: { use2xIfDPRGe: 1.5 }

sync:
  maxMissedUpdates: 10
  conflictResolution: "server-wins"
  clientStateValidation: true

coalesce:
  enable: true
  roomQueueMax: 1000
  lagMsCrit: 300
  fullSnapshotPerRoomPerSec: 5

renderCache:
  maxComposites: 2000
  maxTintedRegions: 5000
  devicePixelRatioCeiling: 2

handhelds:
  maxWeight: 10
  perUserEquipLimit: 5
  duplicatePolicy: "uniqueProto"

plugins:
  worker:
    cpuMsHardCap: 50
    p95TargetMs: 10
    resourceLimits: { maxOldMb: 64, maxYoungMb: 16 }
  quarantine:
    timeoutsPer5MinCrit: 5

restRateLimits:
  /auth/login: { perIpPerMin: 5 }
  /catalog:    { perIpPerMin: 30 }
  /upload:     { perIpPerMin: 10 }

csrf:
  strategy: "double-submit-cookie"

sql:
  paramBinding: "always"
```

### 18.1) Graceful Restart Workflow (non-hot keys)

**Goal:** Apply non-hot config without user disruption.

**Server lifecycle (per instance)**
1) **Pre-drain**: `/readyz` → false; stop new connections.  
2) **Announce** (optional):  
   ```json
   { "op":"system:maintenance", "data":{ "shutdown_in_ms":15000, "reason":"config-apply" } }
   ```
3) **Drain window** (default 20–30s; adaptive, see 18.2): finish in-flight ops; stop new hooks/jobs.  
4) **Close** remaining sessions: send final frame with `retry_after_ms`, then WS close **1012**.  
5) **Shutdown**: flush logs/metrics; SIGTERM hard cap ~30s.

**Client behavior**
- Show **blocking reconnect overlay**; on close (1012/1013) reconnect with backoff (min `retry_after_ms`); send last `roomSeq` & `catalogVersion`; hide overlay only after `auth:ok` + room resync.

**Config knobs**
```yaml
restart:
  drainMs: 20000
  wsCloseCode: 1012
  clientRetryAfterMs: 800
  batchPercent: 20
  pauseBetweenBatchesMs: 5000
  abortIf:
    redisLagMsOver: 500
    wsActivePctOver: 92
    fullSnapshotsPerMinOver: 60
```

### 18.2) **Region-Aware Maintenance Windows & Deploy Scheduling**

**Purpose:** Avoid disruption globally by batching non-urgent restarts into **region-local** low-traffic windows.

**Region windows (examples)**
```yaml
maintenance:
  windows:
    - id: "eu-cph-nightly"
      region: "eu-cph"
      tz: "Europe/Copenhagen"
      cron: "0 3 * * *"
      durationMin: 180
    - id: "us-east-nightly"
      region: "us-east"
      tz: "America/New_York"
      cron: "0 3 * * *"
      durationMin: 180
    - id: "ap-sg-nightly"
      region: "ap-sg"
      tz: "Asia/Singapore"
      cron: "0 3 * * *"
      durationMin: 180
  allowUrgent: true
  preNotifyMin: 30
  bannerText: "Planlagt vedligeholdelse i {region} starter om ~{minutes} min."
  restartBudgetPer24h: 2
  extendDrainIfActive:
    activeUsersThreshold: 5000
    maxDrainMs: 120000
  gating:
    maxWsActivePct: 85
    maxRedisLagMs: 200
    maxFullSnapshotsPerMin: 20
```
- Deploy **per region**, not globally, unless urgent.  
- Banners show **local time** and **region label**.  
- If gating exceeded in a region, **auto-defer** to next window.

### 18.3) **Green Environment Pre-Cutover Health Checks**

**Must-pass checks**
1) **Process/HTTP**: `/healthz` & `/readyz` 200; build hash matches.  
2) **DB**: pool up; schema at target; smoke `EXPLAIN` (<5ms p95).  
3) **Redis**: `PING`; pub/sub round-trip p95 < 50ms.  
4) **Assets/CDN**: fetch canaries (SHA-256 verified); headers correct; fallback exists.  
5) **Synthetic WS**: WSS + `bitby.v1` → `auth:ok`; join; move/ack; chat/broadcast; catalog full+delta+HMAC OK.  
6) **Plugins**: trivial hook ≤ 10ms; memory caps applied; error path logs.  
7) **Metrics/Logging**: Prom targets up; Sentry test error visible.  
8) **Config bus**: pull latest config; apply hot keys; non-hot show `restartRequired`.

**Cutover**
- Require **3 consecutive passes** (e.g., 1 min apart) before routing traffic.  
- Post-cutover watch 10–15 min; failback if any metric crosses **crit**.

---

## 19) Data Management & Compliance

- **Backups**: daily full + WAL; periodic restore drills.  
- **Retention**: chat (e.g., 180d), logs (90d); IP minimized.  
- **GDPR**: user export & delete; cascade to avatar/wear/inventory; keep ledger anonymized if needed.  
- **PII**: minimal; encrypted at rest & in transit.

---

## 20) Seeds & Defaults

- Users with **1,000,000 coins**: `test` (owner), `test2` (moderator), `test3` (vip), `test4` (user).  
- At least one public room; private rooms purchasable for **100 coins**.  
- Starter items (e.g., couch, coin pile) and a bot that opens a right-panel page & grants an item.

---

## 21) Scale & Multi-Region

- Single-region target: ws instance (2 vCPU) ~**3–5k CCU**; Redis (1–2 GB) >50k presence keys; Postgres (2 vCPU/8–16 GB) low-hundreds QPS.  
- Rough core infra cost at 5–20k CCU: **$0.003–0.008 / CCU / hr** (compute+Redis+DB; excludes CDN).  
- Beyond ~20k CCU: add ws nodes; hot-room partition services.  
- Multi-region: region-local room authority; latency-routed DNS; catalog/CDN global; cross-region chat via streams/Kafka; teleport cross-region triggers reconnect.  
- **Region-aware maintenance** (see 18.2) to avoid peak-hour disruption.

---

## 22) Monetization (Phase-Gated)

> Monetization is **deferred** to the end. Only **ad banner slots** may be enabled early. **No real-money flows** in MVP.

**Ad slots (chrome only—never in the grid window)**
- Placements: e.g., below the right panel or above the dock.  
- Sizes: `728×90` (leaderboard), `300×250` (MPU).  
- Feature-flagged; disabled by default in dev.  
- GDPR: consent gating; no ad SDKs before consent.  
- Resilience: timeouts, house-ads fallback; do not block render thread; must not change canvas size/position.

```yaml
ads:
  enabled: false
  slots:
    - id: "panel-bottom-mpu"
      size: "300x250"
      placement: "panelBottom"
    - id: "top-leaderboard"
      size: "728x90"
      placement: "header"
  loadTimeoutMs: 2500
  consentRequired: true
  houseAdsFallback: true
```

---

## 23) Documentation & Contracts (Lean, Practical)

> Keep it **useful, minimal, consistent**.

- **Public APIs (server & client):** Use **TSDoc** for exported functions/types.  
- **WebSocket ops:** Maintain **JSON Schemas** per `op` (versioned in `schemas/ws/`). Include 1–2 example payloads next to each schema.  
- **REST endpoints:** Maintain **OpenAPI 3.1** for `/auth` and any other REST routes.  
- **Module READMEs:** Each module/package gets a short README with **purpose, invariants, key deps, spec refs**.  
- **ADRs:** Recommended (not mandatory) for non-trivial architectural changes.  
- **ERD:** Generate an updated DB ER diagram when schema changes (tooling of choice).  
- **No % doc-coverage gates.** Code should be clear first; comments explain **intent** where not obvious.

---

# Appendix A — UX/UI Extras (Design Playbook)

> Refines visual/interaction details without changing any rules about the **grid window** (deterministic canvas that never theme-shifts). Treat as strong guidance; if you must deviate, prefer the smallest change that preserves clarity and speed.

## A.1 Layout & Anchoring (Chrome around the grid)

- **Stage container (fixed)**: A fixed-size “stage” holds: **top status bar**, **grid canvas** (anchored **top-right**), **right panel** (fixed 500px), and a **primary menu bar** bonded to the bottom edge. If the browser window is smaller than the stage, allow natural clipping—**never** reflow the canvas.
- **Safe areas**: Maintain 8–12px gutters between canvas edges and overlay chrome (dock, debug badges).
- **Scroll**: Right panel scrolls internally; stage never scrolls the canvas.

## A.2 Visual Language & Tokens

- Typography: Inter (fallback: system-ui). Base 14px; h1 24, h2 18, h3 16.  
- Color tokens are as in §16. Do **not** introduce new colors; derive shades by opacity (0.08/0.12/0.24) rather than new hexes.
- Elevation: single soft shadow `0 10px 28px rgba(0,0,0,.08)` across components.

## A.3 Buttons & Controls

- Primary button: 44px height, 12px horizontal padding min, bold label. Disabled state reduces opacity to 50% and removes shadow.
- Ghost/Outline: 1px outline (token `outline`), hover raises to 2px with slight background tint (token primary at 6%).
- Icon buttons: 40×40 min target; tooltip on hover after 600ms.

## A.4 Primary Menu Bar (Fixed)

- Height **64px**; spans the entire stage width beneath the playfield and panel with top corners flush and bottom corners rounded 14px.
- Always visible; no collapse, slide, or hide affordance.
- Button order: **Rooms, Shop, Log, Search, Quests, Settings, Admin**. Keep icons+labels visible.
- Z-index above the canvas chrome but below context menus; integrates with the stage shadow without overlap.

## A.5 Right Panel

- Header with title and optional subtitle/breadcrumb.  
- **Sections**: Profile / Item Info / Chat Log (panel width locked at 500px; chat log keeps its footprint even when collapsed).
- Chat log hides native scrollbars, surfaces a **“Back to top”** affordance only after scrolling, lays alternating rows flush beneath the header all the way to the drawer base, and reveals timestamps via tooltip after 500 ms hover/focus.
- Item Info replaces panel body; back affordance (chevron) returns to previous view.

## A.6 Context Menus

- **Grid right-click**: shows **items only on that tile**. For each item: name + buttons [**Info**] and [**Saml Op**] (pickup only if user stands on that tile and tile not `noPickup`).  
- **Player right-click**: shows actions (View profile, Trade, Mute, Report… per role/permissions).  
- Max width 320px; keyboard accessible; escape closes; clicks outside close; menu never scrolls canvas.

## A.7 Chat Bubbles & Typing

- **Preview bubble**: slightly translucent (e.g., 88–92% opacity), follows avatar while typing; higher z-index than avatars; disappears on send or Esc.  
- **Sent bubble**: solid fill; tail points towards the avatar head. If another avatar stands **in front** (greater y), their sprite can overlap the bubble’s tail; this is acceptable.  
- Max width 260px; clamp long words; support basic emoji.
- Font: same as UI; 14px; contrast AA+.

## A.8 Avatars & Names

- Avatar bbox **75×125**; foot midpoint anchored to tile bottom center.  
- Username renders **behind** the avatar; becomes occluded if someone stands in front (greater y).  
- Roles (optional color coding): owner (gold), moderator (blue), vip (purple), user (default). Use **thin 1px outline** for readability on bright rooms.

## A.9 Items & Interactions

- Click target equals painted pixels (alpha > 0.1) with a 2–3px padding rectangle to aid selection.  
- Items **never** draw below tile bottom (pivot clamp).  
- Hover outline (optional) uses dashed 1px with token primary at 40% opacity; avoid in busy rooms (feature-flag).

## A.10 Notifications & Banners

- **Toast** (top-right over panel): auto-dismiss 3–5s; stack vertically; max 3 on screen.  
- **Banner** (top of stage): maintenance, policy updates; dismissible.  
- **Full-screen** (chrome-only overlay, not canvas): reserved for critical incidents or onboarding.

## A.11 Sound UX

- Map events → sounds: move (soft blip), chat receive (pop), mention (ping), error (short buzz), pickup (coin), level-up (chime).  
- **Local sounds**: distance-based attenuation (simple: near/far volumes).  
- **Global mute** toggle in Settings; respect `prefers-reduced-motion/sound` if available.

## A.12 Accessibility

- Keyboard: Tab cycles chrome; Shift+Tab reverse; Enter activates; Esc closes menus.  
- Focus ring: 2px token primary; visible even on dark surfaces.  
- Color contrast AA+ minimum on all UI chrome.  
- Provide subtle text alternatives for icon-only buttons (aria-label).

## A.13 Performance Budgets

- 60 FPS target in canvas; < 4ms per frame for draw.  
- Composite cache hits ≥ 95% in typical rooms.  
- Input-to-ack move RTT p95 < 120ms in-region; bubble render < 16ms.  
- Avoid layout thrash in panel/dock; use transforms for animations.

## A.14 Error & Empty States

- **Network lost**: **blocking overlay** covering the stage; disables all interactions until WS reconnect + re-auth + room resync complete. Show spinner + “Forbinder igen…” and backoff status; optional “Genindlæs” button remains within overlay (still blocks gameplay).  
- **Asset missing**: show neutral placeholder tile/item; log once per asset per session.

## A.15 Microcopy

- Teleport: “Vælg et rum” / “Mine rum” / “Offentlige rum”  
- Pickup success: “Lagt i rygsæk”  
- Pickup blocked: “Kan ikke samle op her”  
- Locked tile: “Det felt er låst”

## A.16 Motion

- Easing: `cubic-bezier(.2,.8,.2,1)` for dock/panel; 180–240ms.  
- Context menu fade/scale: 120ms.  
- No motion inside the **grid window** that affects deterministic layout—only sprite animations.

## A.17 Iconography

- Line icons ~1.5px stroke; consistent corner radius.  
- Suggested set: Rooms (grid), Shop (bag), Log (clock), Search (magnifier), Quests (flag), Settings (gear), Admin (shield).

## A.18 Theming Guardrails

- Changing theme must **never** change any pixel in the **grid canvas**.  
- Validate by rendering a checksum of the canvas before/after theme toggle.

## A.19 Loading & Skeletons

- Right panel uses **skeleton blocks** (lines, tiles) for 200–600ms while data loads.  
- Dock icons may show shimmer for first paint; never block interactions on the canvas.

## A.20 Debug Overlays (dev only)

- Toggleable overlays: tile coordinates, tile centers, z-order viz, FPS meter.  
- Must be gated behind a dev flag and never ship to production.

---

**End of Master Spec v3.7 + Appendix A (UX/UI Extras)**
