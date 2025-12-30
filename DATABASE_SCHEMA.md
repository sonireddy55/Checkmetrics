# ClearMetric Database Schema

## Supabase Setup Instructions

### 1. Create Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Profile
  display_name TEXT,
  avatar_url TEXT,
  
  -- Subscription
  is_pro BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'free', -- free, active, trialing, past_due, canceled
  subscription_plan TEXT, -- monthly, annual
  
  -- Auth provider info
  auth_provider TEXT, -- google, apple, email
  provider_id TEXT
);

-- Usage tracking table
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT,
  
  -- Monthly limits
  analyses_count INTEGER DEFAULT 0,
  followups_count INTEGER DEFAULT 0,
  reset_date DATE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE,
  
  -- Total stats
  total_analyses INTEGER DEFAULT 0,
  total_followups INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table (for abuse prevention)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, fingerprint)
);

-- Analysis history (optional - for PRO users)
CREATE TABLE analysis_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- trends, drivers, anomalies, custom
  dashboard_data TEXT,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_usage_user ON usage(user_id);
CREATE INDEX idx_usage_fingerprint ON usage(device_fingerprint);
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX idx_history_user ON analysis_history(user_id);
```

### 2. Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Usage policies
CREATE POLICY "Users can read own usage" ON usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage usage" ON usage
  FOR ALL USING (true);

-- Devices policies
CREATE POLICY "Users can read own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);

-- History policies
CREATE POLICY "Users can read own history" ON analysis_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 3. Functions

```sql
-- Function to check and increment usage
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id UUID,
  p_fingerprint TEXT,
  p_usage_type TEXT -- 'analysis' or 'followup'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_usage RECORD;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  -- Get user
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  
  -- PRO users have unlimited
  IF v_user.is_pro THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', -1);
  END IF;
  
  -- Get or create usage record
  INSERT INTO usage (user_id, device_fingerprint)
  VALUES (p_user_id, p_fingerprint)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT * INTO v_usage 
  FROM usage 
  WHERE user_id = p_user_id;
  
  -- Check if month reset needed
  IF v_usage.reset_date <= CURRENT_DATE THEN
    UPDATE usage 
    SET analyses_count = 0, 
        reset_date = (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE
    WHERE user_id = p_user_id;
    v_usage.analyses_count := 0;
  END IF;
  
  -- Set limits
  IF p_usage_type = 'analysis' THEN
    v_limit := 10;
    v_count := v_usage.analyses_count;
  ELSE
    v_limit := 3;
    v_count := v_usage.followups_count;
  END IF;
  
  -- Check limit
  IF v_count >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0);
  END IF;
  
  -- Increment
  IF p_usage_type = 'analysis' THEN
    UPDATE usage 
    SET analyses_count = analyses_count + 1,
        total_analyses = total_analyses + 1
    WHERE user_id = p_user_id;
  ELSE
    UPDATE usage 
    SET followups_count = followups_count + 1,
        total_followups = total_followups + 1
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', v_limit - v_count - 1);
END;
$$;
```

### 4. Environment Variables

Add these to your Vercel project:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 5. Auth Configuration

In Supabase Dashboard → Authentication → Providers:

1. **Google OAuth**
   - Enable Google provider
   - Add Client ID and Secret from Google Cloud Console
   - Add redirect URL to Google OAuth credentials

2. **Apple OAuth**
   - Enable Apple provider
   - Configure with Apple Developer credentials
   - Add redirect URL

3. **Email Auth**
   - Enable Email provider
   - Configure email templates
   - Set up SMTP (optional)

### 6. Redirect URLs

Add these to Supabase → Authentication → URL Configuration:

```
Site URL: chrome-extension://YOUR_EXTENSION_ID
Redirect URLs:
  - chrome-extension://YOUR_EXTENSION_ID/popup.html
  - chrome-extension://YOUR_EXTENSION_ID/sidepanel.html
```
