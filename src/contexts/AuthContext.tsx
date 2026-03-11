import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
      }
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
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
      options: { data: { name } },
    })
    if (error) throw error

    // Apply default timezone from app_settings
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
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

  const value = useMemo(() => ({
    user,
    session,
    isAuthenticated: !!session && !!user,
    isLoading,
    login,
    register,
    logout,
  }), [user, session, isLoading, login, register, logout])

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
