This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Gemini setup

RecallOS sends chat requests through the server-side `/api/chat` route using Google&apos;s official `@google/genai` SDK. Add your Gemini API key to `.env.local` (this file is already ignored by Git):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

The default model is the stable `gemini-3.8-flash`. To select another supported Gemini model without changing the code, add this optional server-side variable:

```bash
GEMINI_MODEL=gemini-3.8-flash
```

Restart the development server after changing environment variables. API credentials are read only by the route handler and are never sent to the browser.

## Walrus Memory development setup

RecallOS uses one fixed, server-derived namespace, `recallos-development`, for its initial local development identity. This is intentionally **not** public multi-user authentication. Do not deploy it as a multi-user service until requests are authenticated and namespaces are derived server-side from verified identities.

Configure these server-only variables without a `NEXT_PUBLIC_` prefix:

```bash
MEMWAL_PRIVATE_KEY=your_delegate_private_key
MEMWAL_ACCOUNT_ID=your_account_object_id
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
```

The delegate key must never be committed or sent to the browser. `.env.local` is covered by the repository&apos;s `.env*` ignore rule.

### Safe manual persistence check

This project does not perform an automatic mainnet write during setup or testing. To verify persistence deliberately:

1. Start the app and confirm the Memory panel reports `Memory Online` and `Powered by Walrus`.
2. Send a meaningful fact such as “My preferred test framework is Vitest.” This explicitly triggers fact analysis and a possible mainnet write.
3. Wait for the reply and confirm the real memory count updates without a memory warning.
4. Select **New chat**, then ask “Which test framework do I prefer?”
5. Confirm the relevant stored fact appears under **Recalled this turn** and influences the answer.

Short greetings and very brief messages are not submitted for memory analysis. A successful chat response does not imply a successful memory write; RecallOS displays memory retrieval or saving failures separately.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
