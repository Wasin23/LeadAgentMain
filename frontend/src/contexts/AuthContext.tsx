'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';

interface User {
  userId: string;
  username: string;
  email: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const savedUser = localStorage.getItem('currentUser');
    const authToken = localStorage.getItem('authToken');
    
    if (savedUser && authToken) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      } catch (error) {
        console.error('Invalid saved user data:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    console.log('[AUTH CONTEXT] Starting login for:', username);
    try {
      console.log('[AUTH CONTEXT] Calling authAPI.login...');
      const response = await authAPI.login({ username, password });
      console.log('[AUTH CONTEXT] Login response:', response.data);
      
      if (response.data.success) {
        const { user, token } = response.data;
        console.log('[AUTH CONTEXT] Login successful, storing auth data');
        
        // Store auth data
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('authToken', token);
        Cookies.set('authToken', token, { expires: 7 }); // Set cookie for SSE
        
        setUser(user);
        return true;
      }
      console.log('[AUTH CONTEXT] Login failed - success:false in response');
      // Clear any stale auth data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      Cookies.remove('authToken');
      setUser(null);
      return false;
    } catch (error: any) {
      console.error('[AUTH CONTEXT] Login error:', error);
      console.error('[AUTH CONTEXT] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Clear any stale auth data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      Cookies.remove('authToken');
      setUser(null);
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    console.log('[AUTH CONTEXT] Starting registration for:', username, email);
    try {
      console.log('[AUTH CONTEXT] Calling authAPI.register...');
      const response = await authAPI.register({ username, email, password });
      console.log('[AUTH CONTEXT] Registration response:', response.data);
      
      if (response.data.success) {
        const { user, token } = response.data;
        console.log('[AUTH CONTEXT] Registration successful, storing auth data');
        
        // Store auth data
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('authToken', token);
        Cookies.set('authToken', token, { expires: 7 }); // Set cookie for SSE
        
        setUser(user);
        return true;
      }
      console.log('[AUTH CONTEXT] Registration failed - success:false in response');
      // Clear any stale auth data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      Cookies.remove('authToken');
      setUser(null);
      return false;
    } catch (error: any) {
      console.error('[AUTH CONTEXT] Registration error:', error);
      console.error('[AUTH CONTEXT] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Clear any stale auth data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      Cookies.remove('authToken');
      setUser(null);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    Cookies.remove('authToken'); // Clear cookie for SSE
    localStorage.setItem('justLoggedOut', 'true');
    setUser(null);
  };

  const continueAsGuest = () => {
    const guestUser: User = {
      userId: 'guest',
      username: 'Guest User',
      email: '',
      isGuest: true,
    };
    
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};