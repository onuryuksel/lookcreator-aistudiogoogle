import React, { useState } from 'react';
import { Look, Comment } from '../types';
import { Card, Button } from './common';
import { ThumbsUpIcon, ThumbsDownIcon, MessageSquareIcon } from './Icons';

interface LookboardCardProps {
  look: Look;
  feedback?: 'liked' | 'disliked' | null;
  comments?: Comment[];
  onVote?: (vote: 'liked' | 'disliked') => void;
  onComment?: (text: string) => void;
}

const LookboardCard: React.FC<LookboardCardProps> = ({ look, feedback, comments, onVote, onComment }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const isFeedbackEnabled = typeof onVote === 'function' && typeof onComment === 'function' && comments !== undefined;

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim() && isFeedbackEnabled) {
      onComment(commentText.trim());
      setCommentText('');
    }
  };

  return (
    <Card className="p-0 flex flex-col">
      <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-t-lg overflow-hidden">
        <img src={look.finalImage} alt="Look" className="w-full h-full object-contain" />
      </div>
      
      {isFeedbackEnabled && (
        <div className="p-4 flex-grow flex flex-col">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onVote('liked')}
              className={`flex items-center gap-1.5 p-2 rounded-full transition-colors ${feedback === 'liked' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <ThumbsUpIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">Like</span>
            </button>
            <button 
              onClick={() => onVote('disliked')}
              className={`flex items-center gap-1.5 p-2 rounded-full transition-colors ${feedback === 'disliked' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <ThumbsDownIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">Dislike</span>
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 p-2 rounded-full ml-auto transition-colors ${showComments ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <MessageSquareIcon />
              <span className="text-sm font-semibold">{comments.length > 0 ? comments.length : 'Comment'}</span>
            </button>
          </div>
          
          {showComments && (
            <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {comments.length === 0 && <p className="text-xs text-zinc-500">No comments yet.</p>}
                  {comments.map(comment => (
                      <div key={comment.id} className={`flex ${comment.author === 'client' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-2 rounded-lg max-w-[80%] ${comment.author === 'client' ? 'bg-blue-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                            <p className="text-sm">{comment.text}</p>
                          </div>
                      </div>
                  ))}
              </div>
              <form onSubmit={handleCommentSubmit} className="mt-3 flex gap-2">
                  <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-grow w-full px-3 py-1.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
                  />
                  <Button type="submit" disabled={!commentText.trim()}>Send</Button>
              </form>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default LookboardCard;