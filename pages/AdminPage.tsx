import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserStats } from '../types';
import { getPendingUsers, approveUser, declineUser, migrateLegacyLooks, reindexBoards, updateLogo, getUserStats } from '../services/authService';
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

const SortableHeader: React.FC<{
    label: string;
    sortKey: keyof UserStats | 'username';
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    requestSort: (key: keyof UserStats | 'username') => void;
}> = ({ label, sortKey, sortConfig, requestSort }) => {
    const isSorted = sortConfig?.key === sortKey;
    const directionIcon = isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '';
    return (
        <th onClick={() => requestSort(sortKey)} className="p-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {label} {directionIcon}
        </th>
    );
};


const UserStatsTable: React.FC = () => {
    const [stats, setStats] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof UserStats | 'username'; direction: 'asc' | 'desc' } | null>({ key: 'lastActivity', direction: 'desc' });

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const userStats = await getUserStats();
                setStats(userStats);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load user statistics.");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const requestSort = (key: keyof UserStats | 'username') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStats = useMemo(() => {
        let sortableItems = [...stats];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'username') {
                    aValue = a.user.username.toLowerCase();
                    bValue = b.user.username.toLowerCase();
                } else {
                    aValue = a[sortConfig.key as keyof UserStats];
                    bValue = b[sortConfig.key as keyof UserStats];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [stats, sortConfig]);

    if (loading) return <div className="flex items-center justify-center p-8"><Spinner /><span className="ml-2">Loading statistics...</span></div>;
    if (error) return <p className="text-red-500">{error}</p>;
    if (stats.length === 0) return <p className="text-zinc-500">No user data available to display statistics.</p>;
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                        <SortableHeader label="User" sortKey="username" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Status" sortKey={'user'} sortConfig={sortConfig} requestSort={() => requestSort('user')} />
                        <SortableHeader label="Joined" sortKey={'user'} sortConfig={sortConfig} requestSort={() => requestSort('user')} />
                        <SortableHeader label="Last Activity" sortKey="lastActivity" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Looks" sortKey="lookCount" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Products" sortKey="productCount" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Boards" sortKey="boardCount" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Videos" sortKey="videoCount" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Variations" sortKey="variationCount" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Looks/Board" sortKey="looksPerBoard" sortConfig={sortConfig} requestSort={requestSort} />
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {sortedStats.map(({ user, ...stat }) => (
                        <tr key={user.email}>
                            <td className="p-3 whitespace-nowrap">
                                <p className="font-semibold text-sm">{user.username}</p>
                                <p className="text-xs text-zinc-500">{user.email}</p>
                            </td>
                            <td className="p-3 whitespace-nowrap text-sm"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'}`}>{user.status}</span></td>
                            <td className="p-3 whitespace-nowrap text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                            <td className="p-3 whitespace-nowrap text-sm">{new Date(stat.lastActivity).toLocaleDateString()}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.lookCount}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.productCount}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.boardCount}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.videoCount}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.variationCount}</td>
                            <td className="p-3 whitespace-nowrap text-sm text-center">{stat.looksPerBoard.toFixed(1)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const AdminPage: React.FC = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingEmail, setProcessingEmail] = useState<string | null>(null);
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
        setProcessingEmail(email);
        try {
            await approveUser(email);
            showToast(`User ${email} has been approved.`, 'success');
            setPendingUsers(prev => prev.filter(u => u.email !== email));
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to approve user.', 'error');
        } finally {
            setProcessingEmail(null);
        }
    };
    
    const handleDecline = async (email: string) => {
        if (window.confirm(`Are you sure you want to decline and permanently delete the user ${email}? This action cannot be undone.`)) {
            setProcessingEmail(email);
            try {
                await declineUser(email);
                showToast(`User ${email} has been declined and deleted.`, 'success');
                setPendingUsers(prev => prev.filter(u => u.email !== email));
            } catch (err) {
                showToast(err instanceof Error ? err.message : 'Failed to decline user.', 'error');
            } finally {
                setProcessingEmail(null);
            }
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
        <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
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
                
                <div className="space-y-8">
                    <Card>
                        <h2 className="text-xl font-semibold mb-4">User Statistics</h2>
                        <UserStatsTable />
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => handleDecline(pUser.email)} disabled={processingEmail === pUser.email}>
                                                    {processingEmail === pUser.email ? <Spinner/> : 'Decline'}
                                                </Button>
                                                <Button onClick={() => handleApprove(pUser.email)} disabled={processingEmail === pUser.email}>
                                                    {processingEmail === pUser.email ? <Spinner/> : 'Approve'}
                                                </Button>
                                            </div>
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
        </div>
    );
};

export default AdminPage;