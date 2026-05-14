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
| Database | `react-native-quick-sqlite` | High-performance synchronous SQLite with WAL mode |
| State Management | `zustand` | Lightweight reactive stores |
| HTTP Client | `axios` | Request/response interceptors, timeout, auth headers |
| Network Detection | `@react-native-community/netinfo` | Real-time connectivity monitoring |
| File Handling | `react-native-fs` | Local file storage for attachments |
| Document Picker | `react-native-document-picker` | File selection for attachments |
| Audio Recording | `react-native-audio-recorder-player` | Voice note recording/playback |
| Backend | Node.js + Express + MongoDB | REST API with JWT authentication |

---

## Feature Set

### Task Management
- **Create/Edit/Delete tasks** — Full CRUD with instant local persistence
- **Priority levels** — Low, Medium, High, Urgent with color coding
- **Due dates** — ISO date format with visual indicators
- **Recurring tasks** — Daily, Weekly, Monthly, Yearly recurrence configuration
- **Subtasks** — Nested checklist items with completion tracking
- **Task categories** — Organize tasks into categories (Work, Personal, etc.)
- **Labels/Tags** — Multiple tags per task for cross-cutting organization
- **Notes** — Separate notes field for additional context
- **Attachments** — File attachments stored locally with server upload support
- **Voice notes** — Audio recordings attached to tasks
- **Rich text descriptions** — Markdown-supported description field

### Search & Filtering
- **Full-text search** — Searches title, description, notes, category, and labels
- **Debounced input** — 300ms delay prevents excessive queries
- **Relevance ranking** — Title matches rank highest, then category, then other fields
- **Search highlighting** — Matching text highlighted in results
- **Status filter** — Pending, In Progress, Completed
- **Priority filter** — Low, Medium, High, Urgent
- **Category filter** — Filter by task category
- **Label filter** — Filter by specific tag

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
│                  Axios HTTP Client                        │
│   Interceptors • JWT auth • Timeout • Error handling     │
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
│  .create()           │    Includes: subtasks, labels, category,
│                      │    recurrence, notes — all stored as JSON
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
│  YES → fire-and-     │──▶ POST /api/tasks via Axios (non-blocking)
│        forget API    │
│  NO  → stays queued  │──▶ Will sync when network returns
└─────────────────────┘
        │
        ▼
   UI updates immediately from Zustand store
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
| `title` | TEXT | Task title (required, max 200 chars) |
| `description` | TEXT | Rich text description (markdown supported) |
| `priority` | TEXT | `low`, `medium`, `high`, `urgent` |
| `status` | TEXT | `pending`, `in-progress`, `completed` |
| `due_date` | TEXT | ISO date string or NULL |
| `category` | TEXT | Task category (e.g., "Work", "Personal") |
| `labels` | TEXT | JSON array of label strings |
| `notes` | TEXT | Additional notes text |
| `subtasks` | TEXT | JSON array of subtask objects |
| `recurrence` | TEXT | JSON recurrence config object |
| `attachments` | TEXT | JSON array of attachment metadata |
| `voice_notes` | TEXT | JSON array of voice note metadata |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |
| `version` | INTEGER | Incremented on each local update |
| `is_deleted` | INTEGER | Soft delete flag (0 or 1) |
| `last_synced_at` | TEXT | Timestamp of last successful sync |
| `needs_sync` | INTEGER | 1 if local changes haven't been pushed |

### JSON Field Structures

**Subtask:**
```json
{
  "id": "uuid",
  "title": "Subtask title",
  "isCompleted": false,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Attachment:**
```json
{
  "id": "uuid",
  "fileName": "document.pdf",
  "filePath": "/local/path/document.pdf",
  "fileSize": 1024,
  "mimeType": "application/pdf",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Voice Note:**
```json
{
  "id": "uuid",
  "filePath": "/local/path/voice_123.m4a",
  "duration": 15,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Recurrence Config:**
```json
{
  "type": "weekly",
  "interval": 1,
  "daysOfWeek": [1, 3, 5],
  "endDate": null,
  "occurrences": null
}
```

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

---

## Axios HTTP Client

The app uses Axios with interceptors for centralized auth and error handling:

```typescript
// Request interceptor: auto-attach JWT
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Response interceptor: normalize errors
api.interceptors.response.use(
  response => response,
  (error) => {
    // Extract meaningful error message from response
    // Handle timeout (ECONNABORTED)
    // Return rejected promise with clean Error
  }
);
```

**Benefits over raw fetch:**
- Automatic JSON serialization/deserialization
- Request/response interceptors for auth
- Timeout handling built-in
- Multipart form data support for file uploads
- Better error normalization

---

## Sync Queue System

### Enqueue Strategy

- **Deduplication**: If a pending operation already exists for the same task + operation type, it's replaced.
- **Delete cascading**: Enqueueing a `delete` removes any pending `create` or `update` for that task.
- **Ordering**: Items are processed in FIFO order by timestamp.

### Retry Mechanism (Exponential Backoff)

| Retry # | Delay |
|---------|-------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |
| 4 | 16 seconds |
| 5 | 32 seconds |

After 5 failed attempts, the item enters a "dead letter" state.

### Queue States

```
pending ──▶ in_progress ──▶ completed (removed)
                │
                ▼
            failed ──▶ pending (after backoff delay)
                │
                ▼ (after max retries)
            dead letter
```

---

## Network Detection & Auto-Sync

**Auto-sync triggers:**
1. Network connectivity restored (offline → online)
2. App returns to foreground
3. Periodic interval (every 30 seconds)
4. Manual "Sync Now" button

**Minimum sync gap:** 5 seconds between cycles.

---

## Conflict Resolution

Strategy: **"Local changes win"** (conflict avoidance)

- During pull: if `needs_sync = 1`, server version is NOT applied
- After successful push: `needs_sync = 0`, subsequent pulls update normally
- Server-deleted tasks are removed locally only if no pending local changes

---

## Zustand Store Architecture

### `taskStore`
- Task CRUD (create, update, delete, getTask)
- Subtask management (add, toggle, remove)
- Attachment management (add, remove)
- Voice note management (add, remove)
- Search with relevance ranking
- Category/label metadata loading
- Server pull with reconciliation

### `authStore`
- Login/register with JWT
- Session persistence in SQLite
- Token management via Axios interceptor

### `syncStore`
- Sync state (isSyncing, pendingCount, lastError)
- Manual sync trigger
- Pending count refresh

### `networkStore`
- NetInfo subscription
- Reactive `isConnected` state

---

## File Structure

```
src/
├── api/
│   └── client.ts              # Axios instance, interceptors, Auth + Task API
├── components/
│   ├── EmptyState.tsx          # Empty list placeholder
│   ├── NetworkBanner.tsx       # Offline/sync status banner
│   └── TaskCard.tsx            # Task card with labels, subtask count, attachments
├── database/
│   ├── connection.ts           # SQLite singleton, WAL mode, transactions
│   └── schema.ts              # Tables with JSON columns for complex data
├── hooks/
│   └── useDebounce.ts          # Debounce hook for search
├── navigation/
│   ├── AppNavigator.tsx        # Auth gate + stack navigators
│   └── types.ts               # Navigation type definitions
├── repositories/
│   ├── SyncQueueRepository.ts  # Queue CRUD, retry logic, backoff
│   └── TaskRepository.ts      # Task CRUD, search, categories, labels
├── screens/
│   ├── CreateTaskScreen.tsx    # Full task creation with all fields
│   ├── LoginScreen.tsx         # Authentication
│   ├── RegisterScreen.tsx      # User registration
│   ├── TaskDetailScreen.tsx    # View/edit with subtasks, attachments, voice notes
│   └── TaskListScreen.tsx      # List with search, filters, categories
├── stores/
│   ├── authStore.ts            # Zustand: auth state + session persistence
│   ├── networkStore.ts         # Zustand: connectivity
│   ├── syncStore.ts            # Zustand: sync state
│   └── taskStore.ts            # Zustand: tasks, subtasks, attachments, voice notes
├── sync/
│   ├── BackgroundSync.ts       # Auto-sync manager
│   └── SyncEngine.ts          # Push/pull orchestration
├── types/
│   ├── auth.ts                # Auth types
│   └── task.ts                # Task, Subtask, Attachment, VoiceNote, Recurrence types
└── utils/
    └── id.ts                  # UUID generation
```

---

## API Endpoints (Backend)

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/profile` | Yes | Get current user |

### Tasks (CRUD)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks` | Yes | List tasks (`?status=&priority=&category=&label=&search=&sort=`) |
| GET | `/api/tasks/:id` | Yes | Get single task |
| POST | `/api/tasks` | Yes | Create task (all fields) |
| PUT | `/api/tasks/:id` | Yes | Update task (partial) |
| DELETE | `/api/tasks/:id` | Yes | Delete task (also removes files) |

### Metadata

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks/categories` | Yes | Get all unique categories for user |
| GET | `/api/tasks/labels` | Yes | Get all unique labels for user |

### Subtasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/tasks/:id/subtasks` | Yes | Add subtask (`{ title }`) |
| PATCH | `/api/tasks/:id/subtasks/:subtaskId/toggle` | Yes | Toggle subtask completion |
| DELETE | `/api/tasks/:id/subtasks/:subtaskId` | Yes | Remove subtask |

### Attachments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/tasks/:id/attachments` | Yes | Upload file (multipart, field: `file`, max 10MB) |
| DELETE | `/api/tasks/:id/attachments/:attachmentId` | Yes | Remove attachment + delete file |

### Voice Notes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/tasks/:id/voice-notes` | Yes | Upload audio (multipart, field: `audio`, + `duration`) |
| DELETE | `/api/tasks/:id/voice-notes/:voiceNoteId` | Yes | Remove voice note + delete file |

### Static Files

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/uploads/attachments/:filename` | No | Serve attachment file |
| GET | `/uploads/voice-notes/:filename` | No | Serve voice note file |

---

## Performance Optimizations

1. **WAL mode** — Concurrent reads during writes
2. **Indexes** — On status, priority, category, is_deleted, needs_sync, due_date
3. **Synchronous SQLite** — No async overhead for local reads
4. **Debounced search** — 300ms delay
5. **Relevance-ranked results** — Title > Category > Description
6. **Queue deduplication** — No redundant network requests
7. **Axios interceptors** — Centralized auth, no per-request boilerplate
8. **JSON columns** — Complex data (subtasks, labels) stored as JSON in SQLite for flexibility

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

The Axios client auto-selects the correct base URL:
- **iOS Simulator**: `http://localhost:3000`
- **Android Emulator**: `http://10.0.2.2:3000`

---

## Backend Architecture

### File Structure (Node.js)

```
Nodejs/
├── src/
│   ├── index.js                    # Express app, MongoDB connection, static serving
│   ├── controllers/
│   │   ├── auth.controller.js      # Register, login, profile
│   │   └── task.controller.js      # Full CRUD + subtasks + attachments + voice notes
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   └── upload.middleware.js    # Multer config for files and audio
│   ├── models/
│   │   ├── task.model.js           # Mongoose schema with embedded subdocuments
│   │   └── user.model.js           # User with bcrypt password hashing
│   └── routes/
│       ├── auth.routes.js          # /api/auth/*
│       └── task.routes.js          # /api/tasks/* (all endpoints)
├── uploads/
│   ├── attachments/                # Stored attachment files
│   └── voice-notes/                # Stored voice note audio files
├── .env                            # PORT, MONGODB_URI, JWT_SECRET
└── package.json
```

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.18.2 | HTTP framework |
| mongoose | 7.6.3 | MongoDB ODM |
| jsonwebtoken | 9.0.2 | JWT auth tokens |
| bcryptjs | 2.4.3 | Password hashing |
| multer | latest | File upload handling |
| dotenv | 16.3.1 | Environment variables |

### Task Model (MongoDB)

The Task model uses embedded subdocuments for subtasks, attachments, and voice notes:

```javascript
{
  title: String (required, max 200),
  description: String (markdown supported),
  status: 'pending' | 'in-progress' | 'completed',
  priority: 'low' | 'medium' | 'high' | 'urgent',
  dueDate: Date,
  category: String,
  labels: [String],
  notes: String,
  subtasks: [{ id, title, isCompleted, createdAt }],
  recurrence: { type, interval, daysOfWeek, endDate, occurrences },
  attachments: [{ id, fileName, filePath, fileSize, mimeType, createdAt }],
  voiceNotes: [{ id, filePath, duration, createdAt }],
  user: ObjectId (ref: User),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### Indexes

- Text index on `title`, `description`, `notes`, `category` for search
- Compound indexes: `user+status`, `user+priority`, `user+category`, `user+dueDate`

---

## Dependencies

```json
{
  "@react-native-community/netinfo": "Network detection",
  "@react-navigation/native": "Navigation",
  "@react-navigation/native-stack": "Stack navigator",
  "axios": "HTTP client with interceptors",
  "react-native-audio-recorder-player": "Voice note recording",
  "react-native-document-picker": "File attachment selection",
  "react-native-fs": "Local file system access",
  "react-native-quick-sqlite": "SQLite database",
  "react-native-safe-area-context": "Safe area handling",
  "react-native-screens": "Native screen containers",
  "zustand": "State management"
}
```

---

## Summary

The Task Manager implements a comprehensive offline-first architecture where every operation — from creating tasks with subtasks and attachments to recording voice notes — works instantly without network connectivity. All data is persisted in SQLite with JSON columns for complex nested structures. The Axios-based API client with interceptors handles authentication transparently, while the background sync engine with exponential backoff retry ensures eventual consistency with the server. Zustand stores provide reactive state management without the boilerplate of Context providers.
