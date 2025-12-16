/**
 * SettingsPage Component
 * Application settings and preferences screen
 */
function SettingsPage() {
  return (
    <div className="flex h-full flex-col p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Settings</h1>
      <p className="text-gray-400">Configure application preferences, proxy, SSL, and more</p>
    </div>
  );
}

export default SettingsPage;