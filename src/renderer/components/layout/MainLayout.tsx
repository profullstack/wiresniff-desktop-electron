import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * MainLayout Component
 * The main application layout with header, sidebar, and content area
 */
function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // Listen for toggle sidebar event from menu
  useEffect(() => {
    const unsubscribe = window.electronAPI?.on('toggle-sidebar', () => {
      setSidebarCollapsed((prev) => !prev);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Handle sidebar resize
  const handleSidebarResize = (newWidth: number) => {
    setSidebarWidth(Math.max(200, Math.min(500, newWidth)));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-dark-bg">
      {/* Header */}
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          width={sidebarWidth}
          onResize={handleSidebarResize}
          onCollapse={() => setSidebarCollapsed(true)}
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden bg-dark-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;