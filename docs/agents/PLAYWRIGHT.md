# PLAYWRIGHT Agent — NOTSENT E2E Tests

> Load this file when writing or running E2E tests. Read `CLAUDE.md` first.

---

## Setup

```bash
# Install from app/ directory
cd app && npm install -D @playwright/test
npx playwright install chromium
```

Test config: `app/playwright.config.ts`
Test files: `app/e2e/`

```ts
// app/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "cd ../backend && npm run dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

Use `Pixel 5` device profile — the app is mobile-first.

---

## Critical flows to cover (priority order)

### 1. Onboarding → Chat (P0)
```
- Open app
- Redirect to /onboarding (no flagged contacts)
- Fill name + phone number → "Add Contact"
- See YoureSetScreen → "Open NOTSENT"
- Land on ConversationList (/)
- Contact thread is visible
```

### 2. Intervention — "I won't send it" (P0)
```
- Complete onboarding
- Tap contact thread → ChatScreen
- Type a message → hit Send
- See /intervention load with AI response streaming
- Click "I won't send it"
- Return to ChatScreen
- Navigate to /stats → Messages stopped count > 0
```

### 3. Intervention — "Send anyway" (P0)
```
- Same as above but pick "Send anyway"
- Navigate to /stats → override rate shows
```

### 4. Tab navigation (P1)
```
- Navigate to each tab: Chats, AI Chat, Conversations, Stats, Settings
- Each screen renders without error
- Active tab is highlighted
```

### 5. Settings — breakup context (P1)
```
- Go to /settings
- Fill breakup summary + no-contact days + partner name
- Save
- Go back to chat → Send → intervention references partner name in response
```

### 6. Manage conversations (P1)
```
- Go to /conversations
- See list of past sessions for each contact
- Clear sessions for one contact
- Verify cleared
```

### 7. AI Chat / Support (P2)
```
- Go to /ai-chat
- Send a message
- See streaming response appear
```

### 8. Contacts management (P2)
```
- Go to /settings → Manage contacts
- Add a second contact
- Remove one contact
- Return to ConversationList — reflects update
```

---

## Page object pattern

Create a page object for each major screen to keep tests readable.

```ts
// e2e/pages/OnboardingPage.ts
import { Page } from "@playwright/test";
export class OnboardingPage {
  constructor(private page: Page) {}
  async addContact(name: string, phone: string) {
    await this.page.getByPlaceholder("Name").fill(name);
    await this.page.getByPlaceholder("Phone").fill(phone);
    await this.page.getByRole("button", { name: "Add Contact" }).click();
  }
  async continueToApp() {
    await this.page.getByRole("button", { name: "Open NOTSENT" }).click();
  }
}
```

```ts
// e2e/pages/InterventionPage.ts
import { Page } from "@playwright/test";
export class InterventionPage {
  constructor(private page: Page) {}
  async waitForAIResponse() {
    await this.page.waitForSelector("[data-testid='ai-message']", { timeout: 15000 });
  }
  async clickWontSend() {
    await this.page.getByRole("button", { name: /won't send/i }).click();
  }
  async clickSendAnyway() {
    await this.page.getByRole("button", { name: /send anyway/i }).click();
  }
}
```

---

## Test data setup

Tests reset localStorage before each test to ensure clean state:

```ts
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
```

For tests that need a pre-onboarded state:

```ts
async function seedOnboarding(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("notsent_flaggedContacts", JSON.stringify([{
      id: "contact_test_001",
      name: "Alex",
      phoneNumber: "+15555551234",
      dateAdded: Date.now(),
    }]));
  });
  await page.reload();
}
```

---

## Test IDs to add in components

Add `data-testid` attributes to key elements so tests don't rely on text (which can change):

| Element | data-testid |
|---|---|
| Contact thread row | `contact-thread-{contactId}` |
| Message input | `message-input` |
| Send button | `send-button` |
| AI message bubble | `ai-message` |
| "I won't send it" button | `wont-send-button` |
| "Send anyway" button | `send-anyway-button` |
| Stats — messages stopped count | `stats-stopped-count` |
| Stats — never sent count | `stats-never-sent-count` |
| Tab: Chats | `tab-chats` |
| Tab: Stats | `tab-stats` |

---

## AI response mocking (for fast tests)

The real AI stream is slow and flaky in CI. Mock the backend in unit/integration tests:

```ts
// In playwright, intercept the SSE endpoint
await page.route("**/api/chat", async (route) => {
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    body: 'data: {"text":"I can see you were about to send something."}\n\ndata: [DONE]\n\n',
  });
});
```

Only use real AI calls in a dedicated `--project=real-ai` test project that runs outside CI.

---

## Running tests

```bash
# All tests
cd app && npx playwright test

# Single test file
npx playwright test e2e/intervention.spec.ts

# With UI (debugging)
npx playwright test --ui

# Show last report
npx playwright show-report
```
