'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const authenticated = auth.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          // First, try to get user from sessionStorage immediately (synchronous)
          let cachedUser = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
          let needsApiFetch = true;

          if (cachedUser) {
            try {
              const parsedUser = JSON.parse(cachedUser);
              setUser(parsedUser);
              // If can_create_modules is already present, skip API fetch for speed
              if (parsedUser.can_create_modules != null) {
                needsApiFetch = false;
              }
            } catch (e) {
              sessionStorage.removeItem('user');
              cachedUser = null;
            }
          }

          // If no cached user, try to get from token
          if (!cachedUser) {
            const tokenUser = auth.getUserFromToken();
            if (tokenUser) {
              setUser(tokenUser);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('user', JSON.stringify(tokenUser));
              }
            }
          }

          // Fetch fresh user data from API to get all fields (e.g. can_create_modules)
          if (needsApiFetch) {
            const token = auth.getToken();
            if (token) {
              try {
                const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
                const resp = await fetch(`${API_BASE}/api/auth/me`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (resp.ok) {
                  const userData = await resp.json();
                  setUser(userData);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('user', JSON.stringify(userData));
                  }
                }
              } catch {
                // Silently fall back to cached user
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (identifier, password) => {
    try {
      const result = await auth.login(identifier, password);
      console.log('🔐 Login successful, setting user:', result.user);
      setUser(result.user);
      setIsAuthenticated(true);
      console.log('✅ User state updated in AuthContext');
      return result;
    } catch (error) {
      console.error('❌ Login failed:', error);
      setIsAuthenticated(false);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      return await auth.register(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    // Use Next.js router for better UX
    router.push('/');
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  const requestPasswordReset = async (email) => {
    try {
      return await auth.requestPasswordReset(email);
    } catch (error) {
      throw error;
    }
  };

  const verifyResetCode = async (email, code) => {
    try {
      return await auth.verifyResetCode(email, code);
    } catch (error) {
      throw error;
    }
  };

  const verifyResetToken = async (token) => {
    try {
      return await auth.verifyResetToken(token);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      return await auth.resetPassword(email, code, newPassword);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    updateUser,
    requestPasswordReset,
    verifyResetCode,
    verifyResetToken,
    resetPassword,
    loading,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};