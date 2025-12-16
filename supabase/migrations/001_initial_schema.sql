-- WireSniff Supabase Database Schema
-- This schema mirrors the local SQLite schema for cloud sync

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections table
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Requests table
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL DEFAULT '',
  protocol TEXT DEFAULT 'http',
  params JSONB DEFAULT '[]'::jsonb,
  headers JSONB DEFAULT '[]'::jsonb,
  body TEXT,
  body_type TEXT DEFAULT 'none',
  auth_type TEXT DEFAULT 'none',
  auth_config JSONB DEFAULT '{}'::jsonb,
  pre_request_script TEXT,
  test_script TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Environments table
CREATE TABLE IF NOT EXISTS public.environments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Environment variables table
CREATE TABLE IF NOT EXISTS public.environment_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Global variables table
CREATE TABLE IF NOT EXISTS public.global_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- WebSocket connections table
CREATE TABLE IF NOT EXISTS public.websocket_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  protocols JSONB DEFAULT '[]'::jsonb,
  headers JSONB DEFAULT '[]'::jsonb,
  auto_reconnect BOOLEAN DEFAULT FALSE,
  reconnect_interval INTEGER DEFAULT 5000,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- GraphQL requests table
CREATE TABLE IF NOT EXISTS public.graphql_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  query TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  operation_name TEXT,
  headers JSONB DEFAULT '[]'::jsonb,
  auth_type TEXT DEFAULT 'none',
  auth_config JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- SSE connections table
CREATE TABLE IF NOT EXISTS public.sse_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB DEFAULT '[]'::jsonb,
  with_credentials BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON public.collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collections_updated_at ON public.collections(updated_at);

CREATE INDEX IF NOT EXISTS idx_folders_collection_id ON public.folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_updated_at ON public.folders(updated_at);

CREATE INDEX IF NOT EXISTS idx_requests_collection_id ON public.requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_requests_folder_id ON public.requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_updated_at ON public.requests(updated_at);

CREATE INDEX IF NOT EXISTS idx_environments_user_id ON public.environments(user_id);
CREATE INDEX IF NOT EXISTS idx_environments_updated_at ON public.environments(updated_at);

CREATE INDEX IF NOT EXISTS idx_environment_variables_environment_id ON public.environment_variables(environment_id);
CREATE INDEX IF NOT EXISTS idx_environment_variables_updated_at ON public.environment_variables(updated_at);

CREATE INDEX IF NOT EXISTS idx_global_variables_user_id ON public.global_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_global_variables_updated_at ON public.global_variables(updated_at);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON public.settings(user_id);

CREATE INDEX IF NOT EXISTS idx_websocket_connections_user_id ON public.websocket_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_updated_at ON public.websocket_connections(updated_at);

CREATE INDEX IF NOT EXISTS idx_graphql_requests_user_id ON public.graphql_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_graphql_requests_updated_at ON public.graphql_requests(updated_at);

CREATE INDEX IF NOT EXISTS idx_sse_connections_user_id ON public.sse_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_sse_connections_updated_at ON public.sse_connections(updated_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphql_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sse_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for collections
CREATE POLICY "Users can view own collections" ON public.collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections" ON public.collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON public.collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON public.collections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for folders
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections c 
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections c 
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.collections c 
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.collections c 
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for requests
CREATE POLICY "Users can view own requests" ON public.requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests" ON public.requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requests" ON public.requests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own requests" ON public.requests
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for environments
CREATE POLICY "Users can view own environments" ON public.environments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own environments" ON public.environments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own environments" ON public.environments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own environments" ON public.environments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for environment_variables
CREATE POLICY "Users can view own environment variables" ON public.environment_variables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.environments e 
      WHERE e.id = environment_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own environment variables" ON public.environment_variables
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.environments e 
      WHERE e.id = environment_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own environment variables" ON public.environment_variables
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.environments e 
      WHERE e.id = environment_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own environment variables" ON public.environment_variables
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.environments e 
      WHERE e.id = environment_id AND e.user_id = auth.uid()
    )
  );

-- RLS Policies for global_variables
CREATE POLICY "Users can view own global variables" ON public.global_variables
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own global variables" ON public.global_variables
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own global variables" ON public.global_variables
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own global variables" ON public.global_variables
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for settings
CREATE POLICY "Users can view own settings" ON public.settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON public.settings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for websocket_connections
CREATE POLICY "Users can view own websocket connections" ON public.websocket_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own websocket connections" ON public.websocket_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own websocket connections" ON public.websocket_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own websocket connections" ON public.websocket_connections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for graphql_requests
CREATE POLICY "Users can view own graphql requests" ON public.graphql_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own graphql requests" ON public.graphql_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own graphql requests" ON public.graphql_requests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own graphql requests" ON public.graphql_requests
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sse_connections
CREATE POLICY "Users can view own sse connections" ON public.sse_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sse connections" ON public.sse_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sse connections" ON public.sse_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sse connections" ON public.sse_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_environments_updated_at
  BEFORE UPDATE ON public.environments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_environment_variables_updated_at
  BEFORE UPDATE ON public.environment_variables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_global_variables_updated_at
  BEFORE UPDATE ON public.global_variables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_websocket_connections_updated_at
  BEFORE UPDATE ON public.websocket_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_graphql_requests_updated_at
  BEFORE UPDATE ON public.graphql_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sse_connections_updated_at
  BEFORE UPDATE ON public.sse_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();