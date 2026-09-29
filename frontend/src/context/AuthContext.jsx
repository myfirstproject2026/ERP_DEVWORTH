import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/services'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('nexus_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('nexus_token')
    if (token) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data)
          localStorage.setItem('nexus_user', JSON.stringify(res.data))
        })
        .catch(() => {
          localStorage.removeItem('nexus_token')
          localStorage.removeItem('nexus_user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('nexus_token', token)
    localStorage.setItem('nexus_user', JSON.stringify(userData))
    setUser(userData)
    // login response is a slim user object; pull the full profile (company name etc.)
    authApi.me().then((res) => {
      setUser(res.data)
      localStorage.setItem('nexus_user', JSON.stringify(res.data))
    }).catch(() => {})
  }

  const logout = () => {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
