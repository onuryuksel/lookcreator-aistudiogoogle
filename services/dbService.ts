// This file implements a service for interacting with IndexedDB to persist application data.
import { Model, Look, Lookboard } from '../types';

const DB_NAME = 'OunassAIStudioDB';
const DB_VERSION = 1;

const STORES = {
  MODELS: 'models',
  LOOKS: 'looks',
  LOOKBOARDS: 'lookboards',
};

let db: IDBDatabase;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening database');
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
        dbInstance.createObjectStore(STORES.LOOKS, { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.LOOKBOARDS)) {
        const lookboardStore = dbInstance.createObjectStore(STORES.LOOKBOARDS, { keyPath: 'id', autoIncrement: true });
        lookboardStore.createIndex('publicId', 'publicId', { unique: true });
      }
    };
  });
};

const performDbOperation = <T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
    return initDB().then(dbInstance => new Promise<T>((resolve, reject) => {
        const transaction = dbInstance.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        request.onsuccess = () => {
            resolve(request.result as T);
        };
        request.onerror = () => {
            console.error('DB operation error:', request.error);
            reject(request.error);
        };
    }));
};

// Generic CRUD operations
export const getAll = <T>(storeName: string): Promise<T[]> => performDbOperation<T[]>(storeName, 'readonly', store => store.getAll());
export const getById = <T>(storeName: string, id: number): Promise<T> => performDbOperation<T>(storeName, 'readonly', store => store.get(id));
export const add = <T>(storeName: string, item: Omit<T, 'id'>): Promise<number> => performDbOperation<number>(storeName, 'readwrite', store => store.add(item));
export const update = <T>(storeName: string, item: T): Promise<number> => performDbOperation<number>(storeName, 'readwrite', store => store.put(item));
export const remove = (storeName: string, id: number): Promise<void> => performDbOperation<void>(storeName, 'readwrite', store => store.delete(id));

// Models
export const getAllModels = () => getAll<Model>(STORES.MODELS);
export const addModel = (model: Omit<Model, 'id'>) => add<Model>(STORES.MODELS, model);
export const deleteModel = (id: number) => remove(STORES.MODELS, id);

// Looks
export const getAllLooks = () => getAll<Look>(STORES.LOOKS);
export const addLook = (look: Omit<Look, 'id'>) => add<Look>(STORES.LOOKS, look);
export const updateLook = (look: Look) => update<Look>(STORES.LOOKS, look);
export const deleteLook = (id: number) => remove(STORES.LOOKS, id);

// Lookboards
export const getAllLookboards = () => getAll<Lookboard>(STORES.LOOKBOARDS);
export const addLookboard = (board: Omit<Lookboard, 'id'>) => add<Lookboard>(STORES.LOOKBOARDS, board);
export const updateLookboard = (board: Lookboard) => update<Lookboard>(STORES.LOOKBOARDS, board);
export const deleteLookboard = (id: number) => remove(STORES.LOOKBOARDS, id);
export const getLookboardByPublicId = (publicId: string): Promise<Lookboard | undefined> => {
    return initDB().then(dbInstance => new Promise<Lookboard | undefined>((resolve, reject) => {
        const transaction = dbInstance.transaction(STORES.LOOKBOARDS, 'readonly');
        const store = transaction.objectStore(STORES.LOOKBOARDS);
        const index = store.index('publicId');
        const request = index.get(publicId);

        request.onsuccess = () => {
            resolve(request.result as Lookboard | undefined);
        };
        request.onerror = () => {
            console.error('DB getByPublicId error:', request.error);
            reject(request.error);
        };
    }));
};
