import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone_number: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  supervisor?: number | null;
  supervisor_name?: string | null;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAgent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('dishhome_token') || sessionStorage.getItem('dishhome_token');
    const savedUser = localStorage.getItem('dishhome_user') || sessionStorage.getItem('dishhome_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Verify with /auth/me/
        api.get('/auth/me/')
          .then((res) => {
            setUser(res.data);
            if (localStorage.getItem('dishhome_user')) {
              localStorage.setItem('dishhome_user', JSON.stringify(res.data));
            } else {
              sessionStorage.setItem('dishhome_user', JSON.stringify(res.data));
            }
          })
          .catch(() => {
            // Token expired or invalid
            logout();
          })
          .finally(() => {
            setIsLoading(false);
          });
        return;
      } catch (e) {
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<User> => {
    const res = await api.post('/auth/login/', { username, password });
    const { token: receivedToken, user: receivedUser } = res.data;

    setToken(receivedToken);
    setUser(receivedUser);

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('dishhome_token', receivedToken);
    storage.setItem('dishhome_user', JSON.stringify(receivedUser));

    return receivedUser;
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout/');
      }
    } catch (e) {
      // Ignore network error on logout
    } finally {
      localStorage.removeItem('dishhome_token');
      sessionStorage.removeItem('dishhome_token');
      localStorage.removeItem('dishhome_user');
      sessionStorage.removeItem('dishhome_user');
      setToken(null);
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  // Super Admin possesses full access rights of both Supervisor and Agent
  const isSupervisor = user?.role === 'SUPERVISOR' || isAdmin;
  const isAgent = user?.role === 'AGENT' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAdmin,
        isSupervisor,
        isAgent,
      }}
    >
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
