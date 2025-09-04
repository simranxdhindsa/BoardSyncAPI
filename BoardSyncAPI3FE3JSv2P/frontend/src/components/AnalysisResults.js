import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Plus, ArrowLeft, RefreshCw, Tag, ChevronDown, ChevronRight, X, ExternalLink } from 'lucide-react';
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
  const [syncedTickets, setSyncedTickets] = useState(new Set());
  const [createdTickets, setCreatedTickets] = useState(new Set());
  
  // Expanded card states
  const [expandedCards, setExpandedCards] = useState({});
  const [ticketDetailModal, setTicketDetailModal] = useState(null);

  if (!analysisData) return null;

  const { analysis, summary } = analysisData;

  // Toggle card expansion
  const toggleCardExpansion = (cardType) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardType]: !prev[cardType]
    }));
  };

  // Show ticket detail modal
  const showTicketDetail = (ticket) => {
    setTicketDetailModal(ticket);
  };

  // Close ticket detail modal
  const closeTicketDetail = () => {
    setTicketDetailModal(null);
  };

  // Determine if ticket is matched, mismatched, or missing
  const getTicketType = (ticket) => {
    if (ticket.asana_status && ticket.youtrack_status) {
      // Has both statuses - either matched or mismatched
      return ticket.asana_status === ticket.youtrack_status ? 'matched' : 'mismatched';
    } else if (ticket.asana_status && !ticket.youtrack_status) {
      // Only has Asana status - missing in YouTrack
      return 'missing';
    }
    return 'unknown';
  };

  // Handle individual ticket sync
  const handleSyncTicket = async (ticketId) => {
    setSyncing(prev => ({ ...prev, [ticketId]: true }));
    
    try {
      await onSync(ticketId);
      setSyncedTickets(prev => new Set([...prev, ticketId]));
      
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

  // Expandable Summary Card Component
  const SummaryCard = ({ title, count, icon: Icon, color, tickets, type }) => {
    const isExpanded = expandedCards[type];
    const hasTickets = tickets && tickets.length > 0;

    return (
      <div className={`glass-panel ${color} border rounded-lg transition-all duration-300`}>
        <div 
          className={`p-4 cursor-pointer ${hasTickets ? 'hover:bg-opacity-80' : ''}`}
          onClick={() => hasTickets && toggleCardExpansion(type)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Icon className="w-6 h-6 mr-2" />
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            </div>
            
            {hasTickets && (
              <div className="flex items-center">
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            )}
          </div>
        </div>

        {isExpanded && hasTickets && (
          <div className="border-t border-opacity-30 p-4 animate-slide-up">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tickets.map((ticket, index) => (
                <div 
                  key={ticket.asana_task?.gid || ticket.gid || index}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => showTicketDetail(ticket)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm mb-1">
                        {ticket.asana_task?.name || ticket.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2">
                        ID: {ticket.asana_task?.gid || ticket.gid}
                      </p>
                      
                      {/* Status indicators */}
                      {ticket.asana_status && ticket.youtrack_status && (
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="status-badge matched text-xs">
                            Asana: {ticket.asana_status}
                          </span>
                          <span className="status-badge mismatched text-xs">
                            YouTrack: {ticket.youtrack_status}
                          </span>
                        </div>
                      )}
                      
                      {/* Tags */}
                      <div className="text-xs">
                        <TagsDisplay tags={ticket.asana_tags || ticket.tags?.map(t => t.name) || []} />
                      </div>
                    </div>
                    
                    <div className="ml-3">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Ticket Detail Modal Component
  const TicketDetailModal = ({ ticket, onClose }) => {
    if (!ticket) return null;

    const ticketId = ticket.asana_task?.gid || ticket.gid;
    const ticketName = ticket.asana_task?.name || ticket.name;
    const ticketType = getTicketType(ticket);
    const isSyncing = syncing[ticketId];
    const isCreating = creating[ticketId];
    const isSynced = syncedTickets.has(ticketId);
    const isCreated = createdTickets.has(ticketId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="glass-panel bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{ticketName}</h2>
                <p className="text-sm text-gray-600">ID: {ticketId}</p>
              </div>
              <button
                onClick={onClose}
                className="glass-panel p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Status Section - Different layouts based on ticket type */}
            {ticketType === 'matched' && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Status - Perfectly Matched</h3>
                <div className="glass-panel bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                    <div className="text-center">
                      <div className="text-sm text-green-700 mb-1">Both Platforms</div>
                      <div className="text-lg font-semibold text-green-900">{ticket.asana_status}</div>
                      <div className="text-xs text-green-600 mt-1">Asana ↔ YouTrack</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ticketType === 'mismatched' && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Mismatch Detected</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-700 mb-1">Asana Status</div>
                    <div className="font-medium text-blue-900">{ticket.asana_status}</div>
                  </div>
                  <div className="glass-panel bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-xs text-orange-700 mb-1">YouTrack Status</div>
                    <div className="font-medium text-orange-900">{ticket.youtrack_status}</div>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 text-center">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Sync required to match statuses
                  </p>
                </div>
              </div>
            )}

            {ticketType === 'missing' && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Missing in YouTrack</h3>
                <div className="glass-panel bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-center">
                    <Plus className="w-6 h-6 text-blue-600 mr-3" />
                    <div className="text-center">
                      <div className="text-sm text-blue-700 mb-1">Asana Status</div>
                      <div className="text-lg font-semibold text-blue-900">{ticket.asana_status || 'Active'}</div>
                      <div className="text-xs text-blue-600 mt-1">Not found in YouTrack</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tags & Subsystem</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Asana Tags:</div>
                  <TagsDisplay tags={ticket.asana_tags || ticket.tags?.map(t => t.name) || []} />
                </div>
                {ticket.youtrack_subsystem && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">YouTrack Subsystem:</div>
                    <span className="text-sm text-gray-700">{ticket.youtrack_subsystem}</span>
                    {ticket.tag_mismatch && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        Mismatch Detected
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details */}
            {ticket.asana_task?.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <div className="glass-panel bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{ticket.asana_task.notes}</p>
                </div>
              </div>
            )}

            {/* Section Info for Missing Tickets */}
            {ticket.memberships && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Project Section</h3>
                <div className="glass-panel bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    {ticket.memberships[0]?.section?.name || 'No Section'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions - Based on ticket type */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-end space-x-3">
                {/* Matched tickets - No action buttons, just status display */}
                {ticketType === 'matched' && (
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Perfectly Synchronized
                  </div>
                )}

                {/* Mismatched tickets - Sync button only */}
                {ticketType === 'mismatched' && (
                  <div>
                    {isSynced ? (
                      <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Synced Successfully!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSyncTicket(ticketId)}
                        disabled={isSyncing}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Status
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Missing tickets - Create button only */}
                {ticketType === 'missing' && (
                  <div>
                    {isCreated ? (
                      <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Created in YouTrack!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCreateTicket(ticket)}
                        disabled={isCreating}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                      >
                        {isCreating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Create in YouTrack
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="glass-panel border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* ApyHub Header */}
      <nav className="glass-panel border-b border-gray-200 bg-white px-6 py-4" style={{ borderRadius: '0' }}>
        <div className="flex items-center justify-between">
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
          
          <div className="flex items-center space-x-6">
            <button 
              onClick={onBack}
              className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
            
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
          <p className="text-gray-600">Review mismatches, sync tickets, and manage tags. Click on cards to view ticket details.</p>
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

        {/* Enhanced Summary Cards - Clean Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <SummaryCard
            title="Matched"
            count={summary.matched}
            icon={CheckCircle}
            color="bg-green-50 border-green-200 text-green-900"
            tickets={analysis.matched || []}
            type="matched"
          />

          <SummaryCard
            title="Mismatched"
            count={summary.mismatched}
            icon={Clock}
            color="bg-yellow-50 border-yellow-200 text-yellow-900"
            tickets={analysis.mismatched || []}
            type="mismatched"
          />

          <SummaryCard
            title="Missing"
            count={summary.missing_youtrack}
            icon={Plus}
            color="bg-blue-50 border-blue-200 text-blue-900"
            tickets={analysis.missing_youtrack || []}
            type="missing"
          />

          <SummaryCard
            title="Tag Issues"
            count={summary.tag_mismatches || 0}
            icon={Tag}
            color="bg-purple-50 border-purple-200 text-purple-900"
            tickets={analysis.tag_mismatches || []}
            type="tag_issues"
          />

          <SummaryCard
            title="Sync Rate"
            count={`${Math.round((summary.matched / (summary.matched + summary.mismatched)) * 100) || 0}%`}
            icon={RefreshCw}
            color="bg-indigo-50 border-indigo-200 text-indigo-900"
            tickets={[]}
            type="sync_rate"
          />
        </div>

        {/* Mismatched Tickets Section */}
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

        {/* Missing Tickets Section */}
        {summary.missing_youtrack > 0 && (
          <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Missing in YouTrack ({summary.missing_youtrack})
              </h2>
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

        {/* Smart Re-Analysis Panel */}
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

        {/* Display Only Sections */}
        {(summary.ready_for_stage > 0 || summary.findings_tickets > 0) && (
          <div className="glass-panel bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Display Only Sections</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {summary.ready_for_stage > 0 && (
                <SummaryCard
                  title={`Ready for Stage (${summary.ready_for_stage})`}
                  count=""
                  icon={CheckCircle}
                  color="bg-green-50 border-green-200 text-green-900"
                  tickets={analysis.ready_for_stage || []}
                  type="ready_for_stage"
                />
              )}

              {summary.findings_tickets > 0 && (
                <SummaryCard
                  title={`Findings (${summary.findings_tickets})`}
                  count=""
                  icon={AlertTriangle}
                  color="bg-orange-50 border-orange-200 text-orange-900"
                  tickets={analysis.findings_tickets || []}
                  type="findings_tickets"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {ticketDetailModal && (
        <TicketDetailModal 
          ticket={ticketDetailModal} 
          onClose={closeTicketDetail}
        />
      )}
    </div>
  );
};

export default AnalysisResults;