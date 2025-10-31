import React, { ChangeEvent, ReactNode, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XIcon } from './Icons';

// Card
// FIX: Update CardProps to extend React.HTMLAttributes<HTMLDivElement> to allow passing standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}
export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div className={`bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 ${className}`} {...props}>
    {children}
  </div>
);


// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}
export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
  const baseClasses = "px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";
  const variantClasses = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-700 focus:ring-zinc-500 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-400',
    secondary: 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus:ring-zinc-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const finalClassName = `${baseClasses} ${variantClasses[variant]} ${className || ''}`.trim();

  return (
    <button className={finalClassName} {...props}>
      {children}
    </button>
  );
};

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input: React.FC<InputProps> = (props) => (
  <input
    className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
    {...props}
  />
);

// FileUploader
interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  label: string;
}
export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, label }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };
  return (
    <div className="w-full">
      <label className="block w-full cursor-pointer bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center hover:bg-zinc-200 transition-colors">
        <span className="text-zinc-600">{label}</span>
        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
      </label>
    </div>
  );
};

// Spinner
export const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
);

// Modal
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Add/remove class to body to prevent scrolling when modal is open
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
        return () => {
            setIsMounted(false);
            document.body.classList.remove('overflow-hidden');
        };
    }, [isOpen]);

    if (!isOpen || !isMounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-0 sm:p-4 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-4xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                    <h2 id="modal-title" className="text-xl font-bold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                        aria-label="Close modal"
                    >
                        <XIcon />
                    </button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(
        modalContent,
        document.body
    );
};


// Dropdown Menu
interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
}
export const Dropdown: React.FC<DropdownProps> = ({ trigger, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTriggerClick = () => {
    setIsOpen(prev => !prev);
  }
  
  const handleItemClick = () => {
    setIsOpen(false);
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5 dark:ring-zinc-700 focus:outline-none z-50">
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
             {React.Children.map(children, child =>
                React.isValidElement(child)
                  ? React.cloneElement(child, {
                      // @ts-ignore
                      onClick: () => {
                        // FIX: Cast `child.props` to `any` to safely access `onClick`.
                        // The `props` on a generic React child are typed as `unknown` in strict mode,
                        // preventing property access without a type assertion. We also add a `typeof`
                        // check to ensure we only call it if it's a function.
                        const originalOnClick = (child.props as any).onClick;
                        if (typeof originalOnClick === 'function') {
                          originalOnClick();
                        }
                        handleItemClick();
                      },
                    })
                  : child
              )}
          </div>
        </div>
      )}
    </div>
  );
};


// Dropdown Menu Item
// FIX: Extended DropdownItemProps to include all standard button attributes (like `disabled`)
// and updated the component to pass them through. Also added disabled styles.
interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
}
export const DropdownItem: React.FC<DropdownItemProps> = ({ children, className, ...props }) => (
    <button
        {...props}
        className={`w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`.trim()}
        role="menuitem"
    >
        {children}
    </button>
);