import React from 'react';
import { RefreshCw, Zap, Activity } from 'lucide-react';
import FluidText from './FluidText';

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
    <div className="min-h-screen">
      {/* ApyHub Header with Glass Theme + Ardoise Branding */}
      <nav className="glass-panel border-b border-gray-200 bg-white px-6 py-4" style={{ borderRadius: '0' }}>
        <div className="flex items-center justify-between">
          {/* Left Side - ApyHub Logo */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <img 
                src="https://apyhub.com/logo.svg" 
                alt="ApyHub" 
                className="h-8 w-8 apyhub-logo"
              />
              <FluidText className="ml-3 text-xl font-semibold text-gray-900" sensitivity={1.5}>
                Asana-YouTrack Sync
              </FluidText>
            </div>
          </div>
          
          {/* Right Side - Ardoise Project Branding */}
          <div className="flex items-center space-x-6">
            {/* Connection Status */}
            <div className="flex items-center text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>Connected</span>
            </div>
            
            {/* Ardoise Project Info */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">Project name: Ardoise</div>
                <div className="text-xs text-gray-500">Enhanced Dashboard</div>
              </div>
              <div className="flex items-center">
                <img 
                  src="/assets/ardoise-logo.png" 
                  alt="Ardoise Project" 
                  className="h-10 w-10 rounded-lg shadow-sm"
                  onError={(e) => {
                    // Fallback if logo doesn't load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div 
                  className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-lg"
                  style={{ display: 'none' }}
                >
                  A
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header Section with Fluid Text */}
        <div className="mb-8">
          <FluidText className="text-3xl font-bold text-gray-900 mb-2 block" sensitivity={2}>
            Ticket Synchronization
          </FluidText>
          <p className="text-gray-600">
            Select a column to analyze and sync tickets between Asana and YouTrack. Now with tag/subsystem support.
          </p>
        </div>

        {/* Column Selection with Glass Theme */}
        <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6 interactive-element">
          <div className="flex items-center mb-6">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            <FluidText className="text-lg font-semibold text-gray-900" sensitivity={1.2}>
              Select Column
            </FluidText>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {columns.map((column) => (
              <div
                key={column.value}
                onClick={() => onColumnSelect(column.value)}
                className={`glass-panel interactive-element p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedColumn === column.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <FluidText className="font-medium text-gray-900" sensitivity={0.8}>
                    {column.label}
                  </FluidText>
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
            className="interactive-element w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                <FluidText sensitivity={1}>
                  Analyzing {selectedColumnData?.label}...
                </FluidText>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                <FluidText sensitivity={1}>
                  Analyze {selectedColumn ? selectedColumnData?.label : 'Column'}
                </FluidText>
              </>
            )}
          </button>

          {selectedColumn && !loading && (
            <div className="glass-panel mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 pointer-events-none">
              <p className="text-blue-800 text-sm text-center select-none">
                Ready to analyze <strong>{selectedColumnData?.label}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <FluidText sensitivity={0.5}>
            Enhanced Asana-YouTrack Sync • v4.0 • 3D Dashboard • Tag Support • Individual Actions
          </FluidText>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;