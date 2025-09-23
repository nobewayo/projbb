# Bitby — AGENT.md (Execution Guide for Codex)

**Audience:** Code-generation agent (e.g., Codex) acting as a senior engineer.  
**Purpose:** Implement Bitby according to the Master Spec v3.7 (+ updates).  
**Contract:** Follow the rules in this file **exactly** unless a human explicitly overrides. When trade-offs arise, preserve **grid determinism** and **server authority** above all else.

---

## 0) Non‑Negotiables (Read First)

1) **Deterministic Canvas**
   - The “grid window” (room canvas) must render **identically** for all clients.
   - UI themes **must not** affect any pixel drawn in the canvas (only chrome around it).

2) **Top‑Right Anchored Diamond Grid**
   - Fixed tile geometry: `tileW=75`, `tileH=90`, `rowStep=45`.
   - Columns per row: even `y` → 15, odd `y` → 14.
   - Anchor: **top‑right** of the canvas (see §3 Grid Math).

3) **Movement Priority**
   - Fast & accurate tile movement is the **#1 priority**.
   - Client **optimistically** moves, server validates and **rebroadcasts**. If mismatch → **snapback**.

4) **Server Authority**
   - Client caches locked/noPickup tiles, but server is source-of-truth for **every action** (move, pickup, wear, trade, quest, teleport).

5) **Transport**
   - **WSS WebSocket** (no Socket.IO) with subprotocol **`bitby.v1`**. Max 64KB/msg. Heartbeats every 15s.

6) **Blocking Reconnect Overlay**
   - On connection loss: **block all interactions** with a full-stage overlay until WS reconnect + re-auth + room resync completes.

7) **Pre‑Rendered 3D → 2D**
   - Rooms, avatars, items are produced from 3D but shipped as **2D sprites** (PNGs/sprite-sheets). Paper‑doll compositing allowed; no runtime 3D.

8) **Security First**
   - JWT, CSRF protection for REST, parameterized SQL, upload allow‑list + scanning, progressive rate‑limits (see §8).

---

## 1) High‑Level System

- **Client (TS)**: Canvas renderer (Pixi/WebGL), WS protocol client, right panel, bottom dock, context menus, optimistic movement.
- **API/WS (Node TS)**: Auth, catalog, room authority, movement validation, chat, inventory/economy, admin, plugins.
- **DB**: Postgres (primary persistence). **Redis**: presence, pub/sub, fast room state, caches.
- **CDN**: Immutable assets (sprite sheets, masks) named by **SHA‑256**.

### Process Topology
- Stateless API+WS instances behind LB (TLS terminated), no sticky sessions (room state in Redis).
- Worker threads for **plugins** using **isolated‑vm**.

---

## 2) Implementation Roadmap (Milestones)

1) **Core Canvas + Grid**
   - Implement geometric anchor and diamond hit testing.
   - Draw full field (15/14 columns by row; vertical containment by `gridH=495`).

2) **WS Skeleton + Auth**
   - Envelope + `auth/auth:ok` frames, JWT, subprotocol `bitby.v1`, ping/pong.

3) **Movement Loop**
   - Optimistic move → server validate → broadcast; snapback on reject. Backpressure queues.

4) **Chat (canvas bubble + panel log)**
   - Typing preview bubble follows avatar; commit on send; permanent log in right panel.

5) **Items (place/pickup)**
   - Click-through to items; pickups only on same tile and not `noPickup` tile; clamp bottom to tile base.

6) **Catalog Boot + Deltas**
   - Full catalog + HMAC on join; apply deltas; enforce version thresholds; signed caches.

7) **Wear & Paper‑Doll**
   - Slots, offsets, masks, weight‑capped handhelds; composite caching (LRU).

8) **Admin Surface**
   - Lock/noPickup, tile links, offsets editor, catalog editor, bots.

9) **Observability + Limits**
   - Prom metrics, alerts, Sentry; rate limits; runbooks; graceful restarts + region windows.

---

## 3) Grid Math (Must‑Match)

**Constants**
```
tileW = 75
tileH = 90
rowStep = tileH/2 = 45
cols(y) = (y % 2 === 0) ? 15 : 14
```

**Anchoring (top‑right)**
```
rowRightSpan(y) = cols(y)*tileW + (y%2 ? tileW/2 : 0)
Wmax = max_y(rowRightSpan(y))
originX = max(0, canvasW - Wmax)   // canvasW excludes right panel
originY = topPadding               // e.g., 40
```

**Tile → Screen**
```
sx = originX + x*tileW + (y%2 ? tileW/2 : 0)
sy = originY + y*rowStep
```

**Diamond Hit Test (centered)**
```
dx = (px - (sx + tileW/2)) / (tileW/2)
dy = (py - (sy + tileH/2)) / (tileH/2)
inside if abs(dx) + abs(dy) <= 1
```

