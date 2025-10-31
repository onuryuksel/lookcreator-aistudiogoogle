import React from 'react';
import { Look, Lookboard, SharedLookboardInstance } from '../types';
import LookboardCard from '../components/LookboardCard';

interface ViewLookboardData {
    lookboard: Lookboard;
    looks: Look[];
    instance?: SharedLookboardInstance; // Instance is now optional for view-only mode
}

interface ViewLookboardPageProps {
  data: ViewLookboardData;
  onUpdate?: (updatedInstance: SharedLookboardInstance) => void; // onUpdate is also optional
}

const ViewLookboardPage: React.FC<ViewLookboardPageProps> = ({ data, onUpdate }) => {
  const { lookboard, looks, instance } = data;
  const isFeedbackEnabled = !!instance && !!onUpdate;

  const handleVote = (lookId: number, vote: 'liked' | 'disliked') => {
    if (!isFeedbackEnabled) return;
    const newFeedbacks = { ...(instance.feedbacks || {}) };
    if (newFeedbacks[lookId] === vote) {
        delete newFeedbacks[lookId];
    } else {
        newFeedbacks[lookId] = vote;
    }
    onUpdate({ ...instance, feedbacks: newFeedbacks });
  };

  const handleComment = (lookId: number, text: string) => {
    if (!isFeedbackEnabled) return;
    const newComment = {
      id: Date.now().toString(),
      author: 'client' as const,
      text,
      createdAt: Date.now(),
    };
    const newComments = { ...(instance.comments || {}) };
    if (!newComments[lookId]) {
        newComments[lookId] = [];
    }
    newComments[lookId].push(newComment);
    onUpdate({ ...instance, comments: newComments });
  };


  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="py-6 border-b border-zinc-200 dark:border-zinc-800 mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl font-bold text-center tracking-tight text-zinc-800 dark:text-zinc-200">OUNASS</h1>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-1">AI Studio</p>
        </header>
        
        <main>
            <div className="text-center mb-10">
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 mb-2">
                A lookboard curated by <span className="font-semibold">{lookboard.createdByUsername}</span>
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{lookboard.title}</h2>
              {lookboard.note && <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mt-4">{lookboard.note}</p>}
            </div>

            {looks.length > 0 ? (
                <div 
                    className="grid gap-4 sm:gap-6"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
                >
                    {looks.map(look => (
                        <LookboardCard
                          key={look.id}
                          look={look}
                          // Only pass feedback props if feedback is enabled
                          feedback={isFeedbackEnabled ? instance.feedbacks?.[look.id!] || null : undefined}
                          comments={isFeedbackEnabled ? instance.comments?.[look.id!] || [] : undefined}
                          onVote={isFeedbackEnabled ? (vote) => handleVote(look.id!, vote) : undefined}
                          onComment={isFeedbackEnabled ? (text) => handleComment(look.id!, text) : undefined}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 border border-dashed rounded-lg">
                     <p className="text-lg text-zinc-600 dark:text-zinc-400">This lookboard is empty.</p>
                </div>
            )}
        </main>
        
        <footer className="text-center mt-16 py-6 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
                &copy; {new Date().getFullYear()} Ounass. All Rights Reserved. Powered by AI Studio.
            </p>
        </footer>
      </div>
    </div>
  );
};

export default ViewLookboardPage;