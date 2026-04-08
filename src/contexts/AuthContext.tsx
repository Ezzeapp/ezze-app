import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { User as AppUser } from '@/types'

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  refetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchAppUser(userId: string): Promise<AppUser | null> {
  // public.users has: id, plan, is_admin, onboarded, disabled, language, theme, timezone
  // email comes from auth.users (via session), name/avatar from master_profiles
  const { data, error } = await supabase
    .from('users')
    .select('id, language, theme, timezone, onboarded, is_admin, plan')
    .eq('id', userId)
    .single()
  if (error || !data) return null

  // Fetch email from auth
  const { data: authData } = await supabase.auth.getUser()
  const email = authData?.user?.email ?? ''

  // Fetch name/avatar from master_profiles (optional — may not exist yet)
  const { data: profile } = await supabase
    .from('master_profiles')
    .select('display_name, profession, avatar')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    id: data.id,
    email,
    name: profile?.display_name || profile?.profession || '',
    avatar: profile?.avatar ?? undefined,
    language: data.language ?? undefined,
    theme: data.theme ?? undefined,
    timezone: data.timezone ?? undefined,
    onboarded: data.onboarded ?? false,
    is_admin: data.is_admin ?? false,
    plan: data.plan ?? 'free',
    collectionId: 'users',
    collectionName: 'users',
    created: '',
    updated: '',
  } as AppUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const appUser = await fetchAppUser(session.user.id)
        setUser(appUser)
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    // Listen to auth state changes
    // NOTE: DB queries inside onAuthStateChange can deadlock in Supabase JS v2.
    // Use setTimeout(0) to defer async work outside the internal auth queue.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        if (session?.user) {
          // Check if user is disabled
          const { data: userData } = await supabase
            .from('users')
            .select('disabled')
            .eq('id', session.user.id)
            .single()

          if (userData?.disabled) {
            await supabase.auth.signOut()
            return
          }
          const appUser = await fetchAppUser(session.user.id)
          // Если строки пользователя нет в БД (удалён админом) — разлогиниваем
          if (!appUser) {
            await supabase.auth.signOut()
            return
          }
          setSession(session)
          setUser(appUser)
        } else {
          setSession(session)
          setUser(null)
        }
        setIsLoading(false)
      }, 0)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Check if disabled
    const { data: userData } = await supabase
      .from('users')
      .select('disabled')
      .eq('id', data.user.id)
      .single()

    if (userData?.disabled) {
      await supabase.auth.signOut()
      throw new Error('ACCOUNT_DISABLED')
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, product: import.meta.env.VITE_PRODUCT || 'beauty' } },
    })
    if (error) throw error

    // Apply default timezone from app_settings
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('product', import.meta.env.VITE_PRODUCT || 'beauty')
      const settingsMap: Record<string, string> = {}
      settings?.forEach((r: any) => { settingsMap[r.key] = r.value })
      if (settingsMap.default_timezone && data.user) {
        await supabase
          .from('users')
          .update({ timezone: settingsMap.default_timezone })
          .eq('id', data.user.id)
      }
    } catch {
      // Non-critical
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refetchUser = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s?.user) {
      const appUser = await fetchAppUser(s.user.id)
      if (appUser) setUser(appUser)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    session,
    isAuthenticated: !!session && !!user,
    isLoading,
    login,
    register,
    logout,
    refetchUser,
  }), [user, session, isLoading, login, register, logout, refetchUser])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
