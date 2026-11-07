# NOVA AI — Full-stack chatbot starter

A responsive React website with:
- Email/password sign-up and sign-in
- Google OAuth sign-in
- Supabase user profiles, conversations and message history
- A protected Netlify Function that calls the Gemini API without exposing the API key
- Responsive desktop/mobile layout and dark/light theme

This is a deployable starter, not a hosted live website. You must connect your own Supabase and Gemini projects and deploy it.

## 1. What you need

- A GitHub account
- A Supabase account: https://supabase.com/
- A Google AI Studio API key: https://aistudio.google.com/app/apikey
- A Netlify account: https://www.netlify.com/
- Node.js 20 or newer if running locally

Free-tier availability, quotas and regional restrictions can change. Check each provider's current terms and limits.

## 2. Create the Supabase project

1. Create a new project in Supabase.
2. Open **Project Settings → API** (or **Data API / API Keys**, depending on the dashboard version).
3. Copy the Project URL and the public anon/publishable key.
4. Open **SQL Editor**, paste the full contents of `supabase/schema.sql`, and run it.
5. In **Authentication → URL Configuration**, add your local URL `http://localhost:5173` to the allowed redirect URLs. You will add your deployed Netlify URL later.

The SQL creates profiles, conversations and messages tables, enables Row Level Security (RLS), and adds a profile trigger. Do not disable RLS.

## 3. Enable Google sign-in

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen.
2. Create an OAuth Client ID with application type **Web application**.
3. In Supabase, open **Authentication → Providers → Google** and enable Google.
4. Copy the Google Client ID and Client Secret into Supabase's Google provider settings and save.
5. Copy the Supabase callback URL shown in that provider page and add it to the Google OAuth client's **Authorized redirect URIs**.
6. Add your local and deployed website URLs to Supabase's **Authentication → URL Configuration → Redirect URLs**.

Google's OAuth setup screens can change. Follow the exact callback URL shown by your Supabase project. Never put the Google Client Secret in frontend code.

## 4. Configure the project locally

Copy `.env.example` to a new file named `.env` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

Get the Gemini key from https://aistudio.google.com/app/apikey.

Important: `GEMINI_API_KEY` is server-only. Do not rename it to `VITE_GEMINI_API_KEY`, do not paste it into React code, and do not commit `.env` to GitHub.

Install and run:

```bash
npm install
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173`.

For Netlify's server function to work locally, install Netlify CLI and use:

```bash
npm install --save-dev netlify-cli
npx netlify dev
```

Then open the URL printed by Netlify CLI (normally `http://localhost:8888`).

## 5. Deploy to Netlify

1. Push this project to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and select the repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Functions directory: `netlify/functions` (already set in `netlify.toml`).
6. In Netlify **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
   - `GEMINI_API_KEY` = your Gemini API key
   - `GEMINI_MODEL` = `gemini-2.0-flash` (optional; choose a currently available model in your AI Studio project)
   - `SUPABASE_URL` = same Supabase project URL (recommended for function runtime)
   - `SUPABASE_ANON_KEY` = same public anon/publishable key (recommended for function runtime)
7. Trigger a fresh deploy after setting variables.
8. Copy the Netlify site URL, e.g. `https://your-site-name.netlify.app`.
9. Add that URL to Supabase **Authentication → URL Configuration → Site URL** and **Redirect URLs**.
10. Test sign-up, email confirmation, Google sign-in and sending a chat message.

If you change environment variables, redeploy the site so the frontend build receives the `VITE_` values.

## 6. Admin access

The schema includes an `is_admin` field for future admin features. New users default to `false`. This starter does not yet include an admin dashboard or privileged admin operations. Do not allow users to change their own `is_admin` value from the client. If you later add admin features, assign roles only from a trusted server-side process and add separate RLS policies.

## 7. Current scope and next improvements

Included: authentication UI, email/password auth, Google OAuth flow, profiles, private conversation/message storage, Gemini-backed chat endpoint, responsive layout.

Not included yet: password-reset screen, billing/subscriptions, admin dashboard UI, file uploads, streaming responses, rate limiting/usage quotas, moderation dashboard, custom domain, and production monitoring. Add these before treating it as a commercial production service.

## 8. Security notes

- Never commit `.env` or publish API secrets.
- Keep Supabase Row Level Security enabled.
- The chat function validates the signed-in user's Supabase access token before calling Gemini.
- Add rate limiting and abuse monitoring before inviting the public.
- API usage may incur charges or hit free-tier limits; set provider quotas/budgets where available.
- Do not store sensitive personal information in chatbot conversations.
