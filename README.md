# AgentLiability

Liability layer for agentic commerce. A user signs a spending mandate for an AI agent, every purchase becomes a PayPal
AUTHORIZE hold, an AI verifier decides when money is released, and disputes are resolved with evidence from a tamper-evident audit chain.

## What you get in the browser

- `/` is the landing page (WebGL hero, pinned horizontal sequence, scroll-driven chain, custom cursor, Lenis smooth scroll). Plays a short intro curtain once per browser session.
- `/app` is the console: mandates, purchases, spend pipeline, disputes, audit trail. Same design system, calmer motion.
- Palette is locked to four colors in `client/tailwind.config.js` (ink, paper, bone, vermilion). Status in the console is shown by shape (solid, outline, vermilion, struck through), not by extra hues.
- Fonts (Instrument Serif, Geist, Geist Mono) load from Google Fonts, so the first load needs internet.
- With `prefers-reduced-motion` on, intro, smooth scroll, scrubbed animations, cursor and WebGL motion are switched off and the horizontal section becomes a normal scroller.
- Client libraries: gsap (ScrollTrigger), lenis, framer-motion, ogl, @phosphor-icons/react.

## Run it (3 commands)

Needs Node 18.18+ (Node 20 recommended).

    npm run install:all
    npm run dev
    # open http://localhost:5173   (landing page)
    # console lives at http://localhost:5173/app

That is all. The `.env` file is already in the folder with generated secrets.

- No `MONGODB_URI` set: the server starts a throwaway in-memory MongoDB (first start downloads the mongod binary, around 70 MB, needs internet). Data resets on restart.
- No PayPal keys: PayPal runs in simulated mode, the full flow works locally (hold, capture, void, disputes).
- No Groq / Gemini keys: verdicts come from the deterministic rule engine, text is generated from the facts.

Production style run (one process, serves the built client):

    npm run build
    npm start        # http://localhost:4000

With Docker (brings its own MongoDB):

    docker compose up --build   # http://localhost:4000

## Plug in the real services (all optional, edit `.env`)

| What | Variables |
| --- | --- |
| MongoDB Atlas / local mongod | `MONGODB_URI` |
| PayPal sandbox | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` |
| Groq (primary AI) | `GROQ_API_KEY` |
| Gemini (fallback AI) | `GEMINI_API_KEY` |

Restart the server after changing `.env`. The sidebar shows which services are live.

### PayPal sandbox notes

- Create a REST app in the PayPal developer dashboard (sandbox), copy client id and secret.
- With keys set, a purchase creates an `AUTHORIZE` order and the pipeline shows **Approve in PayPal**. Log in with a sandbox personal
  account, approve, and PayPal sends you back to the app. Only then the server calls `/orders/{id}/authorize` and the funds are held.
  This buyer approval step is required by PayPal, an agent cannot skip it in sandbox.
- Holds are best captured inside the 3 day honor period and can be captured up to 29 days. Order approval itself has to happen within a few hours,
  stale orders are marked `expired` by the hourly sweep.
- Webhooks: PayPal needs a public URL. Use ngrok (or your Render URL) and add a webhook for
  `https://<public-host>/api/webhooks/paypal` with the events `CUSTOMER.DISPUTE.CREATED` and `CUSTOMER.DISPUTE.RESOLVED`.
  Put the webhook id in `PAYPAL_WEBHOOK_ID`. Signatures are verified with PayPal's verify-webhook-signature API, unsigned calls get a 401.
- Real sandbox disputes are awkward to create. The Dispute center has an "Open a test dispute" form that pushes a simulated
  dispute through the same handler as the webhook (verdict, evidence / accept-claim, audit entries).
- The AI verdict is a recommendation. Evidence is submitted to PayPal and PayPal makes the final decision.

### Deploy on Render

Push the folder to GitHub, create a Blueprint from `render.yaml`, set `MONGODB_URI` (Atlas free cluster) and `PUBLIC_URL`
(your onrender.com URL). Add the PayPal and AI keys if you want them.

## How it fits together

- **Mandate engine** (`server/src/services/mandateEngine.js`): Ed25519 signed mandate with budget, merchant allowlist and expiry. Budget is cumulative, holds and captures count against it. Over-limit or off-list purchases are blocked before any PayPal call.
- **PayPal layer** (`paypalClient.js`, `orderService.js`): Orders v2 with `AUTHORIZE`, authorize, capture, void, Disputes API (get, provide-evidence, accept-claim), idempotent requests via `PayPal-Request-Id` and an `Idempotency-Key` header on `POST /api/orders`.
- **AI verifier** (`aiVerifier.js`, `aiRouter.js`): hard checks (signature, amount, merchant, validity window, delivery, audit chain) are plain code. The LLM (Groq, then Gemini on 429/errors) only writes the explanation; if it disagrees with the rules, the rules verdict stays and the disagreement is shown.
- **Disputes** (`disputeService.js`, `webhooks/paypalWebhook.js`): webhook -> fetch dispute -> verdict -> follow only the HATEOAS actions PayPal offers.
- **Audit trail** (`auditChain.js`): HMAC-SHA256 hash chain, one writer at a time, unique sequence numbers, the model refuses updates and deletes.

Collections: `mandates`, `agentactions`, `audit_trail`, `disputes`, `idempotency_records`.

## Demo script (3 minutes)

On the console (`/app`), the **Demo script** panel does each scene with one click (or "Run all steps"):

1. Sign a $500, Amazon-only mandate.
2. Agent buys a $200 laptop: hold, AI check, capture. Watch the Spend pipeline.
3. Agent tries $700: red block, no PayPal request is made.
4. Buyer opens a dispute: verdict card appears in the Dispute center. Try "Carrier says not delivered" for a merchant-liable verdict.
5. Audit trail: click **Verify chain**, then verify as if entry #3 was edited to show the chain breaking.

The red **Emergency stop** revokes every active mandate and voids open holds. **Reset** in the demo panel wipes demo data.

To see an agent-liable verdict for real, edit a mandate's `maxAmount` directly in MongoDB: the signature check fails everywhere.

## API quick reference

    GET  /api/status
    GET/POST /api/mandates            POST /api/mandates/:id/revoke   POST /api/mandates/revoke-all
    GET/POST /api/orders              POST /api/orders/:id/deliver|capture|void
    GET  /api/disputes                POST /api/disputes/simulate
    POST /api/webhooks/paypal
    GET  /api/audit                   GET  /api/audit/verify?tamper=<seq>
    POST /api/system/reset

`mcp/paypal-mcp.json` has the PayPal MCP server config for agent clients that speak MCP (Claude Desktop, Cursor and similar).
