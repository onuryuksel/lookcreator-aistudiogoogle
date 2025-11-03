import React from 'react';
import CreatorStudio from './pages/CreatorStudio';
import ViewLookboardPage from './pages/ViewLookboardPage';
import AuthPage from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import { Lookboard, Look, SharedLookboardInstance, LookOverrides } from './types';
import { Spinner } from './components/common';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';

interface ViewLookboardData {
    lookboard: Lookboard;
    looks: Look[];
    instance?: SharedLookboardInstance; // Instance is now optional
    overrides?: LookOverrides; // Overrides of the board creator
}

const AppContent: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [page, setPage] = React.useState<string>('/');
    const [viewData, setViewData] = React.useState<ViewLookboardData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { showToast } = useToast();

    React.useEffect(() => {
        const path = window.location.pathname;
        
        const loadData = async () => {
            setLoading(true);
            try {
                let apiUrl = '';
                // Handle new view-only public links
                if (path.startsWith('/board/public/')) {
                    const publicId = path.split('/board/public/')[1];
                    apiUrl = `/api/board/public/${publicId}`;
                // Handle personalized feedback links
                } else if (path.startsWith('/board/instance/')) {
                    const instanceId = path.split('/board/instance/')[1];
                    apiUrl = `/api/board/instance/${instanceId}`;
                }

                if (apiUrl) {
                    const response = await fetch(apiUrl);
                    if (!response.ok) {
                        throw new Error('Lookboard link is invalid or has expired.');
                    }
                    const data: ViewLookboardData = await response.json();
                    
                    if (data.lookboard && data.looks) {
                        setViewData(data);
                        setPage('board');
                    } else {
                        setPage('notfound');
                    }
                } else if (path === '/admin' && user?.role === 'admin') {
                    setPage('admin');
                } else if (user) {
                    setPage('creator');
                } else {
                    setPage('auth');
                }
            } catch (error) {
                console.error("Failed to load board data:", error);
                showToast(error instanceof Error ? error.message : "Could not load lookboard.", "error");
                setPage('notfound');
            } finally {
                setLoading(false);
            }
        };

        // Only load data once auth state is determined
        if (!authLoading) {
            loadData();
        }

    }, [user, authLoading, showToast]);

    const handleInstanceUpdate = async (updatedInstance: SharedLookboardInstance) => {
        if (!viewData?.instance) return;
        setViewData({ ...viewData, instance: updatedInstance }); // Optimistic UI update

        try {
            const response = await fetch('/api/board', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update-instance',
                    instanceId: updatedInstance.id,
                    feedbacks: updatedInstance.feedbacks,
                    comments: updatedInstance.comments,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save feedback.');
            }
            showToast('Feedback saved!', 'success');
        } catch (error) {
            console.error('Failed to update board instance:', error);
            showToast(error instanceof Error ? error.message : 'Could not save feedback.', 'error');
            // Revert optimistic update on failure
            setViewData(viewData); 
        }
    };


    if (loading || authLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
                <Spinner />
                <span className="ml-2">Loading...</span>
            </div>
        );
    }

    switch (page) {
        case 'creator':
            return <CreatorStudio />;
        case 'board':
            return viewData ? <ViewLookboardPage data={viewData} onUpdate={viewData.instance ? handleInstanceUpdate : undefined} /> : <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-lg">404 | Lookboard Not Found</div>;
        case 'notfound':
            return <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-lg">404 | Lookboard Not Found</div>;
        case 'admin':
            return <AdminPage />;
        case 'auth':
            return <AuthPage />;
        default:
            return <AuthPage />;
    }
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrandingProvider>
                    <AppContent />
                </BrandingProvider>
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;