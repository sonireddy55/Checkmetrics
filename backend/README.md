# ClearMetric Backend API

This is the backend API for the ClearMetric Chrome extension. It receives scraped Power BI dashboard text and returns AI-powered explanations.

## Deploy to Vercel (One-Click)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd backend
vercel
```

Follow the prompts. When asked, use these settings:
- Link to existing project? **No**
- Project name: **clearmetric-api**
- Directory: **./backend**

### Step 3: Add Environment Variable
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **clearmetric-api** project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (starts with `sk-`)

### Step 4: Redeploy
```bash
vercel --prod
```

### Step 5: Update Extension
Copy your Vercel URL (e.g., `https://clearmetric-api.vercel.app`) and update `sidepanel.tsx`:

```typescript
const BACKEND_URL = "https://clearmetric-api.vercel.app/api/explain"
```

## API Usage

**Endpoint:** `POST /api/explain`

**Request:**
```json
{
  "text": "Dashboard text content here..."
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "explanation": "This dashboard shows...",
    "verifiable": true,
    "citations": ["Revenue: $1.2M", "Growth: 15%"]
  }
}
```

## Security Features

- ✅ Server-side system prompt (prevents prompt injection)
- ✅ CORS enabled for extension access
- ✅ API key kept secret on server
- ✅ "Hard refusal" logic for unverifiable data
