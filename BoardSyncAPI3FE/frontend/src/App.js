import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AnalysisResults from './components/AnalysisResults';
import { analyzeTickets, syncSingleTicket, createSingleTicket, createMissingTickets } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleColumnSelect = (column) => {
    setSelectedColumn(column);
  };

  const handleAnalyze = async () => {
    if (!selectedColumn) return;

    setLoading(true);
    
    try {
      const data = await analyzeTickets();
      setAnalysisData(data);
      setCurrentView('results');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setAnalysisData(null);
  };

  // Enhanced sync with individual ticket support
  const handleSync = async (ticketId) => {
    try {
      await syncSingleTicket(ticketId);
      // Refresh analysis after sync
      await refreshAnalysis();
    } catch (error) {
      throw new Error('Sync failed: ' + error.message);
    }
  };

  // Enhanced create with individual ticket support  
  const handleCreateSingle = async (taskId) => {
    try {
      await createSingleTicket(taskId);
      // Refresh analysis after creation
      await refreshAnalysis();
    } catch (error) {
      throw new Error('Create failed: ' + error.message);
    }
  };

  const handleCreateMissing = async () => {
    try {
      await createMissingTickets();
      // Refresh analysis after bulk creation
      await refreshAnalysis();
    } catch (error) {
      throw new Error('Bulk create failed: ' + error.message);
    }
  };

  // Helper to refresh analysis data
  const refreshAnalysis = async () => {
    try {
      const data = await analyzeTickets();
      setAnalysisData(data);
    } catch (error) {
      console.error('Failed to refresh analysis:', error);
    }
  };

  return (
    <div className="App">
      {currentView === 'dashboard' ? (
        <Dashboard
          selectedColumn={selectedColumn}
          onColumnSelect={handleColumnSelect}
          onAnalyze={handleAnalyze}
          loading={loading}
        />
      ) : (
        <AnalysisResults
          analysisData={analysisData}
          selectedColumn={selectedColumn}
          onBack={handleBackToDashboard}
          onSync={handleSync}
          onCreateSingle={handleCreateSingle}
          onCreateMissing={handleCreateMissing}
        />
      )}
    </div>
  );
}

export default App;