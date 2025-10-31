import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { User } from '../types';
import * as authService from '../services/authService';
import { useToast } from './ToastContext';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const fetchUser = useCallback(async () => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const loggedInUser = await authService.login(email, password);
            setUser(loggedInUser);
            localStorage.setItem('user', JSON.stringify(loggedInUser));
            showToast('Successfully logged in!', 'success');
             // Reload to redirect to the correct page
            window.location.href = '/';
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : 'Login failed', 'error');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signup = async (username: string, email: string, password: string) => {
        setLoading(true);
        try {
            await authService.signup(username, email, password);
            showToast('Signup successful! Please wait for admin approval.', 'success');
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : 'Signup failed', 'error');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        showToast('Logged out.', 'success');
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
