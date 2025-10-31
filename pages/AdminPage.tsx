import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { getPendingUsers, approveUser, migrateLegacyLooks, reindexBoards, updateLogo } from '../services/authService';
import { Card, Button, Spinner } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useBranding } from '../contexts/BrandingContext';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const AdminPage: React.FC = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const { logoUrl: currentLogo } = useBranding();

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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
            setPendingUsers(prev => prev.filter(u => u.email !== email));
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to approve user.', 'error');
        }
    };

    const handleMigrate = async () => {
        if (!window.confirm('Are you sure you want to migrate all legacy looks to public? This will assign them to the admin user.')) return;
        setIsMigrating(true);
        setError(null);
        try {
            const result = await migrateLegacyLooks();
            showToast(result.message, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to migrate looks.';
            showToast(errorMessage, 'error');
            setError(errorMessage);
        } finally {
            setIsMigrating(false);
        }
    };
    
    const handleReindex = async () => {
        if (!window.confirm('This will scan all lookboards and create a fast-access index for share links. This is safe to run multiple times. Continue?')) return;
        setIsIndexing(true);
        setError(null);
        try {
            const result = await reindexBoards();
            showToast(result.message, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to re-index boards.';
            showToast(errorMessage, 'error');
            setError(errorMessage);
        } finally {
            setIsIndexing(false);
        }
    };

    const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 100) { // 100KB limit
                showToast("Logo image must be under 100KB.", "error");
                return;
            }
            const base64 = await fileToBase64(file);
            setLogoPreview(base64);
        }
    };
    
    const handleSaveLogo = async () => {
        if (!logoPreview) return;
        setIsUploadingLogo(true);
        try {
            await updateLogo(logoPreview);
            showToast("Logo updated successfully! Changes will appear on next page load.", "success");
            setLogoPreview(null); 
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to update logo.", "error");
        } finally {
            setIsUploadingLogo(false);
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
                        <p className="text-zinc-600 dark:text-zinc-400">Manage new user signups and data.</p>
                    </div>
                     <div>
                        <Button variant="secondary" onClick={() => window.location.href = '/'}>Back to Studio</Button>
                        <Button variant="secondary" onClick={logout} className="ml-2">Logout</Button>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <div className="space-y-3 max-h-96 overflow-y-auto">
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
                    <div className="space-y-6">
                         <Card>
                            <h2 className="text-xl font-semibold mb-2">Branding Settings</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Upload a logo to be displayed on shared lookboard pages. (Recommended: PNG, under 100KB)
                            </p>
                            <div className="flex items-center gap-4">
                                <p className="text-sm font-medium">Current Logo:</p>
                                <div className="p-2 border rounded-md bg-zinc-50 dark:bg-zinc-800">
                                   {currentLogo ? <img src={currentLogo} alt="Current Logo" className="h-8" /> : 'Default'}
                                </div>
                            </div>
                            {logoPreview && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">New Logo Preview:</p>
                                    <div className="p-2 border rounded-md bg-zinc-50 dark:bg-zinc-800 inline-block">
                                        <img src={logoPreview} alt="New Logo Preview" className="h-8" />
                                    </div>
                                </div>
                            )}
                            <div className="mt-4 flex items-center gap-2">
                                <input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoFileChange} id="logo-upload" className="sr-only"/>
                                <Button as="label" htmlFor="logo-upload" variant="secondary">Choose File</Button>
                                <Button onClick={handleSaveLogo} disabled={!logoPreview || isUploadingLogo}>
                                    {isUploadingLogo && <Spinner />}
                                    {isUploadingLogo ? 'Saving...' : 'Save Logo'}
                                </Button>
                            </div>
                        </Card>
                        <Card>
                            <h2 className="text-xl font-semibold mb-2">Data Indexing</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                If old share links are not working, run this process to create a fast-access index for all lookboards.
                            </p>
                            <Button onClick={handleReindex} disabled={isIndexing}>
                                {isIndexing && <Spinner />}
                                {isIndexing ? 'Indexing...' : 'Re-index Share Links'}
                            </Button>
                        </Card>
                         <Card>
                            <h2 className="text-xl font-semibold mb-2">Data Migration</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                This will find all older looks (created before the public/private feature) and convert them to public looks assigned to the admin user. This process is safe to run multiple times.
                            </p>
                            <Button onClick={handleMigrate} disabled={isMigrating}>
                                {isMigrating && <Spinner />}
                                {isMigrating ? 'Migrating...' : 'Migrate Old Looks to Public'}
                            </Button>
                        </Card>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminPage;