
import { Look, Model, Lookboard } from '../types';

// Since initialData.ts content is not provided, we will use empty arrays as a safe default.
// The app will start with no data unless it already exists in localStorage.
const INITIAL_MODELS: Model[] = [];
const INITIAL_LOOKS: Look[] = [];

// --- Generic DB Functions ---

/**
 * Saves data to localStorage under a specified key.
 * @param key The localStorage key.
 * @param data The data to save (will be JSON stringified).
 */
const saveToDb = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[DB Service] Failed to save ${key} to localStorage:`, error);
  }
};

/**
 * Loads data from localStorage.
 * @param key The localStorage key.
 * @param defaultValue The value to return if the key is not found or parsing fails.
 * @returns The parsed data or the default value.
 */
const loadFromDb = <T>(key:string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`[DB Service] Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};


// --- Models ---
const MODELS_KEY = 'ounass_ai_studio_models';

export const getModels = (): Model[] => {
  return loadFromDb<Model[]>(MODELS_KEY, INITIAL_MODELS);
};

export const saveModels = (models: Model[]): void => {
  saveToDb(MODELS_KEY, models);
};

export const addModel = async (modelData: Omit<Model, 'id'>): Promise<Model> => {
    const models = getModels();
    // Using a timestamp for a simple unique ID, sufficient for this application's scope.
    const newModel: Model = {
        ...modelData,
        id: Date.now(),
    };
    const updatedModels = [...models, newModel];
    saveModels(updatedModels);
    return newModel;
};

export const deleteModel = (modelId: number): void => {
    const models = getModels();
    const updatedModels = models.filter(m => m.id !== modelId);
    saveModels(updatedModels);
};


// --- Looks ---
const LOOKS_KEY = 'ounass_ai_studio_looks';

export const getLooks = (): Look[] => {
  return loadFromDb<Look[]>(LOOKS_KEY, INITIAL_LOOKS);
};

export const saveLooks = (looks: Look[]): void => {
  saveToDb(LOOKS_KEY, looks);
};

export const addLook = (lookData: Omit<Look, 'id'>): Look => {
    const looks = getLooks();
    const newLook: Look = {
        ...lookData,
        id: Date.now(),
    };
    // Prepend new looks so they appear at the top of the lookbook
    const updatedLooks = [newLook, ...looks];
    saveLooks(updatedLooks);
    return newLook;
};

export const updateLook = (updatedLook: Look): void => {
    const looks = getLooks();
    const updatedLooks = looks.map(l => l.id === updatedLook.id ? updatedLook : l);
    saveLooks(updatedLooks);
};

export const deleteLook = (lookId: number): void => {
    const looks = getLooks();
    const updatedLooks = looks.filter(l => l.id !== lookId);
    saveLooks(updatedLooks);
};


// --- Lookboards ---
const LOOKBOARDS_KEY = 'ounass_ai_studio_lookboards';

export const getLookboards = (): Lookboard[] => {
    return loadFromDb<Lookboard[]>(LOOKBOARDS_KEY, []);
};

export const saveLookboards = (boards: Lookboard[]): void => {
    saveToDb(LOOKBOARDS_KEY, boards);
};

export const addLookboard = (boardData: Omit<Lookboard, 'id'>): Lookboard => {
    const boards = getLookboards();
    const newBoard: Lookboard = {
        ...boardData,
        id: Date.now(),
    };
    const updatedBoards = [newBoard, ...boards];
    saveLookboards(updatedBoards);
    return newBoard;
};

export const updateLookboard = (updatedBoard: Lookboard): void => {
    const boards = getLookboards();
    const updatedBoards = boards.map(b => b.id === updatedBoard.id ? updatedBoard : b);
    saveLookboards(updatedBoards);
};

export const deleteLookboard = (boardId: number): void => {
    const boards = getLookboards();
    const updatedBoards = boards.filter(b => b.id !== boardId);
    saveLookboards(updatedBoards);
};

export const findLookboardByPublicId = (publicId: string): Lookboard | undefined => {
    const boards = getLookboards();
    return boards.find(b => b.publicId === publicId);
};
