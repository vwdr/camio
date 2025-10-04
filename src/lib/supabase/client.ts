import { createClient } from '@supabase/supabase-js';

// Ensure we have URLs even in development without .env setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxMzM5NTk5OCwiZXhwIjoxOTI4OTcxOTk4fQ.z_Hz5Q8VFpTI1MikN6GJI6nEJNDgaGQvC_xEPQwQrLk';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);