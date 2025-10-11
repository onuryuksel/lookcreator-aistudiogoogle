
import { Model, Look, Lookboard } from '../types';

const DB_PREFIX = 'ounass-ai-studio:';
const MODELS_KEY = `${DB_PREFIX}models`;
const LOOKS_KEY = `${DB_PREFIX}looks`;
const LOOKBOARDS_KEY = `${DB_PREFIX}lookboards`;

const get = async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`[DB Service] Error getting item for key ${key}:`, error);
        return defaultValue;
    }
};

const set = async <T>(key: string, value: T): Promise<void> => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`[DB Service] Error setting item for key ${key}:`, error);
    }
};

// --- Models ---
export const getModels = (): Promise<Model[]> => get(MODELS_KEY, []);
export const saveModels = (models: Model[]): Promise<void> => set(MODELS_KEY, models);

// --- Looks ---
export const getLooks = (): Promise<Look[]> => get(LOOKS_KEY, []);
export const saveLooks = (looks: Look[]): Promise<void> => set(LOOKS_KEY, looks);

// --- Lookboards ---
export const getLookboards = (): Promise<Lookboard[]> => get(LOOKBOARDS_KEY, []);
export const saveLookboards = (lookboards: Lookboard[]): Promise<void> => set(LOOKBOARDS_KEY, lookboards);

// Helper for generating a simple unique ID
export const generateId = (): number => Date.now() + Math.floor(Math.random() * 1000);
