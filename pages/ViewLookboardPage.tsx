import React, { useState, useRef, useEffect } from 'react';
import { Look, Lookboard, SharedLookboardInstance, Comment } from '../types';
import LookboardCard from '../components/LookboardCard';
import { Modal, Button } from '../components/common';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import OunassLogo from '../components/OunassLogo';

interface ViewLookboardData {
    lookboard: Lookboard;
    looks: Look[];
    instance?: SharedLookboardInstance;
}

interface ViewLookboardPageProps {
  data: ViewLookboardData;
  onUpdate?: (updatedInstance: SharedLookboardInstance) => void;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  look: Look;
  comments: Comment[];
  onAddComment: (commentText: string) => void;
  stylistName: string;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ isOpen, onClose, look, comments, onAddComment, stylistName }) => {
    const [newComment, setNewComment] = useState('');
    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(isOpen) {
            setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    }, [isOpen, comments]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddComment(newComment);
        setNewComment('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Feedback for Look`}>
            <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2">
                    <img src={look.finalImage} alt="Look" className="w-full h-auto object-contain rounded-lg" />
                </div>
                <div className="md:w-1/2 flex flex-col max-h-[70vh]">
                    <h3 className="text-lg font-bold mb-4 flex-shrink-0">Conversation</h3>
                    <div className="flex-grow space-y-4 overflow-y-auto pr-2 -mr-2 mb-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-md">
                        {comments.length === 0 ? (
                            <p className="text-zinc-500 text-sm text-center py-8">No comments yet. Be the first to leave feedback!</p>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className={`flex flex-col ${comment.author === 'client' ? 'items-end' : 'items-start'}`}>
                                    <div className={`rounded-lg px-3 py-2 max-w-sm ${comment.author === 'client' ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                                        <p className="text-sm">{comment.text}</p>
                                    </div>
                                    <span className="text-xs text-zinc-500 mt-1">
                                        {comment.author === 'client' ? 'You' : stylistName} • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={commentsEndRef} />
                    </div>
                    <form onSubmit={handleSubmit} className="mt-auto flex gap-2 flex-shrink-0">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add your comment..."
                            className="flex-grow w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
                        />
                        <Button type="submit" disabled={!newComment.trim()}>Send</Button>
                    </form>
                </div>
            </div>
        </Modal>
    );
};

const ViewLookboardPage: React.FC<ViewLookboardPageProps> = ({ data, onUpdate }) => {
  const { lookboard, looks, instance } = data;
  const isFeedbackEnabled = !!instance && !!onUpdate;
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);
  const [lookForComments, setLookForComments] = useState<Look | null>(null);

  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(false);


  const handleProductScroll = () => {
    if (productsScrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = productsScrollContainerRef.current;
      const isScrollable = scrollWidth > clientWidth;
      setShowProductLeftArrow(scrollLeft > 0);
      setShowProductRightArrow(isScrollable && scrollLeft < scrollWidth - clientWidth - 1);
    }
  };
  
  const scrollProducts = (direction: 'left' | 'right') => {
    if (productsScrollContainerRef.current) {
        const scrollAmount = productsScrollContainerRef.current.clientWidth * 0.8;
        productsScrollContainerRef.current.scrollBy({ 
            left: direction === 'left' ? -scrollAmount : scrollAmount, 
            behavior: 'smooth' 
        });
    }
  };

  const handleFeedback = (lookId: number, feedback: 'liked' | 'disliked') => {
    if (!instance || !onUpdate) return;
    
    const currentFeedback = instance.feedbacks[lookId];
    const newFeedbacks = { ...instance.feedbacks };
    
    if (currentFeedback === feedback) {
        delete newFeedbacks[lookId]; // Toggle off
    } else {
        newFeedbacks[lookId] = feedback;
    }
    
    onUpdate({ ...instance, feedbacks: newFeedbacks });
  };
  
  const handleAddComment = (lookId: number, commentText: string) => {
    if (!instance || !onUpdate || !commentText.trim()) return;

    const newComment: Comment = {
        id: crypto.randomUUID(),
        author: 'client', // The person viewing the shared link is the client
        text: commentText.trim(),
        createdAt: Date.now(),
    };

    const newComments = { ...instance.comments };
    const lookComments = newComments[lookId] || [];
    newComments[lookId] = [...lookComments, newComment];

    onUpdate({ ...instance, comments: newComments });
  };


  useEffect(() => {
    if (selectedLook) {
      setTimeout(() => {
        handleProductScroll();
        const container = productsScrollContainerRef.current;
        if (container) {
          container.addEventListener('scroll', handleProductScroll);
          window.addEventListener('resize', handleProductScroll);
          return () => {
            container.removeEventListener('scroll', handleProductScroll);
            window.removeEventListener('resize', handleProductScroll);
          }
        }
      }, 100);
    }
  }, [selectedLook]);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="py-6 mb-4">
            <OunassLogo className="h-32 mx-auto" />
        </header>
        
        <main>
            <div className="text-center mb-10">
              <h2 
                className='text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100'
              >
                {lookboard.title}
              </h2>
              {lookboard.note && <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mt-4">{lookboard.note}</p>}
            </div>

            {looks.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {looks.map((look) => (
                        <LookboardCard
                          key={look.id}
                          look={look}
                          onImageClick={() => setSelectedLook(look)}
                          isFeedbackEnabled={isFeedbackEnabled}
                          feedback={instance?.feedbacks[look.id]}
                          onFeedback={(feedbackType) => handleFeedback(look.id, feedbackType)}
                          onOpenComments={() => setLookForComments(look)}
                          commentCount={instance?.comments[look.id]?.length || 0}
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                A lookboard curated by <span className="font-semibold text-zinc-600 dark:text-zinc-400">{lookboard.createdByUsername}</span>
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
                &copy; {new Date().getFullYear()} Ounass. All Rights Reserved.
            </p>
        </footer>
      </div>
      {selectedLook && (
            <Modal
                isOpen={!!selectedLook}
                onClose={() => setSelectedLook(null)}
                title={`Products in Look`}
            >
                <div>
                    <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-6">
                        <div className="bg-zinc-100 dark:bg-zinc-800 sm:rounded-t-lg flex justify-center items-center min-h-[300px]">
                            <img src={selectedLook.finalImage} alt="Look" className="max-w-full max-h-[60vh] object-contain" />
                        </div>
                    </div>
                    <div>
                         <h3 className="text-lg font-bold mb-4">Products ({selectedLook.products.length})</h3>
                         {selectedLook.products.length > 0 ? (
                            <div className="relative">
                                {showProductLeftArrow && (
                                    <button onClick={() => scrollProducts('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                                        <ChevronLeftIcon />
                                    </button>
                                )}
                                <div ref={productsScrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                                    {selectedLook.products.map(product => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                                {showProductRightArrow && (
                                    <button onClick={() => scrollProducts('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                                        <ChevronRightIcon />
                                    </button>
                                )}
                            </div>
                         ) : (
                            <p className="text-zinc-500">No products are associated with this look.</p>
                         )}
                    </div>
                </div>
            </Modal>
        )}
        {lookForComments && instance && (
            <CommentsModal
                isOpen={!!lookForComments}
                onClose={() => setLookForComments(null)}
                look={lookForComments}
                comments={instance.comments[lookForComments.id] || []}
                onAddComment={(commentText) => handleAddComment(lookForComments.id, commentText)}
                stylistName={lookboard.createdByUsername}
            />
        )}
    </div>
  );
};

export default ViewLookboardPage;