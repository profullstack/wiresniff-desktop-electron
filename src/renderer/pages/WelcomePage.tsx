import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Plus,
  FolderOpen,
  Clock,
  Book,
  Keyboard,
  ArrowRight,
  FileInput,
  Code,
  Terminal,
  BookOpen,
  Layers,
  Database,
  HelpCircle,
  Settings,
  Moon,
  Sun,
  Github,
  Twitter,
} from 'lucide-react';
import { useTabStore } from '../stores/tabStore';

// Types for recent projects
interface RecentProject {
  id: string;
  name: string;
  description: string;
  requestCount: number;
  environmentCount: number;
  lastOpened: Date;
  tags: Array<{
    label: string;
    color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'teal';
  }>;
  icon: 'layers' | 'database' | 'bolt';
  iconColor: 'purple' | 'blue' | 'teal';
}

// Mock recent projects data - in production this would come from the database
const mockRecentProjects: RecentProject[] = [
  {
    id: '1',
    name: 'E-commerce API',
    description: '23 requests • 4 environments',
    requestCount: 23,
    environmentCount: 4,
    lastOpened: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    tags: [
      { label: 'REST', color: 'green' },
      { label: 'OAuth', color: 'blue' },
    ],
    icon: 'layers',
    iconColor: 'purple',
  },
  {
    id: '2',
    name: 'User Service',
    description: '47 requests • 2 environments',
    requestCount: 47,
    environmentCount: 2,
    lastOpened: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    tags: [
      { label: 'REST', color: 'green' },
      { label: 'GraphQL', color: 'orange' },
    ],
    icon: 'database',
    iconColor: 'blue',
  },
  {
    id: '3',
    name: 'Payment Gateway',
    description: '15 requests • 3 environments',
    requestCount: 15,
    environmentCount: 3,
    lastOpened: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    tags: [
      { label: 'REST', color: 'green' },
      { label: 'Webhooks', color: 'red' },
    ],
    icon: 'bolt',
    iconColor: 'teal',
  },
];

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

// Tag color mapping
const tagColors: Record<string, string> = {
  green: 'bg-green-500/20 text-green-400',
  blue: 'bg-blue-500/20 text-blue-400',
  orange: 'bg-orange-500/20 text-orange-400',
  red: 'bg-red-500/20 text-red-400',
  purple: 'bg-purple-500/20 text-purple-400',
  teal: 'bg-teal-500/20 text-teal-400',
};

// Icon color mapping
const iconColors: Record<string, string> = {
  purple: 'bg-purple-500/20 text-purple-400',
  blue: 'bg-blue-500/20 text-blue-400',
  teal: 'bg-teal-500/20 text-teal-400',
};

