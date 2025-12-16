/**
 * LoadingScreen Component
 * Displays a full-screen loading indicator while lazy-loaded components are being fetched
 */
function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-dark-bg">
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-teal p-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full text-dark-bg"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white">WireSniff</span>
        </div>

        {/* Loading spinner */}
        <div className="spinner" />

        {/* Loading text */}
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;