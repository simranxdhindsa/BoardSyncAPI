// Choose API base depending on environment
const API_BASE =
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_API_URL || 'https://boardsyncapi.onrender.com'
    : 'http://localhost:8080';

export const analyzeTickets = async () => {
  const response = await fetch(`${API_BASE}/analyze`);
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.status}`);
  }
  return response.json();
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

// Individual ticket sync
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

// Individual ticket creation
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

// NEW: Auto-sync control
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

// NEW: Auto-create control
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

// NEW: Get tickets by type (for detailed views)
export const getTicketsByType = async (type, column = '') => {
  const params = new URLSearchParams({ type });
  if (column) params.append('column', column);
  
  const response = await fetch(`${API_BASE}/tickets?${params}`);
  if (!response.ok) {
    throw new Error(`Get tickets failed: ${response.status}`);
  }
  return response.json();
};

// NEW: Ignore ticket management
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