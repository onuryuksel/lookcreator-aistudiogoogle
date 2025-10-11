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
    console.log('[DB] Initializing database...');

    const timeout = setTimeout(() => {
        console.error('[DB] Database initialization timed out after 3 seconds.');
        reject('Database initialization timed out. This can happen if the database is corrupted or locked.');
    }, 3000);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    const cleanupAndResolve = (result: IDBDatabase) => {
        clearTimeout(timeout);
        resolve(result);
    };

    const cleanupAndReject = (reason?: any) => {
        clearTimeout(timeout);
        reject(reason);
    };

    request.onerror = () => {
      console.error('[DB] Database initialization error:', request.error);
      cleanupAndReject('Error opening IndexedDB.');
    };

    request.onblocked = () => {
        console.warn('[DB] Database upgrade blocked. Please close other open tabs with this app.');
        cleanupAndReject('Database upgrade is blocked. Please close other tabs running this application and reload.');
    };

    request.onsuccess = () => {
      console.log('[DB] Database opened successfully.');
      db = request.result;
      cleanupAndResolve(db);
    };

    request.onupgradeneeded = (event) => {
      console.log('[DB] Database upgrade needed. Old version:', event.oldVersion, 'New version:', DB_VERSION);
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      
      if (!dbInstance.objectStoreNames.contains(STORES.MODELS)) {
        console.log('[DB] Creating "models" object store.');
        dbInstance.createObjectStore(STORES.MODELS, { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.LOOKS)) {
        console.log('[DB] Creating "looks" object store.');
        const looksStore = dbInstance.createObjectStore(STORES.LOOKS, { keyPath: 'id', autoIncrement: true });
        looksStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // Added creation logic for the new lookboards store
      if (!dbInstance.objectStoreNames.contains(STORES.LOOKBOARDS)) {
        console.log('[DB] Creating "lookboards" object store.');
        const lookboardsStore = dbInstance.createObjectStore(STORES.LOOKBOARDS, { keyPath: 'id', autoIncrement: true });
        lookboardsStore.createIndex('publicId', 'publicId', { unique: true });
      }
      console.log('[DB] Database upgrade complete.');
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

export const deleteDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.warn('[DB] Deleting entire database...');
    // Ensure any existing connection is closed before deletion.
    if (db) {
      db.close();
      db = null;
    }
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onerror = () => {
      console.error('[DB] Error deleting database.', request.error);
      reject('Could not delete the database.');
    };
    
    request.onsuccess = () => {
      console.log('[DB] Database deleted successfully.');
      resolve();
    };

    request.onblocked = () => {
      console.warn('[DB] Database deletion blocked. Please close other tabs and try again.');
      reject('Database deletion is blocked.');
    };
  });
};