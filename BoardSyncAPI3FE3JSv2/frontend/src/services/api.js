const API_BASE =
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_API_URL || 'https://boardsyncapi.onrender.com'
    : 'http://localhost:8080';

export const analyzeTickets = async (columnFilter = '') => {
  let url = `${API_BASE}/analyze`;
  if (columnFilter) {
    url += `?column=${encodeURIComponent(columnFilter)}`;
  }
  
  console.log('Analyzing tickets with column filter:', columnFilter);
  console.log('API URL:', url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.status}`);
  }
  const result = await response.json();
  
  console.log('Analysis result:', result);
  return result;
};

export const syncTickets = async (tickets) => {
  const response = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tickets),
  });
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
  return response.json();
};

export const syncSingleTicket = async (ticketId) => {
  return syncTickets([{ ticket_id: ticketId, action: 'sync' }]);
};

export const createMissingTickets = async () => {
  const response = await fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Create failed: ${response.status}`);
  }
  return response.json();
};

export const createSingleTicket = async (taskId) => {
  const response = await fetch(`${API_BASE}/create-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  });
  if (!response.ok) {
    throw new Error(`Single create failed: ${response.status}`);
  }
  return response.json();
};

export const deleteTickets = async (ticketIds, source) => {
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    throw new Error('ticketIds must be a non-empty array');
  }
  
  if (!['asana', 'youtrack', 'both'].includes(source)) {
    throw new Error('source must be one of: asana, youtrack, both');
  }

  const response = await fetch(`${API_BASE}/delete-tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_ids: ticketIds,
      source: source
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Delete failed with status: ${response.status}`
    );
  }
  
  return response.json();
};

export const getAutoSyncStatus = async () => {
  const response = await fetch(`${API_BASE}/auto-sync`);
  if (!response.ok) {
    throw new Error(`Auto-sync status failed: ${response.status}`);
  }
  return response.json();
};

export const startAutoSync = async (interval = 15) => {
  const response = await fetch(`${API_BASE}/auto-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', interval }),
  });
  if (!response.ok) {
    throw new Error(`Start auto-sync failed: ${response.status}`);
  }
  return response.json();
};

export const stopAutoSync = async () => {
  const response = await fetch(`${API_BASE}/auto-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop' }),
  });
  if (!response.ok) {
    throw new Error(`Stop auto-sync failed: ${response.status}`);
  }
  return response.json();
};

export const getAutoCreateStatus = async () => {
  const response = await fetch(`${API_BASE}/auto-create`);
  if (!response.ok) {
    throw new Error(`Auto-create status failed: ${response.status}`);
  }
  return response.json();
};

export const startAutoCreate = async (interval = 15) => {
  const response = await fetch(`${API_BASE}/auto-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', interval }),
  });
  if (!response.ok) {
    throw new Error(`Start auto-create failed: ${response.status}`);
  }
  return response.json();
};

export const stopAutoCreate = async () => {
  const response = await fetch(`${API_BASE}/auto-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop' }),
  });
  if (!response.ok) {
    throw new Error(`Stop auto-create failed: ${response.status}`);
  }
  return response.json();
};

// FIXED: Get tickets by type with proper column parameter passing
export const getTicketsByType = async (type, column = '') => {
  const params = new URLSearchParams({ type });
  if (column) {
    params.append('column', column);
  }
  
  console.log('Getting tickets by type:', type, 'for column:', column); // DEBUG
  
  const response = await fetch(`${API_BASE}/tickets?${params}`);
  if (!response.ok) {
    throw new Error(`Get tickets failed: ${response.status}`);
  }
  const result = await response.json();
  
  console.log('Get tickets result:', result); // DEBUG
  return result;
};

export const ignoreTicket = async (ticketId, type = 'forever') => {
  const response = await fetch(`${API_BASE}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      ticket_id: ticketId, 
      action: 'add', 
      type 
    }),
  });
  if (!response.ok) {
    throw new Error(`Ignore ticket failed: ${response.status}`);
  }
  return response.json();
};

export const unignoreTicket = async (ticketId, type = 'forever') => {
  const response = await fetch(`${API_BASE}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      ticket_id: ticketId, 
      action: 'remove', 
      type 
    }),
  });
  if (!response.ok) {
    throw new Error(`Unignore ticket failed: ${response.status}`);
  }
  return response.json();
};

export const getIgnoredTickets = async () => {
  const response = await fetch(`${API_BASE}/ignore`);
  if (!response.ok) {
    throw new Error(`Get ignored tickets failed: ${response.status}`);
  }
  return response.json();
};

export const getHealth = async () => {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
};

export const getStatus = async () => {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`);
  }
  return response.json();
};