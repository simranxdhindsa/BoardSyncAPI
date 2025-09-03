import React from 'react';
import { RefreshCw, Zap, Activity } from 'lucide-react';

const Dashboard = ({ selectedColumn, onColumnSelect, onAnalyze, loading }) => {
  const columns = [
    { 
      value: 'backlog', 
      label: 'Backlog only', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    },
    { 
      value: 'in_progress', 
      label: 'In Progress only', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    },
    { 
      value: 'dev', 
      label: 'DEV only', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    },
    { 
      value: 'stage', 
      label: 'STAGE only', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    },
    { 
      value: 'blocked', 
      label: 'Blocked only', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    },
    { 
      value: 'ready_for_stage', 
      label: 'Ready for Stage', 
      color: 'hover:bg-blue-50 hover:border-blue-200',
      displayOnly: true
    },
    { 
      value: 'findings', 
      label: 'Findings', 
      color: 'hover:bg-blue-50 hover:border-blue-200',
      displayOnly: true
    },
    { 
      value: 'all_syncable', 
      label: 'All Syncable', 
      color: 'hover:bg-blue-50 hover:border-blue-200'
    }
  ];

  const selectedColumnData = columns.find(col => col.value === selectedColumn);

  return (
    <div className="min-h-screen bg-white">
      {/* ApyHub Header */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* ApyHub Logo */}
            <div className="flex items-center">
              <img 
                src="https://apyhub.com/logo.svg" 
                alt="ApyHub" 
                className="h-8 w-8"
              />
              <span className="ml-3 text-xl font-semibold text-gray-900">
                Asana-YouTrack Sync
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ticket Synchronization
          </h1>
          <p className="text-gray-600">
            Select a column to analyze and sync tickets between Asana and YouTrack. Now with tag/subsystem support.
          </p>
        </div>

        {/* Column Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-6">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Select Column</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {columns.map((column) => (
              <div
                key={column.value}
                onClick={() => onColumnSelect(column.value)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedColumn === column.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{column.label}</span>
                  {column.displayOnly && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                      Display Only
                    </span>
                  )}
                </div>
                
                {selectedColumn === column.value && (
                  <div className="mt-2">
                    <div className="w-full h-1 bg-blue-500 rounded"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <button
            onClick={onAnalyze}
            disabled={!selectedColumn || loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing {selectedColumnData?.label}...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Analyze {selectedColumn ? selectedColumnData?.label : 'Column'}
              </>
            )}
          </button>

          {selectedColumn && !loading && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-blue-800 text-sm text-center">
                Ready to analyze <strong>{selectedColumnData?.label}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Enhanced Asana-YouTrack Sync • v3.0 • Tag Support • Individual Actions
        </div>
      </div>
    </div>
  );
};

export default Dashboard;