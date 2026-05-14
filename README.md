# Offline-First Architecture — Task Manager

## Overview

This document describes the offline-first architecture used in the Task Manager React Native application. The app is designed so that all user interactions work instantly regardless of network connectivity. Data is persisted locally in SQLite, and a background sync engine reconciles local changes with the remote Node.js/MongoDB backend when connectivity is available.

---

## Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Local-first writes** | All CRUD operations write to SQLite immediately. The UI never waits for a network response. |
| **Eventual consistency** | A sync queue ensures all local changes eventually reach the server. |
| **Optimistic UI** | The user sees changes instantly. If sync fails, the change remains queued for retry. |
| **Network-aware** | The app detects connectivity changes and auto-syncs when the network is restored. |
| **Conflict avoidance** | Tasks with pending local changes are not overwritten during server pulls. |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | `react-native-quick-sqlite` | High-performance synchronous SQLite access with WAL mode |
| State Management | `zustand` | Lightweight stores for tasks, auth, sync, and network state |
| Network Detection | `@react-native-community/netinfo` | Real-time connectivity monitoring |
| API Client | Native `fetch` | HTTP client with timeout, auth headers, and error handling |
| Backend | Node.js + Express + MongoDB | REST API with JWT authentication |

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                     UI (React Native)                     │
│   Screens • Components • Navigation                      │
├─────────────────────────────────────────────────────────┤
│                   Zustand Stores                          │
│   taskStore • authStore • syncStore • networkStore        │
├─────────────────────────────────────────────────────────┤
│                  Repository Layer                         │
│   TaskRepository • SyncQueueRepository                   │
├─────────────────────────────────────────────────────────┤
│                  SQLite Database                          │
│   tasks • sync_queue • task_deltas • sync_meta           │
├─────────────────────────────────────────────────────────┤
│               Sync Engine + Background Sync              │
│   Push queue → Pull server → Reconcile                   │
├─────────────────────────────────────────────────────────┤
│                    API Client                             │
│   REST endpoints • JWT auth • Timeout handling           │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Creating a Task (Offline or Online)

```
User taps "Create Task"
        │
        ▼
┌─────────────────────┐
│  TaskRepository      │──▶ INSERT into SQLite (instant)
│  .create()           │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  SyncQueueRepository │──▶ Enqueue 'create' operation
│  .enqueueOrReplace() │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Is Online?          │
│  YES → fire-and-     │──▶ POST /api/tasks (async, non-blocking)
│        forget API    │
│  NO  → stays queued  │──▶ Will sync when network returns
└─────────────────────┘
        │
        ▼
   UI updates immediately from SQLite
```

### Background Sync Cycle

```
Trigger: Network restored / App foreground / 30s interval
        │
        ▼
┌─────────────────────────────────────┐
│  Phase 1: PUSH (local → server)     │
│                                     │
│  1. Read pending items from queue   │
│  2. Process each item (FIFO order): │
│     • create → POST /api/tasks      │
│     • update → PUT /api/tasks/:id   │
│     • delete → DELETE /api/tasks/:id│
│  3. On success: remove from queue   │
│  4. On failure: exponential backoff │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Phase 2: PULL (server → local)     │
│                                     │
│  1. GET /api/tasks (all user tasks) │
│  2. For each server task:           │
│     • New? → INSERT locally         │
│     • Exists + no local changes?    │
│       → UPDATE from server          │
│     • Exists + has local changes?   │
│       → SKIP (keep local version)   │
│  3. Remove locally-synced tasks     │
│     that no longer exist on server  │
└─────────────────────────────────────┘
```

---

## SQLite Schema

### `tasks` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | MongoDB `_id` or local UUID before first sync |
| `title` | TEXT | Task title (required) |
| `description` | TEXT | Task description |
| `priority` | TEXT | `low`, `medium`, `high` |
| `status` | TEXT | `pending`, `in-progress`, `completed` |
| `due_date` | TEXT | ISO date string or NULL |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |
| `version` | INTEGER | Incremented on each local update |
| `is_deleted` | INTEGER | Soft delete flag (0 or 1) |
| `last_synced_at` | TEXT | Timestamp of last successful sync |
| `needs_sync` | INTEGER | 1 if local changes haven't been pushed |

### `sync_queue` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Queue item UUID |
| `task_id` | TEXT | Reference to task |
| `operation` | TEXT | `create`, `update`, `delete` |
| `payload` | TEXT | JSON-serialized data to send |
| `timestamp` | TEXT | When the operation was enqueued |
| `status` | TEXT | `pending`, `in_progress`, `failed`, `completed` |
| `retry_count` | INTEGER | Number of failed attempts |
| `max_retries` | INTEGER | Maximum retry attempts (default: 5) |
| `next_retry_at` | TEXT | Scheduled retry time (exponential backoff) |
| `error_message` | TEXT | Last error message |

### `sync_meta` Table

Stores key-value metadata like auth session and last sync timestamp.

---

## Sync Queue System

### Enqueue Strategy

- **Deduplication**: If a pending operation already exists for the same task + operation type, it's replaced (not duplicated).
- **Delete cascading**: Enqueueing a `delete` removes any pending `create` or `update` for that task.
- **Ordering**: Items are processed in FIFO order by timestamp.

### Retry Mechanism

Failed sync operations use **exponential backoff**:

| Retry # | Delay |
|---------|-------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |
| 4 | 16 seconds |
| 5 | 32 seconds |

After 5 failed attempts, the item enters a "dead letter" state and won't be retried automatically. The user can manually trigger a retry.

### Queue States

```
pending ──▶ in_progress ──▶ completed (removed)
                │
                ▼
            failed ──▶ pending (after backoff delay)
                │
                ▼ (after max retries)
            dead letter (manual intervention needed)
```

