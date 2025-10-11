import React, { useEffect } from 'react';
import { CheckCircleIcon, XIcon } from './Icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const TOAST_CONFIG = {
  success: {
    icon: <CheckCircleIcon className="text-green-500 h-6 w-6" />,
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-green-400 dark:border-green-600',
    title: 'Success',
  },
  error: {
    icon: <XIcon className="text-red-500 h-6 w-6" />,
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-red-400 dark:border-red-600',
    title: 'Error',
  },
};

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Auto-dismiss after 4 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  const config = TOAST_CONFIG[type];

  // Keyframes are defined here to avoid needing a separate CSS file or post-processor.
  const animationStyle = `
    @keyframes fadeInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .animate-fade-in-right {
      animation: fadeInRight 0.3s ease-out forwards;
    }
  `;

  return (
    <div className={`w-full max-w-sm rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border-l-4 ${config.bg} ${config.border} animate-fade-in-right`}>
      <style>{animationStyle}</style>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {config.icon}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {config.title}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onClose}
              className="inline-flex rounded-md bg-transparent text-zinc-400 hover:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500"
            >
              <span className="sr-only">Close</span>
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
