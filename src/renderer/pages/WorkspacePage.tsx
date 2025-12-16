/**
 * WorkspacePage Component
 * Main request builder and response viewer workspace
 */
function WorkspacePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Request Builder</h2>
          <p>Build and send HTTP, WebSocket, GraphQL, and SSE requests</p>
        </div>
      </div>
    </div>
  );
}

export default WorkspacePage;