**Rectangular Field (vertical containment)**
```
valid iff sy >= originY && (sy + tileH) <= (originY + gridH)
with gridH = 495
```

**Z‑Order**
- Sort avatars by `(y, then x)`; **items always below avatars**.
- Username text rendered **behind** its own avatar (may be occluded by someone “in front” / greater `y`).

---

## 4) Rendering Pipeline

**Avatar bbox:** 75×125, foot midpoint at tile bottom center (pose origin).  
**Layer order (back→front):**
1) shadow
2) skin_base (recolor mask for skin tone)
3) pants
4) shoes
5) shirt
6) beard
7) hair_back
8) handheld_back
9) jacket (optional)
10) handheld_front (multi; ordered; **weight** cap)
11) hair_front
12) glasses
13) hat
14) UI bubbles (not composited into avatar)

**Offsets (per proto/slot @ 1×)**
```json
{ "dx": 0, "dy": -6, "scale": 1.0, "flipX": false }
```
Scale by DPR during render. Clamp if off‑bbox; log once.

**Conflicts**
- `hidesSlots` and `hairCutMask` on hats. Hair remains unless explicitly hidden.

**Composite Caches (LRU)**
- Per‑region tinted cache → outfit composite cache. Keys: SHA‑256(slots+colorways+offsets).

---

## 5) Items

- Pre‑rendered 3D to 2D PNGs. Pivot at base; **never** draw below tile base (clamp or reject).  
- Optional short idle frames.  
- Click target = painted pixels (alpha > 0.1) with 2–3px padding.

**Handhelds**
```yaml
maxWeight: 10
perUserEquipLimit: 5
duplicatePolicy: uniqueProto   # or allow
```
Each proto has `weight` (1–10). Sum ≤ maxWeight.

---

## 6) Client UX Rules

- Left‑click item → **Item Info** in right panel (no popup).  
- Left‑click avatar **does not** consume (click‑through stays for movement).  
- Left‑click tile → move (optimistic).  
- Right‑click grid → **items on that tile only**. For each item: **Info**(always), **Saml Op**(only if standing there and tile not `noPickup`).  
- Right‑click avatar → player context menu.  
- **Typing preview bubble** follows avatar. **Sent bubble** becomes solid; preview hides it while typing.  
- **Blocking reconnect overlay** on network loss until `auth:ok` + room resync.

**Chrome layout**
- Right panel fixed **400px** (not slideable). Bottom chat log ≈ 400px high.  
- Bottom dock (64px) slides **left only**; right‑edge tab (28px) always visible.  
- Themes affect only chrome; **never** the canvas.

---

## 7) WebSocket Protocol

**Envelope (always)**
```json
{ "op": "string", "seq": 123, "ts": 1737654321, "data": { ... } }
```

**Auth**
```json
{ "op":"auth", "seq":1, "ts":..., "data": { "token":"<JWT>" } }
{ "op":"auth:ok", "seq":1, "ts":..., "data": {
  "user":{...},
  "room":{...},
  "catalogVersion":42,
  "layout":{...},
  "lockedTiles":[...]
}}
```

**Move**
```json
{ "op":"move", "seq":7, "ts":..., "data": { "x":6, "y":8 } }
{ "op":"move:ok",  "seq":7, "ts":..., "data": { "x":6, "y":8, "roomSeq":991 } }
{ "op":"move:err", "seq":7, "ts":..., "data": { "code":"locked_tile", "at":{"x":6,"y":8}, "roomSeq":992 } }
```

**Chat**
```json
{ "op":"chat:send", "seq":9, "ts":..., "data":{ "body":"hej", "idempotency":"k9v..." } }
{ "op":"chat:new",  "ts":..., "data":{ "id":"m123", "userId":"u2", "body":"hej", "roomSeq":1001 } }
```

**Catalog Delta**
```json
{ "op":"catalog:delta", "ts":..., "data":{ "from":41, "to":42, "patch":[...], "sig":"hmac..." } }
```

**Transport rules**
- Subprotocol **bitby.v1** required, close 1002 if missing.  
- Server pings every 15s; drop after 2 missed pongs.  
- **Max 64KB** per message; reject oversize.  
- **Backpressure:** per‑conn queues cap at **200 msgs** or **1 MB**. Drop non‑critical first (typing).

---

## 8) Security & Anti‑Abuse

**REST**
- HTTPS only. CSRF (double‑submit cookie / SameSite=strict + token).  
- Parameterized SQL exclusively.  
- Rate limits (per‑IP): `/auth/login` ≤ 5/min; `/catalog` ≤ 30/min; `upload` ≤ 10/min.

**WS per‑user rate limits (progressive penalties)**
- move ≤ **12/s**, chat ≤ **6/s**, typing ≤ **6/s**, item ≤ **3/s**, join/teleport ≤ **2/min**.  
- Per‑IP connection cap: **20**.  
- Penalties: warn → slow mode → temp kick → ban.

**Uploads**
- File type allow‑list, MIME sniff, size cap, AV scan, image moderation.

**Anti‑AFK**
- Keep‑alive prompt or micro‑captcha after inactivity; flag AFK or soft‑kick busy rooms.

**Anti‑cheat**
- Client caches locked tiles; server authoritative; autoclicker detection via min inter‑click and variance stats.

---

## 9) State Sync, Backpressure & Recovery

- `roomSeq` increments on broadcast ticks; coalescing allowed.
- Missed updates > **10** → client requests **full snapshot** (`room:full`), server throttles (≈5/sec per room).
- Coalesce if room queue > **1000** or lag > **300ms**; keep `roomSeq` monotonic.
- Reconnect: exponential backoff (200ms→5s, jitter), send last `roomSeq` & `catalogVersion`.  
- **UI**: show **blocking reconnect overlay** until `auth:ok` + room resync.

---

## 10) Database (Postgres)

**Key tables** (see schema in Master Spec; implement with UUIDs/JSONB/timestamptz):
- `app_user`, `session`  
- `room`, `room_tile_flag`  
- `catalog_item_proto`  
- `item_instance`  
- `wear_slot`, `wear_handheld`  
- `avatar`  
- `coin_ledger`, `item_transfer`  
- `chat_message`  
- `bot`, `plugin_script`  
- `audit_log`

**Indexes**
- `item_instance(room_id, y, x)`, `avatar(room_id)`, `catalog_item_proto(version)`, etc.

**Transactions**
- **Moves**: Redis only.  
- **Critical ops** (ledger/trades/purchases): `REPEATABLE READ` + `FOR UPDATE` or `SERIALIZABLE`; retry on `40P01/40001` up to 3x.

**Seeds**
- Users: `test`(owner), `test2`(moderator), `test3`(vip), `test4`(user) with **1,000,000** coins.  
- One public room; private rooms purchasable for **100 coins**.

---

## 11) Redis

- Managed Redis (Sentinel/Cluster). Reconnect with jitter.  
- Channels: `room.{roomId}.events`, `user.{userId}.notify`, `catalog.updates`, `system.*`.  
- Hold presence/positions/lockedTiles/layout caches. Periodic avatar snapshot to DB (30–60s).

**Metrics**
- `bitby_redis_lag_ms`, `bitby_redis_reconnections_total`, `bitby_ghost_connections_total`.

---

## 12) Catalog & Caching

- **Prototypes** (`catalog_item_proto`) with `default_offsets`, recolor masks/limits, sprite URLs, `paper_doll_layer`, `version`.
- **Instances** (`item_instance`) with unique ids (dupe detection), ownership, colorway, room placement.
- Client boots with **full catalog + HMAC**; receives **deltas**. If >5 versions behind → **full** refetch.
- Client caches signed; tamper → reject + refetch.

---

## 13) Assets & CDN

- Sprite sheets 1×/2×; immutable URLs with **SHA‑256** hash.  
- Preload **critical‑first**: room background, visible users/items; then neighbor rooms/common items.  
- Retry 3x (100/500/2000ms). Fallback `/assets/missing.png`.  
- If critical layer fails → show base skin + label, mark degraded, retry.  
- Load 2× sheets if `devicePixelRatio ≥ 1.5`.

---

## 14) Admin, Bots, Plugins

**Admin**
- Lock/noPickup tiles, tile links (URL/room), background, layout constants.  
- Offsets editor writes to **proto** (global).  
- Catalog editor ensures item catalogue consistency (“create once, all instances uniform”).  
- Users: roles, coins, spawn items, move, kick/ban.  
- Private rooms for **100 coins**; Teleport shows public + owned rooms.

**Bots**
- Server‑side; clickable; can open right‑panel URL, grant items, check inventory, drive quests.  
- Quest state: `user_quest_state(user_id, quest_id, step, vars)`.

**Plugins**
- **isolated‑vm** in Worker Threads; JSON‑RPC only; manifest‑scoped permissions.  
- Per‑hook hard cap **50ms** (target p95 ≤ 10ms); terminate isolate on budget overrun; quarantine on repeated faults.

---

## 15) Config & Deploy

- Config in Postgres (versioned) + file in dev. Hot‑reload for safe keys; set `restartRequired=true` for non‑hot keys.
- **Graceful restarts** with drain (20–30s default).  
- **Region‑aware maintenance windows**; green/blue cutover with health checks:
  - `/healthz` `/readyz` 200  
  - DB pool & schema OK; Redis round‑trip p95 < 50ms  
  - Synthetic WS auth/move/chat/catalog OK  
  - CDN canaries OK; metrics/logging OK

