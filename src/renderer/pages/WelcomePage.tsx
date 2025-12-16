import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useDatabase } from '../providers/DatabaseProvider';

/**
 * WelcomePage Component
 * Home screen with quick actions and recent activity
 */
function WelcomePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { collections, history } = useDatabase();

  const recentHistory = history.slice(0, 5);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome{profile?.fullName ? `, ${profile.fullName}` : ''}!
        </h1>
        <p className="mt-2 text-gray-400">
          Start building and testing your APIs with WireSniff
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          title="New Request"
          description="Create a new HTTP request"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          onClick={() => navigate('/workspace')}
          color="blue"
        />
        <QuickActionCard
          title="New Collection"
          description="Organize your requests"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          onClick={() => navigate('/collections/new')}
          color="orange"
        />
        <QuickActionCard
          title="Import"
          description="Import from Postman, OpenAPI, or cURL"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
          onClick={() => navigate('/settings/import')}
          color="teal"
        />
        <QuickActionCard
          title="WebSocket"
          description="Test WebSocket connections"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
          onClick={() => navigate('/workspace?type=websocket')}
          color="purple"
        />
      </div>

      {/* Content grid */}
      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent requests */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Requests</h2>
            <button
              onClick={() => navigate('/inspector')}
              className="text-sm text-accent-blue hover:underline"
            >
              View all
            </button>
          </div>
          <div className="card-body">
            {recentHistory.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2">No recent requests</p>
                <p className="text-sm">Your request history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/workspace?history=${entry.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-dark-border"
                  >
                    <span className={`method-${entry.method.toLowerCase()} text-xs px-2 py-0.5`}>
                      {entry.method}
                    </span>
                    <span className="flex-1 truncate text-sm text-gray-300">{entry.url}</span>
                    <span className={`text-sm ${entry.status >= 200 && entry.status < 300 ? 'text-success' : 'text-error'}`}>
                      {entry.status}
                    </span>
                    <span className="text-xs text-gray-500">{entry.duration}ms</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collections */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Collections</h2>
            <button
              onClick={() => navigate('/collections')}
              className="text-sm text-accent-blue hover:underline"
            >
              View all
            </button>
          </div>
          <div className="card-body">
            {collections.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="mt-2">No collections yet</p>
                <button
                  onClick={() => navigate('/collections/new')}
                  className="mt-2 text-sm text-accent-blue hover:underline"
                >
                  Create your first collection
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.slice(0, 5).map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => navigate(`/collections/${collection.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-dark-border"
                  >
                    <svg className="h-5 w-5 text-accent-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="flex-1 text-sm text-gray-300">{collection.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade banner for free users */}
      {user && profile?.subscriptionTier === 'free' && (
        <div className="mt-8 rounded-xl bg-gradient-to-r from-accent-blue/20 to-accent-teal/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
              <p className="mt-1 text-sm text-gray-300">
                Get cloud sync, team collaboration, and unlimited history
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/subscription')}
              className="btn-primary"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick action card component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'blue' | 'orange' | 'teal' | 'purple';
}

function QuickActionCard({ title, description, icon, onClick, color }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'from-accent-blue/20 to-accent-blue/5 hover:from-accent-blue/30 hover:to-accent-blue/10 text-accent-blue',
    orange: 'from-accent-orange/20 to-accent-orange/5 hover:from-accent-orange/30 hover:to-accent-orange/10 text-accent-orange',
    teal: 'from-accent-teal/20 to-accent-teal/5 hover:from-accent-teal/30 hover:to-accent-teal/10 text-accent-teal',
    purple: 'from-accent-purple/20 to-accent-purple/5 hover:from-accent-purple/30 hover:to-accent-purple/10 text-accent-purple',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start rounded-xl bg-gradient-to-br p-4 transition-all ${colorClasses[color]}`}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </button>
  );
}

export default WelcomePage;