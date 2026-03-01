# Technical Proposal: Migrate from Redux to XState

## Status

Proposed

## Context

The current state management stack (`redux`, `@reduxjs/toolkit`, `remodules`, `redux-saga`, `next-redux-wrapper`, `react-redux`) is end-of-life. After upgrading to Next.js 16 and React 19, `remodules` fails to load because `@reduxjs/toolkit@1.7.1` no longer provides `createAction` as a named export in the ESM build. Upgrading Redux Toolkit alone would not fix `remodules`, which is unmaintained and tightly coupled to RTK internals.

Rather than patching or forking multiple deprecated libraries, this proposal replaces the entire stack with XState v5, which natively models the stateful, effect-heavy, device-driven workflows in this app.

## Current Architecture

### Modules (via `remodules`)

Each module bundles a reducer, selectors, and a saga watcher. Modules are registered dynamically at component mount via `useModule()`.

| Module | State keys | Sagas | Used by |
|---|---|---|---|
| `devices` | `devicesById`, `deviceIds`, `isSearching`, `isBluetoothAvailable`, `valueToDeviceId`, `resistance` | BLE discovery, GATT reads/writes, characteristic notifications via event channels | `pages/devices.tsx` |
| `workout` | `points`, `startedAt`, `finishedAt`, `tcx`, `workout`, `intervalMetaById`, `ftp`, `elapsedTime` | 250ms ticker, resistance updates, interval beeps, TCX generation | `pages/workout/index.tsx`, `Visualiser.tsx` |
| `workoutEditor` | `workout`, `selectedIntervals`, `saving` | File picker (load/save MRC/CWO) | `Editor.tsx` |
| `workoutLoader` | `loading` | File System Access API open/save | `Editor.tsx` |
| `strava` | `token`, `loading`, `uploaded`, `error` | localStorage persistence, Strava API upload | `pages/auth/strava.tsx`, `UploadButton.tsx` |

### Cross-module communication

- `common/addPoint` — dispatched by the devices tick loop, consumed by the workout reducer via `extraReducers`.
- `common/updateResistance` — dispatched by the workout saga, consumed by the devices saga to write BLE commands.

### Side effects handled by sagas

- Web Bluetooth API (discover, connect, read characteristics, write control point)
- File System Access API (open/save workout files)
- Strava OAuth + upload API
- Interval ticker (250ms `setInterval` via saga `delay`/`fork`)
- Audio beep playback at interval transitions
- localStorage read/write for Strava token

## Proposed Architecture

### Why XState

| Concern | Redux + Saga | XState |
|---|---|---|
| States with illegal transitions | Implicit (booleans, conditionals) | Explicit state nodes — impossible states are unrepresentable |
| Side effects | Sagas (generator-based, separate from state) | Actions/services invoked directly by state transitions |
| Async lifecycle | Manual `loading`/`error`/`success` booleans | Built-in with `invoke` + `onDone`/`onError` |
| Dynamic modules | `remodules` (unmaintained) | Actor model — spawn/stop actors on demand |
| Cross-module comms | Shared actions + `extraReducers` | `sendTo` between actors, or event forwarding |
| Testing | Requires mocking store + saga runner | Deterministic — test machine logic without side effects |
| DevTools | Redux DevTools | XState Inspector (visual state chart) |

### Machine Mapping

Each `remodules` module maps to one XState machine (actor). The app composes them via a root-level actor system.

#### 1. `devicesMachine`

```
States:
  idle
    → SEARCH_FTMS → searching
    → SEARCH_HRM → searching
    → SEARCH_ALL → searching
  searching
    → DEVICE_FOUND → searching (add device to context, continue scanning)
    → SEARCH_FAILED → idle
    → STOP_SEARCH → idle
  connected
    → VALUES_UPDATED → connected (update context)
    → WRITE_COMMAND → connected (invoke BLE write)
    → DISCONNECT → idle

Context:
  devicesById: Record<string, Device>
  deviceIds: string[]
  isBluetoothAvailable: boolean
  valueToDeviceId: { power, cadence, heartRate, speed, resistance }
  resistance: number

Invoked services:
  - bleDiscovery: Web Bluetooth requestDevice + GATT connect
  - characteristicListener: callback actor wrapping characteristic notifications (replaces saga event channels)
  - bleWrite: write to GATT characteristic
```

The BLE characteristic notification stream maps naturally to a **callback actor** — XState's equivalent of a saga event channel.

#### 2. `workoutMachine`

```
States:
  idle
    → LOAD_WORKOUT → loading
    → START → running
  loading
    → WORKOUT_LOADED → idle (context updated)
    → LOAD_FAILED → idle
  running
    → TICK → running (update elapsed time, record point, update resistance)
    → FINISH → finished
  finished
    → CLEAR → idle
    → GENERATE_TCX → generatingTcx
  generatingTcx
    → TCX_READY → finished (store tcx in context)

Context:
  points: Point[]
  startedAt: number | null
  finishedAt: number | null
  tcx: string | null
  workout: Workout | null
  intervalMetaById: Record<string, IntervalMeta>
  ftp: number
  elapsedTime: number

Invoked services:
  - ticker: callback actor that emits TICK every 250ms (replaces saga fork + delay loop)
  - tcxGenerator: promise actor that builds TCX XML
  - fileLoader: promise actor wrapping File System Access API
```

The 250ms ticker is a **callback actor** that calls `sendBack({ type: 'TICK' })` on an interval and cleans up on stop — cleaner than the saga fork/cancel pattern.

#### 3. `workoutEditorMachine`

```
States:
  editing
    → ADD_INTERVAL → editing
    → UPDATE_INTERVAL_DURATION → editing
    → UPDATE_INTERVAL_POWER → editing
    → SELECT_INTERVAL → editing
    → DUPLICATE_SELECTED → editing
    → DELETE_SELECTED → editing
    → UPDATE_NAME → editing
    → SAVE → saving
    → LOAD → loading
  saving
    → SAVE_FINISHED → editing
    → SAVE_FAILED → editing
  loading
    → LOADED → editing
    → LOAD_FAILED → editing

Context:
  workout: Workout
  selectedIntervals: Record<string, boolean>
```

This is the most straightforward migration — mostly context updates with two async operations (file save/load).

#### 4. `stravaMachine`

```
States:
  loggedOut
    → TOKEN_LOADED → loggedIn
    → LOGGED_IN → loggedIn
  loggedIn
    → UPLOAD → uploading
    → LOGOUT → loggedOut
  uploading
    → UPLOAD_SUCCESS → uploaded
    → UPLOAD_FAILED → loggedIn (with error in context)
  uploaded
    → UPLOAD → uploading (re-upload)
    → LOGOUT → loggedOut

Context:
  token: string | null
  error: string | null

Entry/exit actions:
  loggedIn.entry → save token to localStorage
  loggedOut.entry → remove token from localStorage

Invoked services:
  - stravaUpload: promise actor that POSTs FormData to Strava API
```

localStorage side effects become **entry/exit actions** on state nodes — no saga needed.

#### 5. Root Actor System

```typescript
// src/machines/index.ts
import { setup, createActor } from 'xstate';

const appMachine = setup({
  types: {} as {
    children: {
      devices: 'devicesMachine';
      workout: 'workoutMachine';
      editor: 'workoutEditorMachine';
      strava: 'stravaMachine';
    };
  },
  actors: { devicesMachine, workoutMachine, workoutEditorMachine, stravaMachine },
}).createMachine({
  type: 'parallel',
  states: {
    devices: { invoke: { src: 'devicesMachine', id: 'devices', systemId: 'devices' } },
    workout: { invoke: { src: 'workoutMachine', id: 'workout', systemId: 'workout' } },
    editor: { invoke: { src: 'workoutEditorMachine', id: 'editor', systemId: 'editor' } },
    strava: { invoke: { src: 'stravaMachine', id: 'strava', systemId: 'strava' } },
  },
});
```

### Cross-module Communication

The two cross-cutting actions translate to **inter-actor messaging**:

| Current | XState equivalent |
|---|---|
| `common/addPoint` (devices → workout) | Workout machine's ticker reads device values via `system.get('devices')` snapshot, or devices actor sends point events to workout actor via `sendTo` |
| `common/updateResistance` (workout → devices) | Workout machine sends `{ type: 'WRITE_COMMAND', ... }` to devices actor via `sendTo('devices', ...)` |

Using `systemId` on actors allows any actor to reference another via `system.get('id')` without prop drilling.

### React Integration

XState v5 provides `@xstate/react` with hooks:

| Current | Replacement |
|---|---|
| `useModule(module)` | Actor created once at app level, provided via React context |
| `useSelector(selector)` | `useSelector(actorRef, selector)` from `@xstate/react` — same API shape |
| `useDispatch() + dispatch(action())` | `useActorRef()` + `actorRef.send({ type: 'EVENT' })` |
| `next-redux-wrapper` | Not needed — XState actors are client-only (this app has no server-side state requirements) |

### Next.js Integration

The current `next-redux-wrapper` handles SSR hydration, but inspection of the codebase shows:

- No `getServerSideProps` or `getStaticProps` dispatching Redux actions
- The HYDRATE handler just merges payloads into state, with no server-populated data
- All state is client-side (BLE devices, local workouts, Strava auth)

**`next-redux-wrapper` can be removed entirely.** The XState actor system will be created client-side and provided via a React context in `_app.tsx`.

```tsx
// src/pages/_app.tsx
import { createActor } from 'xstate';
import { AppActorContext } from '../machines/context';
import { appMachine } from '../machines';

const actor = createActor(appMachine);
actor.start();

function App({ Component, pageProps }) {
  return (
    <AppActorContext.Provider value={actor}>
      <Component {...pageProps} />
    </AppActorContext.Provider>
  );
}

export default App;
```

## Migration Plan

### Phase 1 — Devices machine (highest complexity, highest value)

1. Create `src/machines/devices.ts` — model BLE discovery, connection, and characteristic streaming as a state machine with callback actors.
2. Create `src/machines/context.ts` — app-level actor context provider.
3. Update `pages/devices.tsx` — replace `useModule`, `useSelector`, `useDispatch` with `useSelector(actorRef, ...)` and `actorRef.send(...)`.
4. Remove `src/modules/devices/`.
5. Verify BLE discovery, connection, and data streaming work end-to-end.

### Phase 2 — Workout machine

1. Create `src/machines/workout.ts` — model workout lifecycle with ticker callback actor.
2. Wire cross-actor communication: workout reads device values, sends resistance commands.
3. Update `pages/workout/index.tsx` and `Visualiser.tsx`.
4. Remove `src/modules/workout/module.ts` and related saga code.

### Phase 3 — Workout editor + loader

1. Create `src/machines/workoutEditor.ts` — combine editor and loader into one machine (loader is just two states; not worth a separate actor).
2. Update `Editor.tsx`.
3. Remove `src/modules/workout/editor/` and `src/modules/workout/loader/`.

### Phase 4 — Strava machine

1. Create `src/machines/strava.ts`.
2. Update `pages/auth/strava.tsx` and `UploadButton.tsx`.
3. Remove `src/modules/strava/`.

### Phase 5 — Cleanup

1. Compose all machines into root actor system in `src/machines/index.ts`.
2. Update `_app.tsx` — remove `createWrapper`, `createDynamicStore`, replace with actor context.
3. Remove `src/modules/common/actions.ts`, `src/modules/util.ts`.
4. Uninstall: `redux`, `@reduxjs/toolkit`, `react-redux`, `redux-saga`, `remodules`, `next-redux-wrapper`.
5. Install: `xstate@^5`, `@xstate/react@^4`.

## Dependency Changes

### Remove

```
@reduxjs/toolkit
redux
react-redux
redux-saga
remodules
next-redux-wrapper
```

### Add

```
xstate@^5
@xstate/react@^4
```

## Risks

| Risk | Mitigation |
|---|---|
| Web Bluetooth callback actors are untested | Spike the BLE callback actor in isolation before full migration — the characteristic notification pattern is the most complex piece |
| XState v5 learning curve | The team should work through the official XState v5 docs and stately.ai visualizer before starting |
| Regression in workout timing | The 250ms ticker is timing-sensitive; compare recorded point timestamps before/after migration |
| Loss of Redux DevTools | XState Inspector provides equivalent visibility; install `@xstate/inspect` for dev builds |

## Out of Scope

- Changing the Workout, Point, or Device data models.
- Migrating to App Router (separate effort).
- Adding new features during migration.
