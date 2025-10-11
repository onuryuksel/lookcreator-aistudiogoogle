import { openDB, DBSchema } from 'idb';
import { Model, Look, Lookboard } from '../types';

const DB_NAME = 'OunassAIStudioDB';
const DB_VERSION = 1;
const STORES = {
  MODELS: 'models',
  LOOKS: 'looks',
  LOOKBOARDS: 'lookboards',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

interface OunassStudioDB extends DBSchema {
  [STORES.MODELS]: {
    key: number;
    value: Model;
  };
  [STORES.LOOKS]: {
    key: number;
    value: Look;
  };
  [STORES.LOOKBOARDS]: {
    key: number;
    value: Lookboard;
  };
}

const dbPromise = openDB<OunassStudioDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORES.MODELS)) {
      db.createObjectStore(STORES.MODELS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORES.LOOKS)) {
      db.createObjectStore(STORES.LOOKS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORES.LOOKBOARDS)) {
      db.createObjectStore(STORES.LOOKBOARDS, { keyPath: 'id' });
    }
  },
});

const getAll = async <T>(storeName: StoreName): Promise<T[]> => {
  try {
    return (await dbPromise).getAll(storeName);
  } catch (error) {
    console.error(`[DB Service] Error getting all items from ${storeName}:`, error);
    return [];
  }
};

const saveAll = async <T extends { id: number }>(storeName: StoreName, data: T[]): Promise<void> => {
  try {
    const tx = (await dbPromise).transaction(storeName, 'readwrite');
    // Clear the store first, then put all new items. This mimics the previous "overwrite" behavior.
    await tx.store.clear(); 
    await Promise.all(data.map(item => tx.store.put(item)));
    return tx.done;
  } catch (error) {
    console.error(`[DB Service] Error saving all items to ${storeName}:`, error);
  }
};

const clearAll = async (storeName: StoreName): Promise<void> => {
    try {
        const tx = (await dbPromise).transaction(storeName, 'readwrite');
        await tx.store.clear();
        return tx.done;
    } catch (error) {
        console.error(`[DB Service] Error clearing store ${storeName}:`, error);
    }
}

// --- Models ---
export const getModels = (): Promise<Model[]> => getAll<Model>(STORES.MODELS);
export const saveModels = (models: Model[]): Promise<void> => saveAll(STORES.MODELS, models);
export const clearModels = (): Promise<void> => clearAll(STORES.MODELS);

// --- Looks ---
export const getLooks = (): Promise<Look[]> => getAll<Look>(STORES.LOOKS);
export const saveLooks = (looks: Look[]): Promise<void> => saveAll(STORES.LOOKS, looks);
export const clearLooks = (): Promise<void> => clearAll(STORES.LOOKS);

// --- Lookboards ---
export const getLookboards = (): Promise<Lookboard[]> => getAll<Lookboard>(STORES.LOOKBOARDS);
export const saveLookboards = (lookboards: Lookboard[]): Promise<void> => saveAll(STORES.LOOKBOARDS, lookboards);
export const clearLookboards = (): Promise<void> => clearAll(STORES.LOOKBOARDS);

// Helper for generating a simple unique ID
export const generateId = (): number => Date.now() + Math.floor(Math.random() * 1000);