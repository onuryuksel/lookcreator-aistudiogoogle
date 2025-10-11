import { Look, Model, Lookboard } from '../types';

const DB_NAME = 'OunassAIStudioDB';
const DB_VERSION = 2; // Incremented version to trigger upgrade
const STORES = {
  MODELS: 'models',
  LOOKS: 'looks',
  LOOKBOARDS: 'lookboards', // Added lookboards store
};

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      
      if (!dbInstance.objectStoreNames.contains(STORES.MODELS)) {
        dbInstance.createObjectStore(STORES.MODELS, { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.LOOKS)) {
        const looksStore = dbInstance.createObjectStore(STORES.LOOKS, { keyPath: 'id', autoIncrement: true });
        looksStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // Added creation logic for the new lookboards store
      if (!dbInstance.objectStoreNames.contains(STORES.LOOKBOARDS)) {
        const lookboardsStore = dbInstance.createObjectStore(STORES.LOOKBOARDS, { keyPath: 'id', autoIncrement: true });
        lookboardsStore.createIndex('publicId', 'publicId', { unique: true });
      }
    };
  });
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(`Error fetching from ${storeName}`);
    request.onsuccess = () => resolve(request.result);
  });
};

export const add = async <T>(storeName: string, item: Omit<T, 'id'>): Promise<T> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);

        request.onerror = () => reject(`Error adding to ${storeName}`);
        request.onsuccess = () => {
            // The result of an add operation is the key of the new object.
            const newItemWithId = { ...item, id: request.result as number } as T;
            resolve(newItemWithId);
        };
    });
};

export const put = async <T extends {id?: number}>(storeName: string, item: T): Promise<T> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        if (!item.id) {
            return reject(`Item must have an id to be updated.`);
        }
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onerror = () => reject(`Error updating item in ${storeName}`);
        request.onsuccess = () => {
            // The result of a put operation is the key of the object.
            resolve(item);
        };
    });
};


export const bulkAdd = async <T>(storeName: string, items: Omit<T, 'id'>[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error(`Error during bulk add to ${storeName}:`, transaction.error);
            reject(`Error bulk adding to ${storeName}. See console for details.`);
        };
        
        items.forEach(item => {
            store.add(item);
        });
    });
};

export const remove = async (storeName: string, id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(`Error deleting from ${storeName}`);
    request.onsuccess = () => resolve();
  });
};
