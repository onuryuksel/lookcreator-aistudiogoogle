import React from 'react';
import { Look, Lookboard } from '../types';
import LookboardCard from '../components/LookboardCard';

interface ViewLookboardPageProps {
  lookboard: Lookboard;
  looks: Look[];
  onUpdate: (updatedBoard: Lookboard) => void;
}

const ViewLookboardPage: React.FC<ViewLookboardPageProps> = ({ lookboard, looks, onUpdate }) => {

  const handleVote = (lookId: number, vote: 'liked' | 'disliked') => {
    // BUGFIX: Defensively check for `lookboard.feedbacks` to prevent a crash
    // if the object is from an older data structure. Default to an empty object.
    const newFeedbacks = { ...(lookboard.feedbacks || {}) };
    if (newFeedbacks[lookId] === vote) {
        delete newFeedbacks[lookId]; // Un-voting
    } else {
        newFeedbacks[lookId] = vote;
    }
    onUpdate({ ...lookboard, feedbacks: newFeedbacks });
  };

  const handleComment = (lookId: number, text: string) => {
    const newComment = {
      id: Date.now().toString(),
      author: 'client' as const,
      text,
      createdAt: Date.now(),
    };
    // BUGFIX: Defensively check for `lookboard.comments` to prevent a crash
    // if the object is from an older data structure. Default to an empty object.
    const newComments = { ...(lookboard.comments || {}) };
    if (!newComments[lookId]) {
        newComments[lookId] = [];
    }
    newComments[lookId].push(newComment);
    onUpdate({ ...lookboard, comments: newComments });
  };


  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">{lookboard.title}</h1>
          {lookboard.note && <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto">{lookboard.note}</p>}
        </header>

        <div 
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {looks.map(look => (
            <LookboardCard
              key={look.id}
              look={look}
              feedback={lookboard.feedbacks?.[look.id!] || null}
              comments={lookboard.comments?.[look.id!] || []}
              onVote={(vote) => handleVote(look.id!, vote)}
              onComment={(text) => handleComment(look.id!, text)}
            />
          ))}
        </div>
        
        <footer className="text-center mt-12 text-sm text-zinc-500">
            <p>Powered by Ounass AI Studio</p>
        </footer>
      </div>
    </div>
  );
};

export default ViewLookboardPage;