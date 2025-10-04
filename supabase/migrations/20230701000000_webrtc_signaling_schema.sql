-- This is the SQL schema for the WebRTC signaling tables in Supabase

-- Create a table to track active signaling channels
CREATE TABLE IF NOT EXISTS public.signaling_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on channel_name
CREATE INDEX IF NOT EXISTS idx_signaling_channels_name ON public.signaling_channels(channel_name);

-- Create a table for signaling messages
CREATE TABLE IF NOT EXISTS public.signaling_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL,
  message_type TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_signaling_messages_recipient ON public.signaling_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_sender ON public.signaling_messages(sender);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_channel ON public.signaling_messages(channel);

-- Create a function to delete old messages (cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_signaling_messages() RETURNS void AS $$
BEGIN
  DELETE FROM public.signaling_messages
  WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the last_active timestamp
CREATE OR REPLACE FUNCTION update_signaling_channel_timestamp() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.signaling_channels
  SET last_active = NOW()
  WHERE channel_name = NEW.channel;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_signaling_channel_last_active
AFTER INSERT ON public.signaling_messages
FOR EACH ROW
EXECUTE FUNCTION update_signaling_channel_timestamp();

-- Enable row level security
ALTER TABLE public.signaling_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signaling_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for signaling_channels
CREATE POLICY "Anyone can create a channel" 
ON public.signaling_channels FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Anyone can read channels" 
ON public.signaling_channels FOR SELECT 
TO authenticated, anon
USING (true);

-- Create policies for signaling_messages
CREATE POLICY "Anyone can insert messages" 
ON public.signaling_messages FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Users can read messages addressed to them" 
ON public.signaling_messages FOR SELECT 
TO authenticated, anon
USING (recipient = current_setting('request.jwt.claims', true)::json->>'sub' OR sender = current_setting('request.jwt.claims', true)::json->>'sub');

-- Setup realtime publication
BEGIN;
  -- Drop existing publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  
  -- Create a new publication for all tables
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add signaling_messages table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.signaling_messages;

-- Note: You'll need to configure Supabase's Row Level Security and Realtime features
-- to ensure messages can only be accessed by the intended recipients.