# Paid

Invoices you write in Claude, collected here.

You paste a WhatsApp thread, timesheet or email into Claude and say who to bill. Claude reads it and writes the line items. Paid saves the invoice, lets you edit it, gives your client a live link they can open and pay by UPI, and shows you when they've opened it and when they say they've paid.

**There is no AI inside Paid.** No OpenAI, Anthropic or other AI keys or SDKs. The whole dependency list is `next`, `react`, `react-dom`, `postgres`, `bcryptjs` and `qrcode` (see `package.json`). Claude does the thinking through MCP, paid for by the user's own Claude plan.

## How it fits together

```
You, in Claude ──> Claude reads the mess, writes line items
                          │  MCP (create_invoice, update_invoice, ...)
                          ▼
                 Paid (Next.js + Postgres on Vercel)
                   ├─ /dashboard       what's owed, overdue, paid
                   ├─ /invoices/:id    edit anything, mark sent or paid, activity log
                   └─ /i/:slug         client's page: invoice, UPI QR, "I've paid this"
```

The MCP server lives in the same app at `/mcp/<your-key>`. It speaks the Streamable HTTP transport in stateless mode and returns plain JSON (`lib/mcp.js`, no SDK needed). Each account has its own connector link, shown on the dashboard and in Settings.

### MCP tools

| Tool | What it does |
|---|---|
| `create_invoice` | Creates a draft from client, line items (quantity × rate), tax %, due date. Paid computes totals and returns the edit link and client link. |
| `list_invoices` | Lists invoices, filterable by draft, sent, viewed, unpaid, overdue, paid or client name. Shows whether the client opened the link. |
| `get_invoice` | Full detail for one invoice. |
| `update_invoice` | Changes any field; sending `items` replaces the line items. |
| `set_invoice_status` | Marks an invoice sent, paid or back to draft. |

## Try it (for reviewers)

**Live app:** `https://YOUR-APP.vercel.app`
**Login:** `demo@paid.app` / `demo1234` (or click "Open the demo account")

**Connect Claude (about one minute):**
1. Open claude.ai (web or desktop), go to Settings, then Connectors, and choose **Add custom connector**.
2. Name it `Paid` and paste this URL: `https://YOUR-APP.vercel.app/mcp/pk_demo_volopay_2026`
3. Click Add. No login is needed; the link itself identifies the demo account.
4. In a new chat, turn the Paid connector on (search and tools menu) and try a prompt like the one below.

```
Invoice Northwind Logistics (ap@northwind.in) from this chat. 18% GST, due in 15 days.

[Mon 10:14] Rohit: can you also redo the onboarding screens? 3 screens
[Mon 10:20] Me: sure, ₹6,000 per screen
[Wed 18:02] Rohit: looks great. Also need the icon set, same as we discussed
[Wed 18:05] Me: icon set is ₹9,500 flat 👍
[Fri 11:40] Rohit: perfect, send the bill
```

Then open the dashboard. The invoice is already there (the page refreshes itself). Edit a line, mark it as sent, and open the client link in a private window to see the client view. Back in Claude, try "Who still owes me money? Draft a polite WhatsApp reminder for the overdue one."

## Run it yourself

Needs Node 18+ and a Postgres database (Neon's free tier works well).

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL and SESSION_SECRET
DATABASE_URL="postgres://..." npm run db:setup   # creates tables and the demo account
npm run dev
```

Test the MCP endpoint without Claude:

```bash
curl -s -X POST http://localhost:3000/mcp/pk_demo_volopay_2026 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Deploy (about 15 minutes)

1. **Database:** create a free project at neon.tech. Copy the *pooled* connection string.
2. **Tables and demo data:** run `DATABASE_URL="<that string>" npm run db:setup` from your machine.
3. **Code:** push this folder to a new GitHub repo.
4. **Vercel:** import the repo at vercel.com/new. Add environment variables `DATABASE_URL` (the pooled string) and `SESSION_SECRET` (any long random string, e.g. `openssl rand -hex 32`). Deploy.
5. **Check:** open `https://<app>.vercel.app`, click "Open the demo account", and copy the connector link from the dashboard.

Use the production `*.vercel.app` URL for the connector, not a preview deployment URL. Preview URLs can sit behind Vercel's login, which Claude can't get past.

Optional: set `APP_URL` if you put the app on a custom domain, and `DEMO_MCP_KEY` before running `db:setup` to use a different demo connector link.

## Project map

```
app/
  page.js                  landing, log in, sign up, demo login
  dashboard/page.js        totals, connector link, invoice list (auto-refreshes)
  invoices/[id]/page.js    editor, status actions, activity log
  invoices/new/page.js     create by hand
  i/[slug]/page.js         public client page with UPI QR
  settings/page.js         business name, UPI ID, connector link
  mcp/[key]/route.js       MCP endpoint
  api/...                  JSON routes used by the web app
lib/
  mcp.js                   MCP protocol and tool definitions
  invoices.js              all invoice logic, shared by MCP and web
  auth.js, db.js, format.js, urls.js
db/schema.sql              three tables: users, invoices, invoice_events
scripts/setup-db.mjs       creates tables and the demo account
```

## Known limits of this first version

- Payment is confirmed by the freelancer (the client can flag "I've paid"). Automatic confirmation needs a payment gateway such as Razorpay, which is the next build.
- The connector link works like an API key. OAuth sign-in for the connector is the proper next step.
- No PDF export or email sending yet; sharing is by link or WhatsApp.
- One tax rate per invoice (enough for GST at a single slab).
