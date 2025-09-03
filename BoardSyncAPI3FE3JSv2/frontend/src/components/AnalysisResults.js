import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Plus, ArrowLeft, RefreshCw, Tag } from 'lucide-react';
import ReAnalysisPanel from './ReAnalysisPanel';

const AnalysisResults = ({ 
  analysisData, 
  selectedColumn, 
  onBack, 
  onSync, 
  onCreateSingle, 
  onCreateMissing, 
  onReAnalyze, 
  lastAction, 
  loading 
}) => {
  const [syncing, setSyncing] = useState({});
  const [creating, setCreating] = useState({});
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [createAllLoading, setCreateAllLoading] = useState(false);
  const [syncedTickets, setSyncedTickets] = useState(new Set());
  const [createdTickets, setCreatedTickets] = useState(new Set());

  if (!analysisData) return null;

  const { analysis, summary } = analysisData;

  // Handle individual ticket sync
  const handleSyncTicket = async (ticketId) => {
    setSyncing(prev => ({ ...prev, [ticketId]: true }));
    
    try {
      await onSync(ticketId);
      setSyncedTickets(prev => new Set([...prev, ticketId]));
      
      // Show success for 2 seconds
      setTimeout(() => {
        setSyncedTickets(prev => {
          const newSet = new Set(prev);
          newSet.delete(ticketId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(prev => ({ ...prev, [ticketId]: false }));
    }
  };

  // Handle sync all
  const handleSyncAll = async () => {
    if (!analysis.mismatched || analysis.mismatched.length === 0) return;
    
    setSyncAllLoading(true);
    
    try {
      // Sync all mismatched tickets
      for (const ticket of analysis.mismatched) {
        await onSync(ticket.asana_task.gid);
      }
    } catch (error) {
      console.error('Some tickets failed to sync');
    } finally {
      setSyncAllLoading(false);
    }
  };

  // Handle individual ticket creation
  const handleCreateTicket = async (task, index) => {
    const taskId = task.gid;
    setCreating(prev => ({ ...prev, [taskId]: true }));
    
    try {
      await onCreateSingle(taskId);
      setCreatedTickets(prev => new Set([...prev, taskId]));
      
      // Show success for 2 seconds
      setTimeout(() => {
        setCreatedTickets(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Create failed:', error);
    } finally {
      setCreating(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Handle create all
  const handleCreateAll = async () => {
    setCreateAllLoading(true);
    
    try {
      await onCreateMissing();
    } catch (error) {
      console.error('Failed to create tickets:', error);
    } finally {
      setCreateAllLoading(false);
    }
  };

  // Display tags component
  const TagsDisplay = ({ tags }) => {
    if (!tags || tags.length === 0) return <span className="text-gray-400">No tags</span>;
    
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, index) => (
          <span key={index} className="tag-glass inline-flex items-center">
            <Tag className="w-3 h-3 mr-1" />
            {tag}
          </span>
        ))}
      </div>
    );
  };

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
              <span className="ml-3 text-xl font-semibold text-gray-900">
                Analysis Results
              </span>
            </div>
          </div>
          
          {/* Right Side - Ardoise Project + Back Button */}
          <div className="flex items-center space-x-6">
            {/* Back Button */}
            <button 
              onClick={onBack}
              className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
            
            {/* Ardoise Project Info */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">Project name: Ardoise</div>
                <div className="text-xs text-gray-500">Analysis View</div>
              </div>
              <div className="flex items-center">
                <img 
                  src="/assets/ardoise-logo.png" 
                  alt="Ardoise Project" 
                  className="h-10 w-10 rounded-lg shadow-sm"
                  onError={(e) => {
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

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Analysis Results - {selectedColumn.toUpperCase()}
          </h1>
          <p className="text-gray-600">Review mismatches, sync tickets, and manage tags</p>
        </div>

        {/* High Priority Alerts */}
        {summary.findings_alerts > 0 && (
          <div className="glass-panel bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
              <h2 className="text-xl font-semibold text-red-900">
                High Priority Alerts ({summary.findings_alerts})
              </h2>
            </div>
            <div className="glass-panel bg-red-100 border border-red-300 rounded-lg p-4">
              <p className="text-red-800 font-medium">
                Tickets found in Findings (Asana) but still active in YouTrack
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards with Glass Theme */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="glass-panel bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-green-900">Matched</h3>
                <p className="text-2xl font-bold text-green-600">{summary.matched}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="w-6 h-6 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900">Mismatched</h3>
                <p className="text-2xl font-bold text-yellow-600">{summary.mismatched}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Plus className="w-6 h-6 text-blue-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">Missing</h3>
                <p className="text-2xl font-bold text-blue-600">{summary.missing_youtrack}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center">
              <Tag className="w-6 h-6 text-purple-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-purple-900">Tag Issues</h3>
                <p className="text-2xl font-bold text-purple-600">{summary.tag_mismatches || 0}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center">
              <RefreshCw className="w-6 h-6 text-indigo-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-indigo-900">Sync Rate</h3>
                <p className="text-2xl font-bold text-indigo-600">
                  {Math.round((summary.matched / (summary.matched + summary.mismatched)) * 100) || 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Re-Analysis Panel - Show after successful actions */}
        {lastAction && (
          <ReAnalysisPanel
            selectedColumn={selectedColumn}
            lastActionType={lastAction.type}
            lastActionCount={lastAction.count}
            onReAnalyze={onReAnalyze}
            onBackToDashboard={onBack}
            loading={loading}
          />
        )}

        {/* Mismatched Tickets */}
        {summary.mismatched > 0 && (
          <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Mismatched Tickets ({summary.mismatched})
              </h2>
              <button 
                onClick={handleSyncAll}
                disabled={syncAllLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {syncAllLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing All...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync All
                  </>
                )}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-gray-700">Ticket Name</th>
                    <th className="text-left p-3 font-medium text-gray-700">Status</th>
                    <th className="text-left p-3 font-medium text-gray-700">Tags/Subsystem</th>
                    <th className="text-left p-3 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.mismatched && analysis.mismatched.map((ticket) => {
                    const ticketId = ticket.asana_task.gid;
                    const isSyncing = syncing[ticketId];
                    const isSynced = syncedTickets.has(ticketId);
                    
                    return (
                      <tr key={ticketId} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{ticket.asana_task.name}</div>
                          <div className="text-sm text-gray-500">ID: {ticket.asana_task.gid}</div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="status-badge matched">
                                Asana: {ticket.asana_status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="status-badge mismatched">
                                YouTrack: {ticket.youtrack_status}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-2">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Asana Tags:</div>
                              <TagsDisplay tags={ticket.asana_tags} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">YouTrack Subsystem:</div>
                              <span className="text-sm text-gray-700">
                                {ticket.youtrack_subsystem || 'None'}
                              </span>
                              {ticket.tag_mismatch && (
                                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded">
                                  Mismatch
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex space-x-2">
                            {isSynced ? (
                              <div className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Synced!
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncTicket(ticketId)}
                                disabled={isSyncing}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                              >
                                {isSyncing ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    Syncing...
                                  </>
                                ) : (
                                  'Sync'
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Missing Tickets */}
        {summary.missing_youtrack > 0 && (
          <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Missing in YouTrack ({summary.missing_youtrack})
              </h2>
              <button 
                onClick={handleCreateAll}
                disabled={createAllLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
              >
                {createAllLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating All...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create All
                  </>
                )}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.missing_youtrack && analysis.missing_youtrack.map((task, index) => {
                const taskId = task.gid;
                const isCreating = creating[taskId];
                const isCreated = createdTickets.has(taskId);
                
                return (
                  <div key={taskId} className="glass-panel border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-medium text-gray-900 mb-2">{task.name}</h3>
                    <div className="text-sm text-gray-600 mb-2">
                      Section: {task.memberships?.[0]?.section?.name || 'No Section'}
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">Tags:</div>
                      <TagsDisplay tags={task.tags?.map(t => t.name) || []} />
                    </div>
                    
                    {isCreated ? (
                      <div className="w-full bg-green-100 text-green-800 px-3 py-2 rounded text-sm text-center flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Created!
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCreateTicket(task, index)}
                        disabled={isCreating}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {isCreating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Display Only Sections */}
        {(summary.ready_for_stage > 0 || summary.findings_tickets > 0) && (
          <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Display Only Sections</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {summary.ready_for_stage > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    Ready for Stage ({summary.ready_for_stage})
                  </h3>
                  <div className="space-y-2">
                    {analysis.ready_for_stage && analysis.ready_for_stage.map((task) => (
                      <div key={task.gid} className="glass-panel bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="font-medium text-gray-900">{task.name}</p>
                        <div className="mt-1">
                          <TagsDisplay tags={task.tags?.map(t => t.name) || []} />
                        </div>
                        <p className="text-sm text-green-700 mt-1">Display only - not synced</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.findings_tickets > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    Findings ({summary.findings_tickets})
                  </h3>
                  <div className="space-y-2">
                    {analysis.findings_tickets && analysis.findings_tickets.map((task) => (
                      <div key={task.gid} className="glass-panel bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="font-medium text-gray-900">{task.name}</p>
                        <div className="mt-1">
                          <TagsDisplay tags={task.tags?.map(t => t.name) || []} />
                        </div>
                        <p className="text-sm text-orange-700 mt-1">Display only - not synced</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisResults;