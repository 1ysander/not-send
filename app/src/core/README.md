# AI read-over core

Portable logic for the “AI read-over” flow: user composes a message → AI reviews it → user chooses **I won’t send it** or **Send anyway**.

This module has **no dependency on React, DOM, or any platform API**. All I/O goes through an injected **transport**, so the same flow can run on the website, a Chrome extension, or a mobile app.

## Usage

1. **Implement `IReviewTransport`** for your platform:
   - **Web:** use `adapters/webTransport.ts` (calls the existing backend with `fetch`).
   - **Chrome extension:** implement the interface using your backend URL and extension APIs (e.g. `chrome.runtime.sendMessage` or direct `fetch` from the extension).
   - **Mobile:** implement the interface with your HTTP client and auth.

2. **Call the core flow** with your transport:

   ```ts
   import { startReview, streamReviewResponse, recordOutcome } from "./core";
   import type { IReviewTransport } from "./core";

   const transport: IReviewTransport = { ... }; // your implementation

   // Start a review (e.g. when user taps “Send”)
   const { sessionId } = await startReview(transport, messageText, { userContext, deviceId });

   // Stream the AI’s response to your UI
   await streamReviewResponse(transport, sessionId, messageText, (chunk) => appendToUI(chunk), options);

   // When user chooses an action
   await recordOutcome(transport, sessionId, "intercepted"); // or "sent"
   ```

3. **Types** (`UserContext`, `ReviewOutcome`, `CreateSessionOptions`) are exported from `./core` so you can type your UI and transport without touching the API.

## Adding a new client (extension / app)

- Copy or link the `core` folder into the new project (or publish it as a small package and depend on it).
- Implement `IReviewTransport` so that:
  - `createSession` and `streamReview` call your backend (same API as the web app, or your own).
  - `recordOutcome` sends the user’s choice to the backend.
- Build your UI (popup, overlay, native screen) and wire it to `startReview` → `streamReviewResponse` → `recordOutcome` as above.

The website uses `webReviewTransport` from `adapters/webTransport.ts`; other clients only need their own transport implementation.
