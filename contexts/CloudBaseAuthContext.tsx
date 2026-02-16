import React, { createContext, useContext, useEffect, useState } from 'react';
import { customAuth, isCloudBaseConfigured } from '../lib/cloudbase';

interface User {
  uid: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (username: string, password: string) => Promise<{ error: any }>;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const CloudBaseAuthContext = createContext<AuthContextType | undefined>(undefined);

export const useCloudBaseAuth = () => {
  const context = useContext(CloudBaseAuthContext);
  if (!context) {
    throw new Error('useCloudBaseAuth must be used within a CloudBaseAuthProvider');
  }
  return context;
};

export const CloudBaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isCloudBaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Check initial login state
    customAuth.getCurrentUser().then((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting login state:', error);
      setLoading(false);
    });
  }, [isConfigured]);

  const signUp = async (username: string, password: string) => {
    if (!isConfigured) {
      return { error: { message: 'CloudBase not configured' } };
    }

    try {
      const result = await customAuth.signUp(username, password);
      setUser({ uid: result.userId, username: result.username });
      return { error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error: { message: error.message || '注册失败' } };
    }
  };

  const signIn = async (username: string, password: string) => {
    if (!isConfigured) {
      return { error: { message: 'CloudBase not configured' } };
    }

    try {
      const result = await customAuth.signIn(username, password);
      setUser({ uid: result.userId, username: result.username });
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: { message: error.message || '登录失败' } };
    }
  };

  const signOut = async () => {
    if (!isConfigured) return;

    try {
      await customAuth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    isConfigured,
  };

  return <CloudBaseAuthContext.Provider value={value}>{children}</CloudBaseAuthContext.Provider>;
};
