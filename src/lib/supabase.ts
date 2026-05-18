import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type SupabasePost = {
  id: string
  title: string
  content: string
  author: string
  created_at: string
}

export type SupabaseContactMessage = {
  id: string
  name: string
  email: string
  message: string
  source: string
  created_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

let client: SupabaseClient | null = null

export function getPortfolioSupabase() {
  if (!isSupabaseConfigured) {
    return null
  }

  client ??= createClient(supabaseUrl, supabasePublishableKey)
  return client
}
