'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import api, { authAPI } from '@/lib/api'

interface User {
  userId: string
  username: string
  email: string
  picture?: string
  isGuest?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser')
    const token = localStorage.getItem('authToken')
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('currentUser')
        localStorage.removeItem('authToken')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login({ username, password })
      if (response.data.success) {
        const { user, token } = response.data
        localStorage.setItem('currentUser', JSON.stringify(user))
        localStorage.setItem('authToken', token)
        Cookies.set('authToken', token, { expires: 7 })
        setUser(user)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.register({ username, email, password })
      if (response.data.success) {
        const { user, token } = response.data
        localStorage.setItem('currentUser', JSON.stringify(user))
        localStorage.setItem('authToken', token)
        Cookies.set('authToken', token, { expires: 7 })
        setUser(user)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('authToken')
    localStorage.setItem('justLoggedOut', 'true')
    Cookies.remove('authToken')
    setUser(null)
    window.location.href = '/signin'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
