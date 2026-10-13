import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiFetch, setAuthToken, removeAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (role: UserRole, formData: any) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      const res = await apiFetch('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        removeAuthToken();
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    };

    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    setLoading(true);
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });

    if (res.success && res.token && res.user) {
      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setLoading(false);
      return { success: true, user: res.user };
    }

    setLoading(false);
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = async (role: UserRole, formData: any) => {
    setLoading(true);
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ role, ...formData })
    });

    if (res.success && res.token && res.user) {
      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setLoading(false);
      return { success: true, user: res.user };
    }

    setLoading(false);
    return { success: false, error: res.error || 'Registration failed' };
  };

  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
