
/**
 * Settings/Preferences Page
 *
 * Full-featured settings page with:
 * - Theme selection (Dark, Light, System)
 * - Font size configuration
 * - Proxy settings
 * - SSL/Security settings
 * - Sidebar navigation for different settings categories
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Palette,
  Type,
  Network,
  Shield,
  Check,
  Save,
  RotateCcw,
  Keyboard,
  FolderOpen,
  RefreshCw,
  FileDown,
  Puzzle,
  Wrench,
  Info,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';

// Types
type ThemeOption = 'dark' | 'light' | 'system';
type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'shortcuts'
  | 'proxy'
  | 'ssl'
  | 'certificates'
  | 'storage'
  | 'autosave'
  | 'import-export'
  | 'extensions'
  | 'developer'
  | 'about';

interface Settings {
  theme: ThemeOption;
  interfaceFontSize: number;
  editorFontSize: number;
  monoFont: string;
  proxyEnabled: boolean;
  proxyType: 'http' | 'https' | 'socks5';
  proxyHost: string;
  proxyPort: string;
  proxyAuth: boolean;
  proxyUsername: string;
  proxyPassword: string;
  sslVerification: boolean;
  followRedirects: boolean;
  requestTimeout: number;
}

// Default settings
const defaultSettings: Settings = {
  theme: 'dark',
  interfaceFontSize: 14,
  editorFontSize: 13,
  monoFont: 'Monaco',
  proxyEnabled: false,
  proxyType: 'http',
  proxyHost: '',
  proxyPort: '8080',
  proxyAuth: false,
  proxyUsername: '',
  proxyPassword: '',
  sslVerification: true,
  followRedirects: true,
  requestTimeout: 30,
};

// Sidebar navigation items
const sidebarItems = [
  {
    category: 'Application',
    items: [
      { id: 'general' as SettingsCategory, label: 'General' },
      { id: 'appearance' as SettingsCategory, label: 'Appearance' },
      { id: 'editor' as SettingsCategory, label: 'Editor' },
      { id: 'shortcuts' as SettingsCategory, label: 'Keyboard Shortcuts' },
    ],
  },
  {
    category: 'Network',
    items: [
      { id: 'proxy' as SettingsCategory, label: 'Proxy Settings' },
      { id: 'ssl' as SettingsCategory, label: 'SSL/TLS' },
      { id: 'certificates' as SettingsCategory, label: 'Certificates' },
    ],
  },
  {
    category: 'Data',
    items: [
      { id: 'storage' as SettingsCategory, label: 'Storage Location' },
      { id: 'autosave' as SettingsCategory, label: 'Auto-save' },
      { id: 'import-export' as SettingsCategory, label: 'Import/Export' },
    ],
  },
  {
    category: 'Advanced',
    items: [
      { id: 'extensions' as SettingsCategory, label: 'Extensions' },
      { id: 'developer' as SettingsCategory, label: 'Developer Tools' },
      { id: 'about' as SettingsCategory, label: 'About' },
    ],
  },
];

// Monospace font options
const monoFonts = ['Monaco', 'Consolas', 'Fira Code', 'JetBrains Mono', 'Source Code Pro'];

export const SettingsPreferencesPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Handlers
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    // TODO: Save to database/store
    console.log('Saving settings:', settings);
    setHasChanges(false);
  }, [settings]);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
  }, []);

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Render theme card
  const renderThemeCard = (
    theme: ThemeOption,
    label: string,
    description: string,
    gradient: string,
    icon: React.ReactNode
  ) => {
    const isSelected = settings.theme === theme;
    return (
      <div
        onClick={() => updateSetting('theme', theme)}
        className={`bg-dark-bg border-2 rounded-lg p-4 cursor-pointer transition-all ${
          isSelected ? 'border-accent-blue' : 'border-dark-border hover:border-accent-blue/50'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-200 flex items-center space-x-2">
            {icon}
            <span>{label}</span>
          </span>
          {isSelected ? (
            <div className="w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
              <Check className="w-3 h-3 text-dark-bg" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>
          )}
        </div>
        <div className={`h-20 ${gradient} rounded-md border border-dark-border`}></div>
        <p className="text-xs text-gray-500 mt-2">{description}</p>
      </div>
    );
  };

  // Render toggle switch
  const renderToggle = (checked: boolean, onChange: (checked: boolean) => void) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-dark-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
    </label>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col">
        <div className="p-6 border-b border-dark-border">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-400 hover:text-accent-blue transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Back to Home</span>
          </button>
          <h1 className="text-xl font-semibold text-gray-200">Settings</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sidebarItems.map((section) => (
            <div key={section.category} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                {section.category}
              </h2>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveCategory(item.id)}
                      className={`w-full text-left block px-3 py-2 rounded-md transition-colors ${
                        activeCategory === item.id
                          ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue font-medium'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-bg'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl">
            {/* Appearance Settings */}
            {activeCategory === 'appearance' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">Appearance Settings</h1>
                  <p className="text-gray-400">
                    Customize the look and feel of WireSniff to match your preferences
                  </p>
                </div>

                {/* Theme Section */}
                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                    <Palette className="w-5 h-5 text-accent-blue mr-3" />
                    Theme
                  </h2>
                  <p className="text-sm text-gray-400 mb-6">
                    Choose your preferred color theme for the application
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    {renderThemeCard(
                      'dark',
                      'Dark',
                      'Default dark theme',
                      'bg-gradient-to-br from-gray-900 to-gray-800',
                      <Moon className="w-4 h-4" />
                    )}
                    {renderThemeCard(
                      'light',
                      'Light',
                      'Clean light theme',
                      'bg-gradient-to-br from-gray-100 to-white',
                      <Sun className="w-4 h-4" />
                    )}
                    {renderThemeCard(
                      'system',
                      'System',
                      'Follow OS theme',
                      'bg-gradient-to-br from-gray-900 via-gray-400 to-white',
                      <Monitor className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Font Section */}
                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                    <Type className="w-5 h-5 text-accent-blue mr-3" />
                    Font Size
                  </h2>
                  <p className="text-sm text-gray-400 mb-6">
                    Adjust the font size for better readability
                  </p>

                  <div className="space-y-4">
                    {/* Interface Font Size */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">
                          Interface Font Size
                        </label>
                        <p className="text-xs text-gray-500">Controls UI elements and menus</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-400 w-12 text-right">12px</span>
                        <input
                          type="range"
                          min="12"
                          max="18"
                          value={settings.interfaceFontSize}
                          onChange={(e) =>
                            updateSetting('interfaceFontSize', parseInt(e.target.value))
                          }
                          className="w-48 h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-accent-blue"
                        />
                        <span className="text-sm text-gray-400 w-12">18px</span>
                      </div>
                    </div>

                    <div className="h-px bg-dark-border"></div>

                    {/* Editor Font Size */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">
                          Editor Font Size
                        </label>
                        <p className="text-xs text-gray-500">
                          Controls code editor and response viewer
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-400 w-12 text-right">10px</span>
                        <input
                          type="range"
                          min="10"
                          max="20"
                          value={settings.editorFontSize}
                          onChange={(e) =>
                            updateSetting('editorFontSize', parseInt(e.target.value))
                          }
                          className="w-48 h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-accent-blue"
                        />
                        <span className="text-sm text-gray-400 w-12">20px</span>
                      </div>
                    </div>

                    <div className="h-px bg-dark-border"></div>

                    {/* Monospace Font */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">Monospace Font</label>
                        <p className="text-xs text-gray-500">Font family for code blocks</p>
                      </div>
                      <select
                        value={settings.monoFont}
                        onChange={(e) => updateSetting('monoFont', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      >
                        {monoFonts.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Proxy Settings */}
            {activeCategory === 'proxy' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">Proxy Settings</h1>
                  <p className="text-gray-400">Configure proxy server for all requests</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                    <Network className="w-5 h-5 text-accent-blue mr-3" />
                    Proxy Configuration
                  </h2>

                  <div className="space-y-5">
                    {/* Enable Proxy */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">Enable Proxy</label>
                        <p className="text-xs text-gray-500">Route requests through a proxy server</p>
                      </div>
                      {renderToggle(settings.proxyEnabled, (checked) =>
                        updateSetting('proxyEnabled', checked)
                      )}
                    </div>

                    {/* Proxy Type */}
                    <div>
                      <label className="text-sm font-medium text-gray-300 block mb-2">
                        Proxy Type
                      </label>
                      <select
                        value={settings.proxyType}
                        onChange={(e) =>
                          updateSetting('proxyType', e.target.value as Settings['proxyType'])
                        }
                        disabled={!settings.proxyEnabled}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-blue disabled:opacity-50"
                      >
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="socks5">SOCKS5</option>
                      </select>
                    </div>

                    {/* Host and Port */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-300 block mb-2">
                          Proxy Host
                        </label>
                        <input
                          type="text"
                          placeholder="proxy.example.com"
                          value={settings.proxyHost}
                          onChange={(e) => updateSetting('proxyHost', e.target.value)}
                          disabled={!settings.proxyEnabled}
                          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-blue disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-300 block mb-2">Port</label>
                        <input
                          type="text"
                          placeholder="8080"
                          value={settings.proxyPort}
                          onChange={(e) => updateSetting('proxyPort', e.target.value)}
                          disabled={!settings.proxyEnabled}
                          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-blue disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Proxy Authentication */}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">
                          Proxy Authentication
                        </label>
                        <p className="text-xs text-gray-500">Require username and password</p>
                      </div>
                      {renderToggle(settings.proxyAuth, (checked) =>
                        updateSetting('proxyAuth', checked)
                      )}
                    </div>

                    {settings.proxyAuth && settings.proxyEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-300 block mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            placeholder="username"
                            value={settings.proxyUsername}
                            onChange={(e) => updateSetting('proxyUsername', e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-300 block mb-2">
                            Password
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={settings.proxyPassword}
                            onChange={(e) => updateSetting('proxyPassword', e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* SSL Settings */}
            {activeCategory === 'ssl' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">SSL & Security</h1>
                  <p className="text-gray-400">
                    Configure SSL certificate verification and security options
                  </p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                    <Shield className="w-5 h-5 text-accent-blue mr-3" />
                    Security Settings
                  </h2>

                  <div className="space-y-5">
                    {/* SSL Verification */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">
                          SSL Certificate Verification
                        </label>
                        <p className="text-xs text-gray-500">
                          Verify SSL certificates for HTTPS requests
                        </p>
                      </div>
                      {renderToggle(settings.sslVerification, (checked) =>
                        updateSetting('sslVerification', checked)
                      )}
                    </div>

                    <div className="h-px bg-dark-border"></div>

                    {/* Follow Redirects */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">
                          Follow Redirects
                        </label>
                        <p className="text-xs text-gray-500">Automatically follow HTTP redirects</p>
                      </div>
                      {renderToggle(settings.followRedirects, (checked) =>
                        updateSetting('followRedirects', checked)
                      )}
                    </div>

                    <div className="h-px bg-dark-border"></div>

                    {/* Request Timeout */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-gray-200 block mb-1">Request Timeout</label>
                        <p className="text-xs text-gray-500">Maximum time to wait for response</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={settings.requestTimeout}
                          onChange={(e) =>
                            updateSetting('requestTimeout', parseInt(e.target.value) || 30)
                          }
                          className="w-20 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                        <span className="text-sm text-gray-400">seconds</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* General Settings */}
            {activeCategory === 'general' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">General Settings</h1>
                  <p className="text-gray-400">Configure general application behavior</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <p className="text-gray-400">General settings coming soon...</p>
                </div>
              </>
            )}

            {/* Editor Settings */}
            {activeCategory === 'editor' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">Editor Settings</h1>
                  <p className="text-gray-400">Configure code editor behavior and appearance</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <p className="text-gray-400">Editor settings coming soon...</p>
                </div>
              </>
            )}

            {/* Keyboard Shortcuts */}
            {activeCategory === 'shortcuts' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">Keyboard Shortcuts</h1>
                  <p className="text-gray-400">View and customize keyboard shortcuts</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <div className="space-y-3">
                    {[
                      { action: 'New Request', shortcut: '⌘ N' },
                      { action: 'New Collection', shortcut: '⌘ ⇧ N' },
                      { action: 'Send Request', shortcut: '⌘ Enter' },
                      { action: 'Save', shortcut: '⌘ S' },
                      { action: 'Open Settings', shortcut: '⌘ ,' },
                      { action: 'Toggle Sidebar', shortcut: '⌘ B' },
                      { action: 'Search', shortcut: '⌘ K' },
                      { action: 'Close Tab', shortcut: '⌘ W' },
                    ].map((item) => (
                      <div
                        key={item.action}
                        className="flex items-center justify-between py-2 border-b border-dark-border last:border-0"
                      >
                        <span className="text-gray-300">{item.action}</span>
                        <kbd className="px-3 py-1 bg-dark-bg rounded text-sm font-mono border border-dark-border">
                          {item.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* About */}
            {activeCategory === 'about' && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2">About WireSniff</h1>
                  <p className="text-gray-400">Application information and credits</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent-blue to-accent-teal rounded-xl flex items-center justify-center">
                      <Network className="w-8 h-8 text-dark-bg" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">WireSniff</h2>
                      <p className="text-gray-400">Version 1.0.0</p>
                    </div>
                  </div>
                  <p className="text-gray-400 mb-4">
                    A powerful API development and testing tool for developers. Built with Electron,
                    React, and TypeScript.
                  </p>
                  <div className="flex items-center space-x-4">
                    <button className="text-accent-blue hover:text-cyan-400 text-sm">
                      Release Notes
                    </button>
                    <button className="text-accent-blue hover:text-cyan-400 text-sm">
                      Documentation
                    </button>
                    <button className="text-accent-blue hover:text-cyan-400 text-sm">
                      Report Issue
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Placeholder for other categories */}
            {['certificates', 'storage', 'autosave', 'import-export', 'extensions', 'developer'].includes(
              activeCategory
            ) && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold text-gray-200 mb-2 capitalize">
                    {activeCategory.replace('-', ' ')} Settings
                  </h1>
                  <p className="text-gray-400">Configure {activeCategory.replace('-', ' ')} options</p>
                </div>

                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
                  <p className="text-gray-400">
                    {activeCategory.replace('-', ' ')} settings coming soon...
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-dark-border">
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-red-400 font-medium transition-colors flex items-center"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </button>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCancel}
                  className="px-6 py-2.5 bg-dark-bg hover:bg-dark-border border border-dark-border text-gray-200 font-medium rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="px-6 py-2.5 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-semibold rounded-lg transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-dark-surface border-t border-dark-border px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-6">
              <span>WireSniff v1.0.0</span>
              <button className="hover:text-accent-blue transition-colors">Release Notes</button>
              <button className="hover:text-accent-blue transition-colors">Community</button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                All systems operational
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default SettingsPreferencesPage;