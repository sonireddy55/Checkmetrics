# ClearMetric Production Roadmap

## Current Status (MVP)
- ✅ Chrome Extension with Side Panel
- ✅ Power BI detection
- ✅ Vercel API backend
- ✅ Freemium gating (10 analyses/mo, 3 follow-ups)
- ✅ Glassmorphism UI

## Phase 2: Production Build

### 1. Authentication (Supabase)
- [ ] Google OAuth
- [ ] Apple OAuth  
- [ ] Email/Password
- [ ] User database

### 2. Payments (Stripe)
- [ ] Checkout sessions
- [ ] Webhook for subscription events
- [ ] Customer portal

### 3. Abuse Prevention
- [ ] Device fingerprinting
- [ ] Database-backed usage tracking
- [ ] Rate limiting

### 4. UI Polish
- [ ] B2B SaaS style (no emojis)
- [ ] Inter font
- [ ] Lucide icons
- [ ] Professional color palette

## Environment Variables Needed

### Extension (.env)
```
PLASMO_PUBLIC_SUPABASE_URL=
PLASMO_PUBLIC_SUPABASE_ANON_KEY=
PLASMO_PUBLIC_API_URL=https://clearmetric-api.vercel.app
```

### Vercel API
```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Pricing
- FREE: 10 analyses/month, 3 follow-ups total
- PRO: $20/month or $150/year - Unlimited everything
