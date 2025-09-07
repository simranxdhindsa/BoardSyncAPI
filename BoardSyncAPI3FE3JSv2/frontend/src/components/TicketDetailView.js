import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Tag, EyeOff, Eye, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getTicketsByType, ignoreTicket, unignoreTicket } from '../services/api';

const TicketDetailView = ({ type, column, onBack, onSync, onCreateSingle }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [ignoredTickets, setIgnoredTickets] = useState(new Set());

  useEffect(() => {
    loadTickets();
  }, [type, column]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTicketsByType(type, column);
      setTickets(response.tickets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIgnoreTicket = async (ticketId) => {
    setActionLoading(prev => ({ ...prev, [`ignore_${ticketId}`]: true }));
    try {
      await ignoreTicket(ticketId);
      setIgnoredTickets(prev => new Set([...prev, ticketId]));
      
      // Remove from current view after a brief delay
      setTimeout(() => {
        setTickets(prev => prev.filter(ticket => 
          (ticket.gid || ticket.asana_task?.gid || ticket.id) !== ticketId
        ));
      }, 1000);
    } catch (err) {
      console.error('Failed to ignore ticket:', err);
      alert('Failed to ignore ticket: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`ignore_${ticketId}`]: false }));
    }
  };

  const handleUnignoreTicket = async (ticketId) => {
    setActionLoading(prev => ({ ...prev, [`unignore_${ticketId}`]: true }));
    try {
      await unignoreTicket(ticketId);
      setIgnoredTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
      
      // Remove from ignored view
      if (type === 'ignored') {
        setTickets(prev => prev.filter(id => id !== ticketId));
      }
    } catch (err) {
      console.error('Failed to unignore ticket:', err);
      alert('Failed to unignore ticket: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`unignore_${ticketId}`]: false }));
    }
  };

  const handleSyncTicket = async (ticketId) => {
    setActionLoading(prev => ({ ...prev, [`sync_${ticketId}`]: true }));
    try {
      await onSync(ticketId);
      // Optionally remove from mismatched view or reload
      setTimeout(loadTickets, 1000);
    } catch (err) {
      console.error('Failed to sync ticket:', err);
      alert('Failed to sync ticket: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`sync_${ticketId}`]: false }));
    }
  };

  const handleCreateTicket = async (taskId) => {
    setActionLoading(prev => ({ ...prev, [`create_${taskId}`]: true }));
    try {
      await onCreateSingle(taskId);
      // Optionally remove from missing view or reload
      setTimeout(loadTickets, 1000);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      alert('Failed to create ticket: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`create_${taskId}`]: false }));
    }
  };

  const getTypeInfo = () => {
    const typeConfig = {
      matched: {
        title: 'Matched Tickets',
        description: 'Tickets that are synchronized between Asana and YouTrack',
        icon: CheckCircle,
        color: 'green'
      },
      mismatched: {
        title: 'Mismatched Tickets',
        description: 'Tickets with different statuses between Asana and YouTrack',
        icon: Clock,
        color: 'yellow'
      },
      missing: {
        title: 'Missing Tickets',
        description: 'Tickets that exist in Asana but not in YouTrack',
        icon: Plus,
        color: 'blue'
      },
      ignored: {
        title: 'Ignored Tickets',
        description: 'Tickets that are excluded from automatic synchronization',
        icon: EyeOff,
        color: 'purple'
      },
      findings: {
        title: 'Findings Tickets',
        description: 'Display-only tickets in the Findings column',
        icon: AlertTriangle,
        color: 'orange'
      },
      ready_for_stage: {
        title: 'Ready for Stage',
        description: 'Display-only tickets ready for staging',
        icon: CheckCircle,
        color: 'green'
      },
      blocked: {
        title: 'Blocked Tickets',
        description: 'Tickets that are currently blocked',
        icon: Clock,
        color: 'red'
      },
      orphaned: {
        title: 'Orphaned Tickets',
        description: 'YouTrack tickets without corresponding Asana tasks',
        icon: AlertTriangle,
        color: 'gray'
      }
    };
    
    return typeConfig[type] || typeConfig.matched;
  };

  const renderTicketCard = (ticket, index) => {
    // Handle different ticket structures
    const ticketId = ticket.gid || ticket.asana_task?.gid || ticket.id || ticket;
    const ticketName = ticket.name || ticket.asana_task?.name || ticket.summary || ticketId;
    const isIgnored = ignoredTickets.has(ticketId);
    
    // Handle ignored tickets (which are just IDs)
    if (type === 'ignored' && typeof ticket === 'string') {
      return (
        <div key={ticket} className="glass-panel border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Ticket ID: {ticket}</h3>
              <p className="text-sm text-gray-600">Permanently ignored from sync</p>
            </div>
            <button
              onClick={() => handleUnignoreTicket(ticket)}
              disabled={actionLoading[`unignore_${ticket}`]}
              className="bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition-colors disabled:opacity-50 flex items-center"
            >
              {actionLoading[`unignore_${ticket}`] ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Remove from Ignored
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={ticketId} className="glass-panel border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 mb-1">{ticketName}</h3>
            <p className="text-sm text-gray-600">ID: {ticketId}</p>
            
            {/* Show section info if available */}
            {ticket.memberships?.[0]?.section?.name && (
              <p className="text-sm text-gray-500">
                Section: {ticket.memberships[0].section.name}
              </p>
            )}
            
            {/* Show status comparison for mismatched tickets */}
            {type === 'mismatched' && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="status-badge matched text-xs">
                    Asana: {ticket.asana_status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="status-badge mismatched text-xs">
                    YouTrack: {ticket.youtrack_status}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col space-y-2 ml-4">
            {type === 'mismatched' && (
              <button
                onClick={() => handleSyncTicket(ticketId)}
                disabled={actionLoading[`sync_${ticketId}`]}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {actionLoading[`sync_${ticketId}`] ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Sync'
                )}
              </button>
            )}
            
            {type === 'missing' && (
              <button
                onClick={() => handleCreateTicket(ticketId)}
                disabled={actionLoading[`create_${ticketId}`]}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {actionLoading[`create_${ticketId}`] ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 mr-1" />
                    Create
                  </>
                )}
              </button>
            )}
            
            {type !== 'ignored' && (
              <button
                onClick={() => handleIgnoreTicket(ticketId)}
                disabled={actionLoading[`ignore_${ticketId}`] || isIgnored}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center"
              >
                {actionLoading[`ignore_${ticketId}`] ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Ignoring...
                  </>
                ) : isIgnored ? (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Ignored!
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Ignore
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Show tags if available */}
        {(ticket.tags || ticket.asana_tags) && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Tags:</div>
            <div className="flex flex-wrap gap-1">
              {(ticket.tags || ticket.asana_tags || []).map((tag, tagIndex) => (
                <span key={tagIndex} className="tag-glass inline-flex items-center">
                  <Tag className="w-3 h-3 mr-1" />
                  {typeof tag === 'string' ? tag : tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const typeInfo = getTypeInfo();
  const IconComponent = typeInfo.icon;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading {typeInfo.title.toLowerCase()}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="glass-panel border-b border-gray-200 bg-white px-6 py-4" style={{ borderRadius: '0' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={onBack}
              className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Results
            </button>
            
            <div className="flex items-center">
              <IconComponent className={`w-6 h-6 mr-2 text-${typeInfo.color}-600`} />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{typeInfo.title}</h1>
                <p className="text-sm text-gray-600">{typeInfo.description}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={loadTickets}
            disabled={loading}
            className="flex items-center bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">Error loading tickets: {error}</p>
            </div>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="text-center py-12">
            <IconComponent className={`w-16 h-16 mx-auto text-${typeInfo.color}-400 mb-4`} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {typeInfo.title.toLowerCase()} found
            </h3>
            <p className="text-gray-600">
              {type === 'ignored' && 'No tickets are currently being ignored.'}
              {type === 'matched' && 'All tickets are either mismatched or missing.'}
              {type === 'mismatched' && 'All tickets are properly synchronized.'}
              {type === 'missing' && 'All Asana tickets already exist in YouTrack.'}
              {!['ignored', 'matched', 'mismatched', 'missing'].includes(type) && 'No tickets found for this category.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {typeInfo.title} ({tickets.length})
              </h2>
              <p className="text-gray-600">{typeInfo.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket, index) => renderTicketCard(ticket, index))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketDetailView;
            