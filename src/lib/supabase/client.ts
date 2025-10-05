import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Use NEXT_PUBLIC_* env vars on the client. Do NOT embed any secret/service_role keys here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

type AuthStub = {
	signInWithPassword: (..._args: any[]) => Promise<never>;
	signUp: (..._args: any[]) => Promise<never>;
	signOut: (..._args: any[]) => Promise<never>;
};

let supabase: SupabaseClient | { auth: AuthStub };

if (isSupabaseConfigured) {
	// Safe to create the client with public anon key
	// For improved security, avoid persisting tokens in localStorage on the client.
	// For production, prefer HttpOnly cookie-based sessions handled on the server.
	supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
		auth: { persistSession: false },
	});
} else {
	// Create a fail-fast stub so accidental auth calls don't succeed with demo keys.
	const errMsg =
		'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.';

		const thrower = async (): Promise<never> => {
			throw new Error(errMsg);
		};

		// Minimal stub matching the shape used by client-side code (auth.signInWithPassword, auth.signUp, auth.signOut)
		supabase = {
			auth: {
				signInWithPassword: thrower,
				signUp: thrower,
				signOut: thrower,
			},
		};
}

export { supabase };