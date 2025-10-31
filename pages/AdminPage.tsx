import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { getPendingUsers, approveUser } from '../services/authService';
import { Card, Button, Spinner } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const AdminPage: React.FC = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, logout } = useAuth();
    const { showToast } = useToast();

    const fetchPendingUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const users = await getPendingUsers();
            setPendingUsers(users);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingUsers();
    }, [fetchPendingUsers]);

    const handleApprove = async (email: string) => {
        try {
            await approveUser(email);
            showToast(`User ${email} has been approved.`, 'success');
            // Refresh the list
            setPendingUsers(prev => prev.filter(u => u.email !== email));
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to approve user.', 'error');
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <p>Access Denied. You must be an admin to view this page.</p>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Admin Panel</h1>
                        <p className="text-zinc-600 dark:text-zinc-400">Manage new user signups.</p>
                    </div>
                     <div>
                        <Button variant="secondary" onClick={() => window.location.href = '/'}>Back to Studio</Button>
                        <Button variant="secondary" onClick={logout} className="ml-2">Logout</Button>
                    </div>
                </header>
                
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Pending Approvals</h2>
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Spinner />
                            <span className="ml-2">Loading users...</span>
                        </div>
                    ) : error ? (
                        <p className="text-red-500">{error}</p>
                    ) : pendingUsers.length === 0 ? (
                        <p className="text-zinc-500">No users are currently awaiting approval.</p>
                    ) : (
                        <div className="space-y-3">
                            {pendingUsers.map(pUser => (
                                <div key={pUser.email} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                                    <div>
                                        <p className="font-semibold">{pUser.username}</p>
                                        <p className="text-sm text-zinc-500">{pUser.email}</p>
                                        <p className="text-xs text-zinc-400">Signed up: {new Date(pUser.createdAt).toLocaleString()}</p>
                                    </div>
                                    <Button onClick={() => handleApprove(pUser.email)}>
                                        Approve
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default AdminPage;
