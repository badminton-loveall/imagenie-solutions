import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the admin area. Uses the public publishable key; what a signed-in
 * user can see is decided by row-level security (only emails in `admin_users` see data).
 */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
