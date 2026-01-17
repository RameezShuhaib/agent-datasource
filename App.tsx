
import React, { useEffect, useState, useCallback } from 'react';
import { Refine } from '@refinedev/core';
import { initDatabase, getTableNames, dropTable } from './sqlDatabase';
import { sqlDataProvider } from './dataProvider';
import { Layout } from './components/Layout';
import { ResourceList } from './components/ResourceList';
import { AddTableModal } from './components/AddTableModal';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);

  const refreshTables = useCallback(async (newlyCreatedTable?: string) => {
    try {
      const foundTables = await getTableNames();
      setTables([...foundTables]);
      
      if (newlyCreatedTable) {
        setActiveResource(newlyCreatedTable);
      } else if (foundTables.length > 0) {
        if (!activeResource || !foundTables.includes(activeResource)) {
          setActiveResource(foundTables[0]);
        }
      } else {
        setActiveResource('');
      }
    } catch (err: any) {
      console.error("Failed to refresh tables:", err);
    }
  }, [activeResource]);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        const found = await getTableNames();
        setTables(found);
        if (found.length > 0) setActiveResource(found[0]);
        setDbReady(true);
      })
      .catch((err) => {
        console.error("Database connection failed:", err);
        setError(err.message);
      });
  }, []);

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    try {
      console.log(`[UI] Deleting remote table: ${tableToDelete}`);
      await dropTable(tableToDelete);
      
      const updatedTables = await getTableNames();
      setTables([...updatedTables]);

      if (activeResource === tableToDelete) {
        setActiveResource(updatedTables.length > 0 ? updatedTables[0] : '');
      }
      setTableToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete table:", err);
      alert(`Failed to delete table: ${err.message}`);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200">
        <div className="p-8 bg-slate-900 rounded-lg shadow-xl border border-red-900/50 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Cloud Connection Error</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-900/20">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="relative mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-blue-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            </div>
        </div>
        <h1 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Connecting to Agent DataSource...</h1>
      </div>
    );
  }

  return (
    <Refine
      key={tables.join(',')} 
      dataProvider={sqlDataProvider}
      resources={tables.map(t => ({ name: t }))}
    >
      <Layout 
        sidebar={
          <div className="flex flex-col h-full">
            <div className="px-4 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tables</h2>
              <button 
                onClick={() => setIsAddTableOpen(true)}
                className="p-1.5 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors"
                title="Create New Table"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {tables.map((res) => (
                <div key={res} className="group relative">
                  <button
                    onClick={() => setActiveResource(res)}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all pr-8 border border-transparent
                      ${activeResource === res
                        ? 'bg-blue-900/20 text-blue-400 border-blue-900/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }
                    `}
                  >
                    <span className="truncate">{res}</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTableToDelete(res);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-slate-950"
                    title={`Delete ${res}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-800 bg-slate-900">
              <div className="flex items-center space-x-2 text-[10px] uppercase tracking-tighter text-slate-600 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                <span>Cloud Engine (D1)</span>
              </div>
            </div>
          </div>
        }
      >
        {activeResource ? (
          <ResourceList key={activeResource} resource={activeResource} />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 p-12 text-center">
            <h3 className="text-lg font-bold text-slate-200">No tables selected</h3>
            <p className="text-slate-500 mt-2">Create a table or select one to view data.</p>
          </div>
        )}

        {isAddTableOpen && (
          <AddTableModal 
            onClose={() => setIsAddTableOpen(false)} 
            onSuccess={(name) => {
              setIsAddTableOpen(false);
              refreshTables(name);
            }} 
          />
        )}

        {tableToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-800">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Delete Table?</h3>
                <p className="text-slate-400 mt-3 text-sm leading-relaxed">
                  Permanently delete <span className="font-bold text-slate-200">"{tableToDelete}"</span>? <br/>
                  This will destroy all stored records.
                </p>
              </div>
              <div className="px-6 py-5 bg-slate-950/50 border-t border-slate-800 flex gap-3">
                <button onClick={() => setTableToDelete(null)} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                <button onClick={confirmDeleteTable} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all">Delete Table</button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </Refine>
  );
};

export default App;
