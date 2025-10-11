import { Look, Model, Lookboard } from '../types';

const DB_NAME = 'OunassAIStudioDB';
const DB_VERSION = 3; // Incremented version to trigger the migration
const STORES = {
  MODELS: 'models',
  LOOKS: 'looks',
  LOOKBOARDS: 'lookboards',
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
      console.log(`[DB] Database upgrade needed. Old version: ${event.oldVersion}, New version: ${DB_VERSION}`);
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;

      if (event.oldVersion < 1) {
        // Version 1: Initial setup
        if (!dbInstance.objectStoreNames.contains(STORES.MODELS)) {
          console.log('[DB Migration v1] Creating "models" object store.');
          dbInstance.createObjectStore(STORES.MODELS, { keyPath: 'id', autoIncrement: true });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.LOOKS)) {
          console.log('[DB Migration v1] Creating "looks" object store.');
          dbInstance.createObjectStore(STORES.LOOKS, { keyPath: 'id', autoIncrement: true });
        }
      }

      if (event.oldVersion < 2) {
        // Version 2: Added lookboards and createdAt index to looks
        if (!dbInstance.objectStoreNames.contains(STORES.LOOKBOARDS)) {
          console.log('[DB Migration v2] Creating "lookboards" object store.');
          const lookboardsStore = dbInstance.createObjectStore(STORES.LOOKBOARDS, { keyPath: 'id', autoIncrement: true });
          lookboardsStore.createIndex('publicId', 'publicId', { unique: true });
        }
        if (transaction) {
            const looksStore = transaction.objectStore(STORES.LOOKS);
            if (!looksStore.indexNames.contains('createdAt')) {
                console.log('[DB Migration v2] Creating "createdAt" index on "looks" store.');
                looksStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        }
      }
      
      if (event.oldVersion < 3) {
        // Version 3: Data migration for existing looks to add `createdAt` and `variations`
        console.log('[DB Migration v3] Starting migration for looks data to add `createdAt` and `variations`.');
        if (transaction) {
            const looksStore = transaction.objectStore(STORES.LOOKS);
            looksStore.openCursor().onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    console.log('[DB Migration v3] Processing cursor for a look...');
                    const look = cursor.value as Look;
                    console.log('[DB Migration v3] Found look object:', JSON.parse(JSON.stringify(look)));
                    let needsUpdate = false;
                    
                    if (typeof look.createdAt !== 'number') {
                        console.log(`[DB Migration v3] Look ID: ${look.id} is missing 'createdAt'. Adding it now.`);
                        look.createdAt = Date.now(); // Add a creation timestamp
                        needsUpdate = true;
                    }
                    if (!Array.isArray(look.variations)) {
                        console.log(`[DB Migration v3] Look ID: ${look.id} is missing 'variations'. Adding it now.`);
                        look.variations = []; // Add variations array
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        console.log(`[DB Migration v3] Updating look ID: ${look.id} in the database.`);
                        cursor.update(look);
                    } else {
                        console.log(`[DB Migration v3] Look ID: ${look.id} is already up-to-date. No changes needed.`);
                    }
                    cursor.continue();
                } else {
                   console.log('[DB Migration v3] Looks data migration complete. All looks processed.');
                }
            };
        } else {
            console.error('[DB Migration v3] Transaction is not available for migration.');
        }
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