// Project icon component
const ProjectIcon: React.FC<{ icon: string; colorClass: string }> = ({ icon, colorClass }) => {
  const iconMap: Record<string, React.ReactNode> = {
    layers: <Layers className="w-5 h-5" />,
    database: <Database className="w-5 h-5" />,
    bolt: <Zap className="w-5 h-5" />,
  };

  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
      {iconMap[icon] || <Layers className="w-5 h-5" />}
    </div>
  );
};

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { createTab } = useTabStore();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(mockRecentProjects);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Handle new request
  const handleNewRequest = () => {
    createTab('http');
    navigate('/workspace');
  };

  // Handle import collection
  const handleImportCollection = () => {
    // TODO: Open import dialog
    navigate('/collections');
  };

  // Handle open recent
  const handleOpenRecent = () => {
    // TODO: Show recent projects modal
  };

  // Handle documentation
  const handleDocumentation = () => {
    // Open external documentation
    window.open('https://docs.wiresniff.com', '_blank');
  };

  // Handle shortcuts
  const handleShortcuts = () => {
    setShowShortcuts(true);
  };

  // Handle project click
  const handleProjectClick = (project: RecentProject) => {
    // TODO: Load project and navigate to workspace
    navigate('/workspace');
  };

  // Handle import Postman
  const handleImportPostman = () => {
    // TODO: Open Postman import dialog
    navigate('/collections');
  };

  // Handle import OpenAPI
  const handleImportOpenAPI = () => {
    // TODO: Open OpenAPI import dialog
    navigate('/collections');
  };

  // Handle import cURL
  const handleImportCurl = () => {
    // TODO: Open cURL import dialog
    createTab('http');
    navigate('/workspace');
  };

  // Handle learn/tutorials
  const handleLearn = () => {
    window.open('https://docs.wiresniff.com/tutorials', '_blank');
  };

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // TODO: Implement actual theme switching
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-gray-200">
      {/* Header */}
      <header className="border-b border-dark-border bg-dark-surface">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent-blue to-accent-teal rounded flex items-center justify-center">
              <Zap className="w-4 h-4 text-dark-bg" />
            </div>
            <span className="text-xl font-semibold tracking-tight">WireSniff</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              className="text-gray-400 hover:text-gray-200 transition-colors"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              className="text-gray-400 hover:text-gray-200 transition-colors"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              className="px-3 py-1.5 rounded bg-dark-border hover:bg-gray-700 transition-colors text-sm flex items-center space-x-2"
              onClick={toggleTheme}
            >
              {isDarkMode ? (
                <>
                  <Moon className="w-3 h-3" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3" />
                  <span>Light</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-accent-blue to-accent-teal rounded-2xl mb-6 shadow-lg shadow-accent-blue/20">
              <Zap className="w-8 h-8 text-dark-bg" />
            </div>
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-accent-blue to-accent-teal bg-clip-text text-transparent">
              WireSniff
            </h1>
            <p className="text-xl text-gray-400 mb-12">Inspect every wire.</p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center space-x-4 mb-8">
              <button
                onClick={handleNewRequest}
                className="px-8 py-3.5 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-semibold rounded-lg transition-all shadow-lg shadow-accent-blue/30 hover:shadow-accent-blue/50 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Request</span>
              </button>
              <button
                onClick={handleImportCollection}
                className="px-8 py-3.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-gray-200 font-semibold rounded-lg transition-colors flex items-center space-x-2"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Import Collection</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center space-x-6 text-sm">
              <button
                onClick={handleOpenRecent}
                className="text-accent-teal hover:text-accent-blue transition-colors flex items-center space-x-2"
              >
                <Clock className="w-4 h-4" />
                <span>Open Recent</span>
              </button>
              <span className="text-gray-600">•</span>
              <button
                onClick={handleDocumentation}
                className="text-accent-teal hover:text-accent-blue transition-colors flex items-center space-x-2"
              >
                <Book className="w-4 h-4" />
                <span>Documentation</span>
              </button>
              <span className="text-gray-600">•</span>
              <button
                onClick={handleShortcuts}
                className="text-accent-teal hover:text-accent-blue transition-colors flex items-center space-x-2"
              >
                <Keyboard className="w-4 h-4" />
                <span>Shortcuts</span>
              </button>
            </div>
          </div>

          {/* Recent Projects Section */}
          {recentProjects.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-300">Recent Projects</h2>
                <button className="text-sm text-accent-teal hover:text-accent-blue transition-colors flex items-center">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project)}
                    className="bg-dark-surface border border-dark-border rounded-lg p-5 hover:border-accent-blue/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <ProjectIcon
                        icon={project.icon}
                        colorClass={iconColors[project.iconColor]}
                      />
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(project.lastOpened)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-200 mb-2 group-hover:text-accent-blue transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">{project.description}</p>
                    <div className="flex items-center space-x-2">
                      {project.tags.map((tag, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 text-xs rounded ${tagColors[tag.color]}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-300 mb-6">Quick Links</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Import Postman */}
              <button
                onClick={handleImportPostman}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-accent-blue/50 hover:bg-dark-border transition-all group text-left"
              >
                <div className="w-12 h-12 bg-accent-blue/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent-blue/30 transition-colors">
                  <FileInput className="w-6 h-6 text-accent-blue" />
                </div>
                <h3 className="font-semibold text-gray-200 mb-1">Import Postman</h3>
                <p className="text-sm text-gray-500">Migrate collections</p>
              </button>

              {/* OpenAPI */}
              <button
                onClick={handleImportOpenAPI}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-accent-blue/50 hover:bg-dark-border transition-all group text-left"
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                  <Code className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-gray-200 mb-1">OpenAPI</h3>
                <p className="text-sm text-gray-500">Import Swagger</p>
              </button>

              {/* Import cURL */}
              <button
                onClick={handleImportCurl}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-accent-blue/50 hover:bg-dark-border transition-all group text-left"
              >
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                  <Terminal className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-200 mb-1">Import cURL</h3>
                <p className="text-sm text-gray-500">Paste command</p>
              </button>

              {/* Learn */}
              <button
                onClick={handleLearn}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-accent-blue/50 hover:bg-dark-border transition-all group text-left"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <BookOpen className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="font-semibold text-gray-200 mb-1">Learn</h3>
                <p className="text-sm text-gray-500">View tutorials</p>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-border bg-dark-surface">
        <div className="px-6 py-4 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6 text-gray-500">
            <span>Version 1.0.0</span>
            <a href="#" className="hover:text-accent-blue transition-colors">
              Release Notes
            </a>
            <a href="#" className="hover:text-accent-blue transition-colors">
              Privacy
            </a>
          </div>
          <div className="flex items-center space-x-4 text-gray-500">
            <a
              href="https://github.com/wiresniff"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-blue transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com/wiresniff"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-blue transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://discord.gg/wiresniff"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-blue transition-colors"
            >
              {/* Discord icon - using a custom SVG since lucide doesn't have it */}
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">General</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>New Request</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ N</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>New Tab</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ T</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Close Tab</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ W</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Settings</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ ,</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Request</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Send Request</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ Enter</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Save Request</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicate</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ D</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Format Body</span>
                      <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ B</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-border">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Navigation</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Next Tab</span>
                    <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ ]</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Previous Tab</span>
                    <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ [</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Go to Collections</span>
                    <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ 1</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Go to Environments</span>
                    <kbd className="px-2 py-0.5 bg-dark-border rounded text-xs">⌘ 2</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowShortcuts(false)}
                className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;