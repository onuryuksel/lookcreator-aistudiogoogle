import React, { useState } from 'react';
import { Card } from '../components/common';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignupForm';

const AuthPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-6 text-zinc-900 dark:text-zinc-100">
                    Ounass Look Creator
                </h1>
                <Card>
                    <div className="border-b border-zinc-200 dark:border-zinc-700 mb-6">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('login')}
                                className={`${activeTab === 'login' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm w-1/2 text-center`}
                            >
                                Login
                            </button>
                            <button
                                onClick={() => setActiveTab('signup')}
                                className={`${activeTab === 'signup' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm w-1/2 text-center`}
                            >
                                Sign Up
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'login' ? <LoginForm /> : <SignupForm />}
                </Card>
                 <p className="text-xs text-zinc-500 text-center mt-4">
                    NOTE: This is a demonstration. For security reasons in this environment, passwords are not encrypted. Do not use a real password.
                </p>
            </div>
        </div>
    );
};

export default AuthPage;
