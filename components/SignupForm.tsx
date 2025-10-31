import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Spinner } from './common';

const SignupForm: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSignedUp, setIsSignedUp] = useState(false);
    const { signup, loading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await signup(username, email, password);
            setIsSignedUp(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };

    if (isSignedUp) {
        return (
            <div className="text-center p-4">
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">Thank you for signing up!</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">Your account has been created and is now awaiting approval from an administrator. You will be able to log in once your account is approved.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner /> : 'Create Account'}
            </Button>
        </form>
    );
};

export default SignupForm;
