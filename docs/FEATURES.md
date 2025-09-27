# FEATURES

_Last updated: 2025-09-27T12:07:11.046Z_

This file is generated from the codebase (module tags, routes, exports) to inventory what exists today. Status and notes may need a quick human touch.

## Summary

| Module | Files | Server routes | WS events | Client components | Models |
|---|---:|---:|---:|---:|---:|
| __tests__ | 1 | 0 | 0 | 0 | 0 |
| auth | 4 | 0 | 0 | 0 | 0 |
| canvas | 4 | 0 | 0 | 0 | 0 |
| client | 3 | 0 | 0 | 0 | 0 |
| client-app | 1 | 0 | 0 | 0 | 0 |
| client-realtime | 1 | 0 | 0 | 0 | 0 |
| config.ts | 1 | 0 | 0 | 0 | 1 |
| db | 9 | 0 | 0 | 0 | 0 |
| index.ts | 2 | 0 | 2 | 0 | 1 |
| main.tsx | 1 | 0 | 0 | 0 | 0 |
| metrics | 1 | 0 | 0 | 0 | 0 |
| openapi | 1 | 0 | 0 | 0 | 1 |
| readiness.ts | 1 | 0 | 0 | 0 | 0 |
| redis | 1 | 0 | 3 | 0 | 0 |
| rest | 1 | 0 | 0 | 0 | 1 |
| server | 1 | 0 | 0 | 0 | 0 |
| server-admin-api | 1 | 5 | 0 | 0 | 1 |
| server-auth-api | 1 | 1 | 0 | 0 | 1 |
| server-occupants-api | 1 | 10 | 0 | 0 | 1 |
| server.ts | 1 | 3 | 1 | 0 | 0 |
| ui-feedback | 1 | 0 | 0 | 0 | 0 |
| ui-inventory | 1 | 0 | 0 | 0 | 0 |
| ui-profile | 1 | 0 | 0 | 0 | 0 |
| ws | 10 | 0 | 4 | 0 | 10 |

## __tests__

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## auth

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## canvas

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## client

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## client-app

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## client-realtime

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## config.ts

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/server/src/config.ts

### Notes / TODO
- 

## db

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## index.ts

**Status:** _TBD_

**Overview:** _short description here_

### WebSocket events
- `on` `SIGINT` — packages/server/src/index.ts
- `on` `SIGTERM` — packages/server/src/index.ts

### Data models / schemas
- packages/schemas/src/index.ts

### Notes / TODO
- 

## main.tsx

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## metrics

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## openapi

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/schemas/src/openapi/auth.ts

### Notes / TODO
- 

## readiness.ts

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## redis

**Status:** _TBD_

**Overview:** _short description here_

### WebSocket events
- `on` `error` — packages/server/src/redis/pubsub.ts
- `on` `error` — packages/server/src/redis/pubsub.ts
- `on` `message` — packages/server/src/redis/pubsub.ts

### Notes / TODO
- 

## rest

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/schemas/src/rest/occupants.ts

### Notes / TODO
- 

## server

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## server-admin-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `POST` `/admin/rooms/:roomId/tiles/:x/:y/lock` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/tiles/:x/:y/no-pickup` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/dev-affordances` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/latency-trace` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/items/plant` — packages/server/src/api/admin.ts

### Data models / schemas
- packages/server/src/api/admin.ts

### Notes / TODO
- 

## server-auth-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `POST` `/auth/login` — packages/server/src/api/auth.ts

### Data models / schemas
- packages/server/src/api/auth.ts

### Notes / TODO
- 

## server-occupants-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `GET` `/rooms/:roomId/occupants/:occupantId/profile` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/trade` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/accept` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/cancel` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/complete` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/proposals/:slotIndex` — packages/server/src/api/occupants.ts
- `DELETE` `/rooms/:roomId/trades/:tradeId/proposals/:slotIndex` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/readiness` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/mute` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/report` — packages/server/src/api/occupants.ts

### Data models / schemas
- packages/server/src/api/occupants.ts

### Notes / TODO
- 

## server.ts

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `GET` `/healthz` — packages/server/src/server.ts
- `GET` `/readyz` — packages/server/src/server.ts
- `GET` `/metrics` — packages/server/src/server.ts

### WebSocket events
- `on` `connection` — packages/server/src/server.ts

### Notes / TODO
- 

## ui-feedback

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## ui-inventory

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## ui-profile

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## ws

**Status:** _TBD_

**Overview:** _short description here_

### WebSocket events
- `emit` `message` — packages/server/src/ws/connection.ts
- `on` `message` — packages/server/src/ws/connection.ts
- `on` `disconnect` — packages/server/src/ws/connection.ts
- `on` `error` — packages/server/src/ws/connection.ts

### Data models / schemas
- packages/schemas/src/ws/admin.ts
- packages/schemas/src/ws/auth.ts
- packages/schemas/src/ws/chat.ts
- packages/schemas/src/ws/envelope.ts
- packages/schemas/src/ws/items.ts
- packages/schemas/src/ws/move.ts
- packages/schemas/src/ws/room.ts
- packages/schemas/src/ws/social.ts
- packages/schemas/src/ws/trade.ts
- packages/server/src/ws/connection.ts

### Notes / TODO
- 

