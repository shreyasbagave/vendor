import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiClient, LoginResponse } from '../api';

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
    lastLogin?: string;
};

type AuthContextValue = {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    api: ApiClient;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'stock_app_token';
const USER_STORAGE_KEY = 'stock_app_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
    const [user, setUser] = useState<User | null>(() => {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        return raw ? JSON.parse(raw) as User : null;
    });

    const getToken = useCallback(() => token, [token]);
    const api = useMemo(() => new ApiClient(getToken), [getToken]);

    useEffect(() => {
        if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token); else localStorage.removeItem(TOKEN_STORAGE_KEY);
    }, [token]);

    useEffect(() => {
        if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_STORAGE_KEY);
    }, [user]);

    const login = useCallback(async (username: string, password: string) => {
        const res = await api.post<LoginResponse>('/auth/login', { username, password });
        if (res.data?.success && res.data.data?.token && res.data.data.user) {
            setToken(res.data.data.token);
            setUser(res.data.data.user);
            return;
        }
        throw new Error(res.data?.message || 'Login failed');
    }, [api]);

    const register = useCallback(async (username: string, email: string, password: string) => {
        const res = await api.post<LoginResponse>('/auth/register', { username, email, password });
        if (res.data?.success && res.data.data?.token && res.data.data.user) {
            setToken(res.data.data.token);
            setUser(res.data.data.user);
            return;
        }
        throw new Error(res.data?.message || 'Registration failed');
    }, [api]);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const value: AuthContextValue = useMemo(() => ({
        user,
        token,
        isAuthenticated: Boolean(token),
        login,
        register,
        logout,
        api,
    }), [user, token, login, register, logout, api]);

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};


