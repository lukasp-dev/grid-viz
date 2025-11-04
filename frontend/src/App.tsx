import { useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiTest } from './components/ApiTest'
import ComparisonView from './components/ComparisonView'
import 'reactflow/dist/style.css'

const queryClient = new QueryClient()

type ViewMode = 'test' | 'comparison'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('comparison')

  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <div className="w-full h-screen bg-gray-50">
          {/* Modern Navigation */}
          <nav className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Grid Visualization</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('comparison')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'comparison'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Comparison
                </button>
                <button
                  onClick={() => setViewMode('test')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'test'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  API Test
                </button>
              </div>
            </div>
          </nav>

          {/* Content */}
          {viewMode === 'test' && <ApiTest />}
          {viewMode === 'comparison' && <ComparisonView />}
        </div>
      </ReactFlowProvider>
    </QueryClientProvider>
  )
}

export default App