---

## 16) Observability & Alerts

- Prom metrics for WS, Redis, catalog, movement, items, security, plugins, rooms (see Master Spec).  
- Alerts (examples): Redis lag {200,500}, WS capacity {85%,92%}, snapbacks/min {30,100}, full snapshots/min {20,60}, CDN 404s, DB deadlocks.  
- Runbooks: scale out WS, enable coalescing, check catalog publisher, roll back bad asset, increase DB pool, etc.
- Sentry on client/server (build hashes).

---

## 17) UI/Theme Rules (Chrome Only)

- Theme tokens from Master Spec §16. **Never** modify canvas visuals.  
- Bottom dock slides **left only**; right‑edge tab always visible.  
- Right panel fixed width (400px) with chat log at bottom (~400px).  
- Context menus follow rules in §6; keyboard accessible.  
- Accessibility: AA+ contrast, focus rings, keyboard nav.

---

## 18) Testing & Acceptance

**Unit**
- Grid math (rows, anchoring, hit tests), z‑order sorting, WS envelope validators (JSON Schemas), recolor limits.

**Integration**
- Auth→join→move→broadcast; snapback on locked tile; catalog delta apply; pickup gating (`noPickup`).

**Load**
- 1000 fake clients per room; RTT p95 < 120ms in‑region; coalescing when needed.

**Visual Golden Tests**
- Canvas checksum before/after theme switch (must match).  
- Avatar composite correctness (slot masks/offsets).

**Acceptance Checklist**
- Mirror the Master Spec checklist (grid geometry, protocol, security, catalog, wearables, metrics, seeds, admin, ads disabled by default, etc.).

---

## 19) File/Package Layout (Proposed)

```
/packages
  /client        # TS, Pixi, WS client, UI
    /src
      canvas/    # grid math, renderer, z-order, bubbles
      ws/        # protocol client, reconnect overlay
      ui/        # right panel, bottom dock, context menus
      catalog/   # cache, delta apply
      assets/    # preload, fallback, density
      theme/     # tokens, components (chrome only)
      types/
  /server        # Node TS API + WS
    src/
      api/       # REST: auth, catalog, admin
      ws/        # handlers: auth, move, chat, item, catalog
      rooms/     # authority, presence, coalesce
      plugins/   # isolated-vm harness
      redis/
      db/        # pg queries, migrations
      config/    # schema, hot reload
      metrics/   # prom, health
      seeds/
  /schemas
    ws/          # JSON Schemas per op
    openapi/     # REST OpenAPI 3.1
  /infra
    docker/      # docker-compose, Dockerfiles
    k8s/         # (optional) manifests
```

---

## 20) Code Generation Prompts (Meta)

When implementing, **Codex should**:
- Emit **TypeScript** with strict types; keep pure functions for grid math.
- Always validate WS payloads against JSON Schemas.
- Stamp all server logs with `roomId`, `userId`, `seq`, `roomSeq` where relevant.
- Comment **intent** for non-obvious logic (especially z‑order, snapback conditions, recolor clamping).
- Prefer small, testable modules. Provide minimal examples in module READMEs.

---

## 21) Seeds & Feature Flags

- Seed users: `test`, `test2`, `test3`, `test4` with 1,000,000 coins.  
- Feature flags: ads off by default; hover outlines off by default; coalescing can be toggled.  
- Private room price: 100 coins (configurable).

---

## 22) Do / Don’t

**Do**
- Keep input → move ack fast; treat movement path as critical path.  
- Drop non-critical messages under backpressure.  
- Clamp item bottoms to tile base.  
- Respect `noPickup` tiles and right‑click rules.

**Don’t**
- Don’t change the canvas layout/appearance from theme.  
- Don’t block canvas paint on non-critical asset loads.  
- Don’t exceed WS message size; don’t skip subprotocol check.

---

## 23) Ready‑to‑Implement Tasks (First Sprint)

1) Client grid renderer with top‑right anchor & diamond hit test; draw cell centers for dev overlay.  
2) WS client with subprotocol, heartbeat, blocking reconnect overlay.  
3) WS server endpoints: `auth`, `move`, `chat`; Redis room pub/sub skeleton.  
4) Postgres schema & migrations; seed users/room.  
5) Basic right panel and bottom dock (slide-left, tab).  
6) Item click → panel info; pickup rule gating.  
7) Metrics & health endpoints.  
8) JSON Schemas for `auth`, `move`, `chat`; OpenAPI for `/auth` REST.

---

**End of AGENT.md**
