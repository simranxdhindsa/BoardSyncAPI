const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'https://boardsyncapi.onrender.com';

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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tickets)
  });
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
  return response.json();
};

// NEW: Individual ticket sync
export const syncSingleTicket = async (ticketId) => {
  return syncTickets([{
    ticket_id: ticketId,
    action: 'sync'
  }]);
};

export const createMissingTickets = async () => {
  const response = await fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Create failed: ${response.status}`);
  }
  return response.json();
};

// NEW: Individual ticket creation
export const createSingleTicket = async (taskId) => {
  const response = await fetch(`${API_BASE}/create-single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task_id: taskId })
  });
  if (!response.ok) {
    throw new Error(`Single create failed: ${response.status}`);
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