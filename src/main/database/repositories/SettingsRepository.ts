/**
 * Settings Repository
 * 
 * Handles CRUD operations for user settings.
 */

import { BaseRepository, BaseEntity } from './BaseRepository';

export interface Setting extends BaseEntity {
  user_id?: string;
  key: string;
  value?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;
  editorFontSize: number;
  editorFontFamily: string;
  autoSave: boolean;
  autoSaveInterval: number;
  requestTimeout: number;
  followRedirects: boolean;
  maxRedirects: number;
  validateSSL: boolean;
  proxyEnabled: boolean;
  proxyHost?: string;
  proxyPort?: number;
  proxyAuth?: boolean;
  proxyUsername?: string;
  proxyPassword?: string;
  syncEnabled: boolean;
  syncInterval: number;
  historyRetentionDays: number;
  maxHistoryItems: number;
  showResponseTime: boolean;
  showResponseSize: boolean;
  prettyPrintResponse: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  telemetryEnabled: boolean;
  updateChannel: 'stable' | 'beta' | 'alpha';
  language: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Inter, system-ui, sans-serif',
  editorFontSize: 13,
  editorFontFamily: 'JetBrains Mono, Fira Code, monospace',
  autoSave: true,
  autoSaveInterval: 30000,
  requestTimeout: 30000,
  followRedirects: true,
  maxRedirects: 10,
  validateSSL: true,
  proxyEnabled: false,
  syncEnabled: true,
  syncInterval: 60000,
  historyRetentionDays: 30,
  maxHistoryItems: 1000,
  showResponseTime: true,
  showResponseSize: true,
  prettyPrintResponse: true,
  wordWrap: true,
  lineNumbers: true,
  minimap: false,
  telemetryEnabled: false,
  updateChannel: 'stable',
  language: 'en',
};

export class SettingsRepository extends BaseRepository<Setting> {
  constructor() {
    super('settings');
  }

  /**
   * Get a setting value
   */
  getSetting(key: string, userId?: string): string | null {
    const where: Record<string, unknown> = { key };
    if (userId) {
      where.user_id = userId;
    } else {
      where.user_id = null;
    }
    
    const results = this.findAll({ where, limit: 1 });
    return results.length > 0 ? results[0].value || null : null;
  }

  /**
   * Set a setting value
   */
  setSetting(key: string, value: string, userId?: string): Setting {
    const existing = this.findSetting(key, userId);
    
    if (existing) {
      return this.update(existing.id, { value }) as Setting;
    }
    
    return this.create({
      key,
      value,
      user_id: userId,
    });
  }