---

## Network Detection

The `networkStore` (Zustand) subscribes to `@react-native-community/netinfo` and exposes a reactive `isConnected` boolean.

**Auto-sync triggers:**
1. Network connectivity restored (offline → online transition)
2. App returns to foreground (`AppState` listener)
3. Periodic interval (every 30 seconds while online)
4. Manual "Sync Now" button in the UI

**Minimum sync gap:** 5 seconds between sync cycles to prevent flooding.

---

## Conflict Resolution

The current strategy is **"local changes win"** (conflict avoidance):

- During a pull from the server, if a local task has `needs_sync = 1` (pending local changes), the server version is **not** applied.
- Once the local change is successfully pushed, `needs_sync` is set to `0`, and subsequent pulls will update the local copy.
- If a task was deleted on the server but has no pending local changes, it's removed locally.

This approach avoids data loss from the user's perspective — their most recent action always takes priority.

---

## ID Management

Tasks created offline receive a locally-generated UUID. When the task is successfully synced to the server:

1. The server returns a MongoDB `_id`.
2. `TaskRepository.updateServerId()` replaces the local UUID with the server ID.
3. All sync queue references are updated to the new ID.

This ensures the local and server always reference the same task after first sync.

---

## Authentication & Session Persistence

- JWT tokens are stored in the `sync_meta` SQLite table (key: `auth_session`).
- On app launch, `authStore.restoreSession()` reads the persisted token and rehydrates the auth state.
- All API requests include `Authorization: Bearer <token>` via the centralized `request()` function.
- Token expiry (7 days) is handled by the backend returning 401, which the app can use to prompt re-login.

---

## File Structure

```
src/
├── api/
│   └── client.ts              # HTTP client, auth/task API endpoints
├── components/
│   ├── EmptyState.tsx          # Empty list placeholder
│   ├── NetworkBanner.tsx       # Offline/sync status banner
│   └── TaskCard.tsx            # Task list item with search highlighting
├── database/
│   ├── connection.ts           # SQLite singleton, WAL mode, transactions
│   └── schema.ts              # Table definitions and indexes
├── hooks/
│   └── useDebounce.ts          # Debounce hook for search input
├── navigation/
│   ├── AppNavigator.tsx        # Auth gate + stack navigators
│   └── types.ts               # Navigation type definitions
├── repositories/
│   ├── SyncQueueRepository.ts  # Queue CRUD, retry logic, backoff
│   └── TaskRepository.ts      # Task CRUD, search, sync helpers
├── screens/
│   ├── CreateTaskScreen.tsx    # New task form
│   ├── LoginScreen.tsx         # Authentication
│   ├── RegisterScreen.tsx      # User registration
│   ├── TaskDetailScreen.tsx    # Task view/edit/delete
│   └── TaskListScreen.tsx      # Main list with search + filters
├── stores/
│   ├── authStore.ts            # Zustand: login, register, session
│   ├── networkStore.ts         # Zustand: connectivity state
│   ├── syncStore.ts            # Zustand: sync state, trigger sync
│   └── taskStore.ts            # Zustand: task CRUD, search, pull
├── sync/
│   ├── BackgroundSync.ts       # Auto-sync manager (timers, listeners)
│   └── SyncEngine.ts          # Push/pull orchestration
├── types/
│   ├── auth.ts                # Auth type definitions
│   └── task.ts                # Task, sync queue, filter types
└── utils/
    └── id.ts                  # UUID generation (no external deps)
```

---

## API Endpoints (Backend)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/profile` | Yes | Get current user |
| GET | `/api/tasks` | Yes | List all tasks (supports `?status=&priority=&sort=`) |
| GET | `/api/tasks/:id` | Yes | Get single task |
| POST | `/api/tasks` | Yes | Create task |
| PUT | `/api/tasks/:id` | Yes | Update task |
| DELETE | `/api/tasks/:id` | Yes | Delete task |

---

## Performance Optimizations

1. **WAL mode** — SQLite Write-Ahead Logging allows concurrent reads during writes.
2. **Indexes** — On `status`, `priority`, `is_deleted`, `needs_sync`, and `sync_queue.status`.
3. **Synchronous operations** — `react-native-quick-sqlite` executes on the JS thread without async overhead for reads.
4. **Debounced search** — 300ms delay prevents excessive queries during typing.
5. **Relevance-ranked search** — Title matches appear before description-only matches.
6. **Queue deduplication** — Prevents redundant network requests for rapid edits.
7. **Minimum sync gap** — 5-second cooldown prevents sync flooding.

---

## Limitations & Future Improvements

| Current Limitation | Potential Improvement |
|-------------------|----------------------|
| Full task list pull on each sync | Implement delta sync with `?since=<timestamp>` on the server |
| No per-field conflict resolution | Add field-level timestamps and 3-way merge |
| No pagination from server | Add cursor-based pagination to `GET /api/tasks` |
| Token expiry not handled gracefully | Add refresh token flow or silent re-auth |
| No push notifications | Add WebSocket or FCM for real-time server → client updates |
| Single-device only | Add device ID tracking for multi-device conflict resolution |

---

## Running the App

```bash
# Start the backend (from /Documents/Nodejs)
npm run dev

# Start Metro bundler (from /Documents/Task_Manager)
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

The API client auto-selects the correct base URL:
- **iOS Simulator**: `http://localhost:3000`
- **Android Emulator**: `http://10.0.2.2:3000`

---

## Summary

The offline-first approach ensures the Task Manager app is fully functional without network connectivity. Users can create, edit, delete, and search tasks at any time. All changes are persisted in SQLite and automatically synchronized with the backend when connectivity is available. The sync queue with exponential backoff retry guarantees no data is lost, even under unreliable network conditions.
