import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AnalysisResults from './components/AnalysisResults';
import ThreeBackground from './components/ThreeBackground';
import { analyzeTickets, syncSingleTicket, createSingleTicket, createMissingTickets } from './services/api';
import './styles/glass-theme.css';

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

  const handleSync = async (ticketId) => {
    setLoading(true);
    try {
      await syncSingleTicket(ticketId);
      await refreshAnalysis();
    } catch (error) {
      throw new Error('Sync failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSingle = async (taskId) => {
    console.log('Creating single ticket for task ID:', taskId);
    setLoading(true);
    try {
      await createSingleTicket(taskId);
      await refreshAnalysis();
    } catch (error) {
      console.error('Create single failed:', error);
      throw new Error('Create failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMissing = async () => {
    setLoading(true);
    try {
      await createMissingTickets();
      await refreshAnalysis();
    } catch (error) {
      throw new Error('Bulk create failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalysis = async () => {
    try {
      const data = await analyzeTickets();
      setAnalysisData(data);
    } catch (error) {
      console.error('Failed to refresh analysis:', error);
    }
  };

  return (
    <div className="App" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 3D Background Layer - Behind blur separator */}
      <div className="three-background-container">
        <ThreeBackground 
          currentView={currentView}
          analysisData={analysisData}
          selectedColumn={selectedColumn}
          isLoading={loading}
        />
      </div>
      
      {/* Blur Separator Layer - Creates depth separation between 3D and UI */}
      <div className="blur-separator" />
      
      {/* Main Application Content - Glass themed dashboard with enhanced layering */}
      <div className="main-content-layer">
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
      
      {/* Funny Credit Footer */}
      <div className="credit-footer">
        Made with Frustration By Simran • Powered by Three.js
      </div>
    </div>
  );
}

export default App;