  /**
   * Find a setting by key
   */
  findSetting(key: string, userId?: string): Setting | null {
    const where: Record<string, unknown> = { key };
    if (userId) {
      where.user_id = userId;
    } else {
      where.user_id = null;
    }
    
    const results = this.findAll({ where, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Delete a setting
   */
  deleteSetting(key: string, userId?: string): boolean {
    const setting = this.findSetting(key, userId);
    if (!setting) return false;
    return this.hardDelete(setting.id);
  }

  /**
   * Get all settings for a user
   */
  getAllSettings(userId?: string): Record<string, string> {
    const where: Record<string, unknown> = {};
    if (userId) {
      where.user_id = userId;
    } else {
      where.user_id = null;
    }
    
    const settings = this.findAll({ where });
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value || '';
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Get typed app settings
   */
  getAppSettings(userId?: string): AppSettings {
    const rawSettings = this.getAllSettings(userId);
    
    return {
      theme: (rawSettings.theme as AppSettings['theme']) || DEFAULT_SETTINGS.theme,
      fontSize: parseInt(rawSettings.fontSize) || DEFAULT_SETTINGS.fontSize,
      fontFamily: rawSettings.fontFamily || DEFAULT_SETTINGS.fontFamily,
      editorFontSize: parseInt(rawSettings.editorFontSize) || DEFAULT_SETTINGS.editorFontSize,
      editorFontFamily: rawSettings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily,
      autoSave: rawSettings.autoSave !== undefined ? rawSettings.autoSave === 'true' : DEFAULT_SETTINGS.autoSave,
      autoSaveInterval: parseInt(rawSettings.autoSaveInterval) || DEFAULT_SETTINGS.autoSaveInterval,
      requestTimeout: parseInt(rawSettings.requestTimeout) || DEFAULT_SETTINGS.requestTimeout,
      followRedirects: rawSettings.followRedirects !== undefined ? rawSettings.followRedirects === 'true' : DEFAULT_SETTINGS.followRedirects,
      maxRedirects: parseInt(rawSettings.maxRedirects) || DEFAULT_SETTINGS.maxRedirects,
      validateSSL: rawSettings.validateSSL !== undefined ? rawSettings.validateSSL === 'true' : DEFAULT_SETTINGS.validateSSL,
      proxyEnabled: rawSettings.proxyEnabled !== undefined ? rawSettings.proxyEnabled === 'true' : DEFAULT_SETTINGS.proxyEnabled,
      proxyHost: rawSettings.proxyHost || DEFAULT_SETTINGS.proxyHost,
      proxyPort: parseInt(rawSettings.proxyPort) || DEFAULT_SETTINGS.proxyPort,
      proxyAuth: rawSettings.proxyAuth !== undefined ? rawSettings.proxyAuth === 'true' : DEFAULT_SETTINGS.proxyAuth,
      proxyUsername: rawSettings.proxyUsername || DEFAULT_SETTINGS.proxyUsername,
      proxyPassword: rawSettings.proxyPassword || DEFAULT_SETTINGS.proxyPassword,
      syncEnabled: rawSettings.syncEnabled !== undefined ? rawSettings.syncEnabled === 'true' : DEFAULT_SETTINGS.syncEnabled,
      syncInterval: parseInt(rawSettings.syncInterval) || DEFAULT_SETTINGS.syncInterval,
      historyRetentionDays: parseInt(rawSettings.historyRetentionDays) || DEFAULT_SETTINGS.historyRetentionDays,
      maxHistoryItems: parseInt(rawSettings.maxHistoryItems) || DEFAULT_SETTINGS.maxHistoryItems,
      showResponseTime: rawSettings.showResponseTime !== undefined ? rawSettings.showResponseTime === 'true' : DEFAULT_SETTINGS.showResponseTime,
      showResponseSize: rawSettings.showResponseSize !== undefined ? rawSettings.showResponseSize === 'true' : DEFAULT_SETTINGS.showResponseSize,
      prettyPrintResponse: rawSettings.prettyPrintResponse !== undefined ? rawSettings.prettyPrintResponse === 'true' : DEFAULT_SETTINGS.prettyPrintResponse,
      wordWrap: rawSettings.wordWrap !== undefined ? rawSettings.wordWrap === 'true' : DEFAULT_SETTINGS.wordWrap,
      lineNumbers: rawSettings.lineNumbers !== undefined ? rawSettings.lineNumbers === 'true' : DEFAULT_SETTINGS.lineNumbers,
      minimap: rawSettings.minimap !== undefined ? rawSettings.minimap === 'true' : DEFAULT_SETTINGS.minimap,
      telemetryEnabled: rawSettings.telemetryEnabled !== undefined ? rawSettings.telemetryEnabled === 'true' : DEFAULT_SETTINGS.telemetryEnabled,
      updateChannel: (rawSettings.updateChannel as AppSettings['updateChannel']) || DEFAULT_SETTINGS.updateChannel,
      language: rawSettings.language || DEFAULT_SETTINGS.language,
    };
  }

  /**
   * Save app settings
   */
  saveAppSettings(settings: Partial<AppSettings>, userId?: string): void {
    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          this.setSetting(key, String(value), userId);
        }
      }
    });
    transaction();
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(userId?: string): void {
    const transaction = this.db.transaction(() => {
      // Delete all existing settings
      let sql = `DELETE FROM ${this.tableName}`;
      const params: unknown[] = [];
      
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      } else {
        sql += ' WHERE user_id IS NULL';
      }
      
      this.rawExecute(sql, params);
      
      // Insert default settings
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (value !== undefined) {
          this.create({
            key,
            value: String(value),
            user_id: userId,
          });
        }
      }
    });
    transaction();
  }

  /**
   * Export settings as JSON
   */
  exportSettings(userId?: string): string {
    const settings = this.getAppSettings(userId);
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(json: string, userId?: string): void {
    try {
      const settings = JSON.parse(json) as Partial<AppSettings>;
      this.saveAppSettings(settings, userId);
    } catch (error) {
      throw new Error('Invalid settings JSON');
    }
  }
}

// Export singleton instance
export const settingsRepository = new SettingsRepository();