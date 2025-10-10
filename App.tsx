import React, { useState, useEffect } from 'react';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import { WandSparklesIcon, BookOpenIcon, SunIcon, MoonIcon, DesktopIcon } from './components/Icons';
import { Look, Model } from './types';
import * as dbService from './services/dbService';


type Page = 'creator' | 'lookbook';
type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('creator');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  
  const [looks, setLooks] = useState<Look[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Data Loading ---
  const loadData = async () => {
      try {
        const loadedModels = await dbService.getAll<Model>('models');
        const loadedLooks = await dbService.getAll<Look>('looks');

        setModels(loadedModels);
        setLooks(loadedLooks.sort((a,b) => b.createdAt - a.createdAt));
      } catch (error) {
        console.error("Failed to load data from IndexedDB:", error);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    loadData();
  }, []);


  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (theme === 'system') {
            root.classList.toggle('dark', mediaQuery.matches);
        }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => {
        if (prevTheme === 'system') return 'light';
        if (prevTheme === 'light') return 'dark';
        return 'system'; // from 'dark' back to 'system'
    });
  };

  const getNextThemeName = () => {
    if (theme === 'system') return 'Light';
    if (theme === 'light') return 'Dark';
    return 'System';
  };

  const handleSaveLook = async (newLookData: Omit<Look, 'id'>) => {
    try {
        const newLookWithId = await dbService.add<Look>('looks', newLookData);
        setLooks(prevLooks => [newLookWithId, ...prevLooks].sort((a,b) => b.createdAt - a.createdAt));
        alert('Look saved to Lookbook!');
        setCurrentPage('lookbook');
    } catch (error) {
        console.error("Failed to save look:", error);
        alert("Error: Could not save look to the database.");
    }
  };

  const handleCreateModel = async (newModelData: Omit<Model, 'id'>) => {
    try {
        const newModelWithId = await dbService.add<Model>('models', newModelData);
        setModels(prevModels => [...prevModels, newModelWithId]);
        return newModelWithId;
    } catch (error) {
        console.error("Failed to create model:", error);
        alert("Error: Could not save model to the database.");
        throw error; // Re-throw to be caught by the form
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this model?')) {
        try {
            await dbService.remove('models', id);
            setModels(prevModels => prevModels.filter(model => model.id !== id));
        } catch (error) {
            console.error("Failed to delete model:", error);
            alert("Error: Could not delete model from the database.");
        }
    }
  };

  // --- START: EXPORT/IMPORT LOGIC ---
  const handleExport = async (storeName: 'models' | 'looks', fileName: string) => {
    try {
      const data = await dbService.getAll(storeName);
      if (data.length === 0) {
        alert(`There are no ${storeName} to export.`);
        return;
      }
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Failed to export ${storeName}:`, error);
      alert(`Error exporting ${storeName}.`);
    }
  };
  
  const handleImportLooks = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') throw new Error('File content is not readable.');
        const importedData = JSON.parse(content);
        if (!Array.isArray(importedData)) throw new Error('Invalid file format: Not an array.');
        
        // Basic validation of the first item
        const firstItem = importedData[0];
        if (!firstItem || typeof firstItem.finalImage !== 'string' || !Array.isArray(firstItem.products)) {
            throw new Error('Invalid file content: Data does not match look structure.');
        }

        const looksToSave = importedData.map(({ id, ...look }) => look); // Strip IDs
        await dbService.bulkAdd('looks', looksToSave);
        alert(`${looksToSave.length} looks imported successfully!`);
        await loadData(); // Reload all data to reflect changes
      } catch (error) {
        console.error('Failed to import looks:', error);
        alert(`Error importing looks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };
  // --- END: EXPORT/IMPORT LOGIC ---


  const renderPage = () => {
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><p>Loading data...</p></div>;
    }

    switch (currentPage) {
      case 'creator':
        return <CreatorStudio 
                  models={models} 
                  onLookSaved={handleSaveLook}
                  onModelCreated={handleCreateModel}
                  onModelDeleted={handleDeleteModel}
               />;
      case 'lookbook':
        return <Lookbook 
                  looks={looks} 
                  onLooksExport={() => handleExport('looks', 'looks.json')}
                  onLooksImport={handleImportLooks}
                />;
      default:
        return <CreatorStudio 
                  models={models} 
                  onLookSaved={handleSaveLook}
                  onModelCreated={handleCreateModel}
                  onModelDeleted={handleDeleteModel}
                />;
    }
  };

  const NavItem = ({ page, label, icon }: { page: Page; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setCurrentPage(page)}
      className={`flex flex-col items-center justify-center w-full py-4 transition-colors duration-200 group ${
        currentPage === page ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
      }`}
      aria-label={label}
    >
      {icon}
      <span className={`mt-2 text-xs font-semibold ${currentPage === page ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'}`}>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-zinc-100 dark:bg-zinc-900 font-sans">
      <aside className="w-20 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-4">
        <div className="h-16 flex items-center justify-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tighter">O/AI</h1>
        </div>
        <nav className="flex-grow w-full mt-8 space-y-4">
            <NavItem page="creator" label="Create" icon={<WandSparklesIcon />} />
            <NavItem page="lookbook" label="Lookbook" icon={<BookOpenIcon />} />
        </nav>
        <div className="mt-auto">
          <button
            onClick={handleThemeToggle}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={`Switch to ${getNextThemeName()} mode`}
            title={`Switch to ${getNextThemeName()} mode`}
          >
            {theme === 'light' && <SunIcon />}
            {theme === 'dark' && <MoonIcon />}
            {theme === 'system' && <DesktopIcon />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            {renderPage()}
        </div>
      </main>
    </div>
  );
};

export default App;