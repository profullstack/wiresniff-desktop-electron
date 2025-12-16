/**
 * Database IPC Handlers
 * 
 * Registers IPC handlers for database operations from the renderer process.
 */

import { ipcMain } from 'electron';
import { initDatabase, closeDatabase, getDatabaseStats, exportDatabase } from './index';
import {
  collectionRepository,
  requestRepository,
  environmentRepository,
  environmentVariableRepository,
  historyRepository,
  settingsRepository,
} from './repositories';
import type { Collection } from './repositories/CollectionRepository';
import type { Request, ParsedRequest } from './repositories/RequestRepository';
import type { Environment, EnvironmentVariable } from './repositories/EnvironmentRepository';
import type { RequestHistory } from './repositories/HistoryRepository';
import type { AppSettings } from './repositories/SettingsRepository';

/**
 * Register all database IPC handlers
 */
export function registerDatabaseIpcHandlers(): void {
  // Initialize database
  initDatabase();

  // ==================== Database Operations ====================
  
  ipcMain.handle('db:getStats', () => {
    return getDatabaseStats();
  });

  ipcMain.handle('db:export', (_event, exportPath: string) => {
    exportDatabase(exportPath);
    return { success: true };
  });

  // ==================== Collection Operations ====================

  ipcMain.handle('collections:findAll', (_event, options?: { userId?: string }) => {
    if (options?.userId) {
      return collectionRepository.findByUserId(options.userId);
    }
    return collectionRepository.findAll();
  });

  ipcMain.handle('collections:findById', (_event, id: string) => {
    return collectionRepository.findById(id);
  });

  ipcMain.handle('collections:findRootCollections', (_event, userId?: string) => {
    return collectionRepository.findRootCollections(userId);
  });

  ipcMain.handle('collections:getTree', (_event, userId?: string) => {
    return collectionRepository.getTree(userId);
  });

  ipcMain.handle('collections:create', (_event, data: Partial<Collection>) => {
    return collectionRepository.create(data);
  });

  ipcMain.handle('collections:update', (_event, id: string, data: Partial<Collection>) => {
    return collectionRepository.update(id, data);
  });

  ipcMain.handle('collections:delete', (_event, id: string) => {
    return collectionRepository.softDelete(id);
  });

  ipcMain.handle('collections:duplicate', (_event, id: string, newName?: string) => {
    return collectionRepository.duplicate(id, newName);
  });

  ipcMain.handle('collections:search', (_event, query: string, userId?: string) => {
    return collectionRepository.search(query, userId);
  });

  ipcMain.handle('collections:reorder', (_event, orderedIds: string[]) => {
    collectionRepository.reorder(orderedIds);
    return { success: true };
  });

  ipcMain.handle('collections:getStats', (_event, id: string) => {
    return collectionRepository.getStats(id);
  });

  // ==================== Request Operations ====================

  ipcMain.handle('requests:findAll', (_event, options?: { collectionId?: string; folderId?: string }) => {
    if (options?.collectionId) {
      return requestRepository.findByCollectionId(options.collectionId);
    }
    if (options?.folderId) {
      return requestRepository.findByFolderId(options.folderId);
    }
    return requestRepository.findAll();
  });

  ipcMain.handle('requests:findById', (_event, id: string) => {
    return requestRepository.findById(id);
  });

  ipcMain.handle('requests:findByIdParsed', (_event, id: string) => {
    return requestRepository.findByIdParsed(id);
  });

  ipcMain.handle('requests:create', (_event, data: Partial<Request>) => {
    return requestRepository.create(data);
  });

  ipcMain.handle('requests:createFromParsed', (_event, data: Partial<ParsedRequest>) => {
    return requestRepository.createFromParsed(data);
  });

  ipcMain.handle('requests:update', (_event, id: string, data: Partial<Request>) => {
    return requestRepository.update(id, data);
  });

  ipcMain.handle('requests:updateFromParsed', (_event, id: string, data: Partial<ParsedRequest>) => {
    return requestRepository.updateFromParsed(id, data);
  });

  ipcMain.handle('requests:delete', (_event, id: string) => {
    return requestRepository.softDelete(id);
  });

  ipcMain.handle('requests:duplicate', (_event, id: string, newName?: string) => {
    return requestRepository.duplicate(id, newName);
  });

  ipcMain.handle('requests:search', (_event, query: string, collectionId?: string) => {
    return requestRepository.search(query, collectionId);
  });

  ipcMain.handle('requests:reorder', (_event, orderedIds: string[]) => {
    requestRepository.reorder(orderedIds);
    return { success: true };
  });

  ipcMain.handle('requests:moveToFolder', (_event, id: string, folderId: string | null) => {
    return requestRepository.moveToFolder(id, folderId);
  });

  ipcMain.handle('requests:moveToCollection', (_event, id: string, collectionId: string, folderId?: string) => {
    return requestRepository.moveToCollection(id, collectionId, folderId);
  });

  ipcMain.handle('requests:getRecent', (_event, limit?: number) => {
    return requestRepository.getRecent(limit);
  });

  // ==================== Environment Operations ====================

  ipcMain.handle('environments:findAll', (_event, userId?: string) => {
    if (userId) {
      return environmentRepository.findByUserId(userId);
    }
    return environmentRepository.findAll();
  });

  ipcMain.handle('environments:findById', (_event, id: string) => {
    return environmentRepository.findById(id);
  });

  ipcMain.handle('environments:getWithVariables', (_event, id: string) => {
    return environmentRepository.getWithVariables(id);
  });

  ipcMain.handle('environments:getActive', (_event, userId?: string) => {
    return environmentRepository.getActive(userId);
  });

  ipcMain.handle('environments:setActive', (_event, id: string) => {
    return environmentRepository.setActive(id);
  });

  ipcMain.handle('environments:create', (_event, data: Partial<Environment>) => {
    return environmentRepository.create(data);
  });

  ipcMain.handle('environments:update', (_event, id: string, data: Partial<Environment>) => {
    return environmentRepository.update(id, data);
  });

  ipcMain.handle('environments:delete', (_event, id: string) => {
    return environmentRepository.softDelete(id);
  });

  ipcMain.handle('environments:duplicate', (_event, id: string, newName?: string) => {
    return environmentRepository.duplicate(id, newName);
  });

  ipcMain.handle('environments:search', (_event, query: string, userId?: string) => {
    return environmentRepository.search(query, userId);
  });

  // ==================== Environment Variable Operations ====================

  ipcMain.handle('envVariables:findByEnvironmentId', (_event, environmentId: string) => {
    return environmentVariableRepository.findByEnvironmentId(environmentId);
  });

  ipcMain.handle('envVariables:setVariable', (_event, environmentId: string, key: string, value: string, isSecret?: boolean) => {
    return environmentVariableRepository.setVariable(environmentId, key, value, isSecret);
  });

  ipcMain.handle('envVariables:bulkSetVariables', (_event, environmentId: string, variables: { key: string; value: string; isSecret?: boolean }[]) => {
    return environmentVariableRepository.bulkSetVariables(environmentId, variables);
  });

  ipcMain.handle('envVariables:delete', (_event, id: string) => {
    return environmentVariableRepository.softDelete(id);
  });

  ipcMain.handle('envVariables:toggleEnabled', (_event, id: string) => {
    return environmentVariableRepository.toggleEnabled(id);
  });

  ipcMain.handle('envVariables:getVariablesMap', (_event, environmentId: string, includeDisabled?: boolean) => {
    return environmentVariableRepository.getVariablesMap(environmentId, includeDisabled);
  });

  // ==================== History Operations ====================

  ipcMain.handle('history:findAll', (_event, options?: { userId?: string; limit?: number }) => {
    return historyRepository.getRecent(options?.limit, options?.userId);
  });

  ipcMain.handle('history:findById', (_event, id: string) => {
    return historyRepository.findById(id);
  });

  ipcMain.handle('history:findByRequestId', (_event, requestId: string) => {
    return historyRepository.findByRequestId(requestId);
  });

  ipcMain.handle('history:create', (_event, data: Partial<RequestHistory>) => {
    return historyRepository.create(data);
  });

  ipcMain.handle('history:search', (_event, query: string, userId?: string) => {
    return historyRepository.search(query, userId);
  });

  ipcMain.handle('history:getStats', (_event, userId?: string) => {
    return historyRepository.getStats(userId);
  });

  ipcMain.handle('history:clearOlderThan', (_event, date: string, userId?: string) => {
    return historyRepository.clearOlderThan(date, userId);
  });

  ipcMain.handle('history:clearAll', (_event, userId?: string) => {
    return historyRepository.clearAll(userId);
  });

  ipcMain.handle('history:getUniqueUrls', (_event, userId?: string, limit?: number) => {
    return historyRepository.getUniqueUrls(userId, limit);
  });

  ipcMain.handle('history:getSlowest', (_event, limit?: number, userId?: string) => {
    return historyRepository.getSlowest(limit, userId);
  });

  ipcMain.handle('history:replay', (_event, historyId: string) => {
    return historyRepository.replayToRequest(historyId);
  });

  // ==================== Settings Operations ====================

  ipcMain.handle('settings:get', (_event, key: string, userId?: string) => {
    return settingsRepository.getSetting(key, userId);
  });

  ipcMain.handle('settings:set', (_event, key: string, value: string, userId?: string) => {
    return settingsRepository.setSetting(key, value, userId);
  });

  ipcMain.handle('settings:getAll', (_event, userId?: string) => {
    return settingsRepository.getAllSettings(userId);
  });

  ipcMain.handle('settings:getAppSettings', (_event, userId?: string) => {
    return settingsRepository.getAppSettings(userId);
  });

  ipcMain.handle('settings:saveAppSettings', (_event, settings: Partial<AppSettings>, userId?: string) => {
    settingsRepository.saveAppSettings(settings, userId);
    return { success: true };
  });

  ipcMain.handle('settings:resetToDefaults', (_event, userId?: string) => {
    settingsRepository.resetToDefaults(userId);
    return { success: true };
  });

  ipcMain.handle('settings:export', (_event, userId?: string) => {
    return settingsRepository.exportSettings(userId);
  });

  ipcMain.handle('settings:import', (_event, json: string, userId?: string) => {
    settingsRepository.importSettings(json, userId);
    return { success: true };
  });

  console.log('[Database] IPC handlers registered');
}

/**
 * Cleanup database on app quit
 */
export function cleanupDatabase(): void {
  closeDatabase();
}