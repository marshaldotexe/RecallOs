# Separate demo tester memories

## What changed

Open `/tester`, enter an assigned access code, then chat as usual. A server-only allowlist maps the code to Alice, Bob, or Charlie. A signed, HttpOnly cookie lasts 24 hours. Every chat, save, and status request verifies it; invalid or missing sessions never fall back to shared memory. The client tester ID is only checked against the signed session to reject stale tabs; it cannot select an account or namespace.

The existing Walrus account and delegate key remain server-side. Save, recall, and the displayed count use the same explicit namespace:

| Tester | Namespace |
| --- | --- |
| Alice | `recallos-demo-v1-alice` |
| Bob | `recallos-demo-v1-bob` |
| Charlie | `recallos-demo-v1-charlie` |

Existing `recallos-development` memories remain stored and are not copied into tester spaces. Gemini model configuration, recall limits, automatic useful-fact saving, error handling, dependencies, and Next/Vercel configuration are preserved.

## 1. Configure locally in Cursor

1. Open the folder `C:\Users\SHAIBU\recallos` in Cursor.
2. Open `.env.local`. Keep all your existing Gemini and MemWal entries.
3. Generate **four different** random values in Cursor's terminal. Run this four times, saving each output privately:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Add the following lines. Replace every placeholder: use the first generated value for the signing secret and the other three for tester codes. Each must be at least 32 characters; generated values above are 64 characters. The JSON must stay on one line.

   ```dotenv
   RECALLOS_DEMO_ENABLED=true
   RECALLOS_SESSION_SECRET=REPLACE_WITH_FIRST_RANDOM_VALUE
   RECALLOS_TESTER_CODES={"alice":"REPLACE_WITH_SECOND_RANDOM_VALUE","bob":"REPLACE_WITH_THIRD_RANDOM_VALUE","charlie":"REPLACE_WITH_FOURTH_RANDOM_VALUE"}
   ```

5. Save the file and restart `npm run dev`. Open `http://localhost:3000/tester` (use the port printed by Next if different).
6. Enter Alice's code. The sidebar should show **Tester Alice**. Give each tester only their own code privately.

Do not prefix any of these variables, the Gemini key, or the Walrus credentials with `NEXT_PUBLIC_`. Do not commit `.env.local`, put codes in URLs, or share terminal screenshots containing secrets. `.env*` is already ignored by this project.

## 2. Test separation

1. Use two separate browser profiles (or a normal browser and a private window). Tabs in the same profile share cookies.
2. Enter Alice's code in the first profile. Say: **“My fictional demo project is called Amber Kite, and my preferred editor theme is purple.”** Wait for memory saving to finish.
3. Enter Bob's code in the second profile. Say: **“My fictional demo project is called Blue Harbor, and my preferred editor theme is green.”** Wait for saving to finish.
4. Start a new conversation or reload each profile to remove the previous chat history. Ask **“What is my project called and what editor theme do I prefer?”**
5. Check both the answer and the recalled-memory panel: Alice should see her facts and Bob should see his. Semantic retrieval may omit a fact; a zero-match response alone does not prove isolation. The automated checks verify namespace routing independently of model answers.
6. Reload Alice's profile, re-enter the same code if needed, and confirm her saved facts persist. Check that each displayed memory count belongs to that tester.
7. In a fresh profile, opening `/api/memory/status` must return HTTP 401 and no memories. An incorrect code must not grant access.
8. To switch testers, finish pending requests, close other RecallOS tabs, click the tester name, end the session, and enter another code. Entry performs a full page navigation to clear the conversation. A stale tab submitting another tester ID receives HTTP 409; reload it before continuing. Logging out does not cancel already accepted server operations.

Optional browser-console tampering check, while signed in as Alice (this does not call Gemini or Walrus because it fails before those calls):

```javascript
await fetch('/api/memory/save', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Attempt to choose Bob', testerId: 'bob', accountId: 'fake', namespace: 'recallos-demo-v1-bob' })
}).then(r => r.status)
// Expected: 409. Neither accountId nor namespace can override the session.
```

## 3. Vercel

1. In the existing Vercel project's Settings → Environment Variables, add the three `RECALLOS_*` variables above. Paste the JSON value without surrounding shell quotes.
2. Keep existing Gemini and MemWal variables unchanged. Add demo values only to the deployment environments you intend to use.
3. Commit the changed application files and this guide using your normal Cursor/Git workflow, then deploy through the existing Vercel project. No new package or hosting project is required.
4. Open `https://YOUR-EXISTING-DEPLOYMENT/tester`. Repeat the two-profile isolation test on HTTPS. Production cookies use `Secure` and cannot be tested over plain HTTP with `npm run start`.
5. For independent preview and production memories, use separate Walrus account credentials or deliberately different server-side namespace prefixes in the allowlist. With the same account and the same namespace strings, preview and production share those memories.

Missing/invalid demo configuration intentionally denies access. Rotating one tester's code invalidates that tester's existing cookies; rotating the signing secret invalidates all cookies. Disabling `RECALLOS_DEMO_ENABLED` denies new requests. Changes in Vercel environment variables require a new deployment.

## Demo selection versus production authentication

This is a small, code-gated demo identity selector. Possession of a code grants that tester's space. It has no verified person, password recovery, MFA, durable session revocation, or distributed rate limiting. Use fictional demo data and retire it after testing.

For production, replace demo session issuance and `getTesterIdentity()` with a maintained authentication provider's server-verified session. Derive a stable memory namespace from the verified user subject (and tenant where relevant), never from a form, URL, header, localStorage, or arbitrary client account ID. Keep namespace mapping stable across sessions and deployments. Add shared rate limits and account/session lifecycle controls before public use.

These are application-level namespaces under one Walrus account, not separate wallets or separate Walrus permission grants. The server account/delegate can access all these namespaces, so a compromised server credential affects all testers. Treat recalled text as untrusted data as the existing Gemini flow already does.

## Verification and rollback

Run `npm run lint` and `npm run build` from the project folder. The companion offline checks test signed sessions, tampered/expired cookies, configuration failures, stale-client rejection, ignored account/namespace overrides, and save/recall/status scoping without using real credentials or contacting paid services. Live Gemini/Walrus recall still requires the manual checks above.

An original-file backup is stored in this chat workspace's `recallos-original` folder. To roll back, restore the five original modified files and remove the three newly added application files (`lib/tester-session.ts`, `app/api/tester/session/route.ts`, `app/tester/page.tsx`). Remove the demo environment entries if desired. No memories are deleted by this change. Restoring the original routes re-enables the former shared development space, so keep the deployment private during rollback.

Walrus namespace behavior: https://github.com/MystenLabs/MemWal/blob/dev/docs/sdk/api-reference.md
