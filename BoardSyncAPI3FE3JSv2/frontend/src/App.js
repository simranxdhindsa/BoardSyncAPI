import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AnalysisResults from './components/AnalysisResults';
import NavBar from './components/NavBar';
import LuxuryBackground from './components/Background'; // Updated import
import { analyzeTickets, syncSingleTicket, createSingleTicket, createMissingTickets } from './services/api';
import './styles/glass-theme.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [navLeft, setNavLeft] = useState(null);
  const [navRight, setNavRight] = useState(null);

  const handleColumnSelect = (column) => {
    setSelectedColumn(column);
  };

const handleAnalyze = async () => {
  if (!selectedColumn) return;

  setLoading(true);
  
  try {
    // FIXED: Pass the selectedColumn to the API call
    const data = await analyzeTickets(selectedColumn);
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
    <div className="App" style={{ 
      position: 'relative', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Luxury Interactive Background - Updated component */}
      <div className="luxury-background-container">
        <LuxuryBackground 
          currentView={currentView}
          analysisData={analysisData}
          selectedColumn={selectedColumn}
          isLoading={loading}
        />
      </div>
      
      {/* Blur Separator Layer - Creates depth separation between background and UI */}
      <div className="luxury-canvas-blur-separator" />
      
      {/* Main Application Content - Glass themed dashboard with enhanced layering */}
      <div className="luxury-canvas-content-layer" style={{ flex: '1', paddingBottom: '80px' }}>
        <NavBar
          title={currentView === 'dashboard' ? 'Dashboard' : 'Analysis Results'}
          showBack={currentView !== 'dashboard'}
          onBack={handleBackToDashboard}
          leftContent={navLeft ?? (currentView === 'dashboard' ? (
            <div className="flex items-center">
              <img 
                src="https://apyhub.com/logo.svg" 
                alt="ApyHub" 
                className="h-8 w-8 apyhub-logo"
              />
              <div className="ml-3 text-xl font-semibold text-gray-900">Asana-YouTrack Sync</div>
            </div>
          ) : null)}
          rightContent={navRight ?? (currentView === 'dashboard' ? (
            <div className="flex items-center space-x-6">
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>Connected</span>
              </div>
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
          ) : null)}
        >
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
              setNavBarSlots={(left, right) => { setNavLeft(left); setNavRight(right); }}
            />
          )}
        </NavBar>
      </div>
      
      <footer className="app-footer">
        <div className="credit-footer">
          Made with Frustration By Simran • Powered by GoLang
        </div>
      </footer>
    </div>
  );
}

export default App;