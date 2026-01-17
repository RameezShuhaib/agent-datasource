
import React, { useState, useRef } from 'react';
import { parseCSV } from '../utils/csv';
import { createTable, createTableFromCSV, getTableNames } from '../sqlDatabase';

interface AddTableModalProps {
  onClose: () => void;
  onSuccess: (tableName: string) => void;
}

type ColumnDefinition = {
  name: string;
  type: string;
};

export const AddTableModal: React.FC<AddTableModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([{ name: '', type: 'TEXT' }]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[], rows: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddColumn = () => {
    setColumns([...columns, { name: '', type: 'TEXT' }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: string) => {
    const newCols = [...columns];
    newCols[index][field] = value;
    setColumns(newCols);
  };

  // Fix: make validateTableName async to handle getTableNames() Promise
  const validateTableName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "Table name is required";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return "Invalid name (use letters/numbers/underscores only)";
    const tables = await getTableNames();
    if (tables.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return "Table already exists";
    return null;
  };

  // Fix: make handleManualCreate async
  const handleManualCreate = async () => {
    const error = await validateTableName(tableName);
    if (error) {
      alert(error);
      return;
    }

    const validCols = columns.filter(c => c.name.trim() !== '');
    if (validCols.length === 0) {
      alert("At least one column name is required");
      return;
    }

    setIsProcessing(true);
    const finalName = tableName.trim().toLowerCase();
    try {
      await createTable(finalName, validCols);
      onSuccess(finalName);
    } catch (err: any) {
      alert(`Error creating table: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        alert("Invalid CSV: No headers found");
        return;
      }
      setCsvData(parsed);
      // Suggest table name from file name (SQL safe)
      const suggestedName = file.name.split('.')[0]
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^(\d)/, '_$1') // Prefix with underscore if starts with number
        .toLowerCase();
      setTableName(suggestedName);
    } catch (err) {
      alert("Failed to parse CSV file.");
    }
  };

  // Fix: make handleCsvCreate async
  const handleCsvCreate = async () => {
    const error = await validateTableName(tableName);
    if (error) {
      alert(error);
      return;
    }
    if (!csvData) {
      alert("Please upload a CSV file first");
      return;
    }

    setIsProcessing(true);
    const finalName = tableName.trim().toLowerCase();
    try {
      await createTableFromCSV(finalName, csvData.headers, csvData.rows);
      onSuccess(finalName);
    } catch (err: any) {
      console.error("CSV Create Error:", err);
      alert(`Error creating table from CSV: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900">Create New Table</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          <button 
            onClick={() => setActiveTab('manual')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Manual Schema
          </button>
          <button 
            onClick={() => setActiveTab('csv')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'csv' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Import CSV
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Table Name</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              placeholder="e.g. customers, analytics_logs"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>

          {activeTab === 'manual' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Columns</label>
                <button 
                  onClick={handleAddColumn}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  + Add Column
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex-1 text-xs font-bold text-slate-400 uppercase">id</div>
                  <div className="w-32 text-xs font-bold text-slate-400 uppercase italic">Primary Key</div>
                  <div className="w-8"></div>
                </div>
                {columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-3 group">
                    <input 
                      type="text" 
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      placeholder="Column name"
                      value={col.name}
                      onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    />
                    <select 
                      className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                      value={col.type}
                      onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="REAL">REAL</option>
                      <option value="BLOB">BLOB</option>
                    </select>
                    <button 
                      onClick={() => handleRemoveColumn(idx)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                      disabled={columns.length === 1}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!csvData ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-8 h-8 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-slate-900 font-bold">Upload CSV to infer schema</p>
                  <p className="text-slate-500 text-sm mt-1">First row will be used as column names</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blue-900">CSV Loaded Successfully</p>
                      <p className="text-xs text-blue-700">{csvData.rows.length} records found with {csvData.headers.length} columns.</p>
                    </div>
                    <button onClick={() => setCsvData(null)} className="text-xs font-bold text-blue-600 hover:underline">Reset</button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inferred Columns</label>
                    <div className="flex flex-wrap gap-2">
                      {csvData.headers.map(h => (
                        <span key={h} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-600">{h}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button 
            disabled={isProcessing || !tableName}
            onClick={activeTab === 'manual' ? handleManualCreate : handleCsvCreate}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {isProcessing ? 'Processing...' : 'Create Table'}
          </button>
        </div>
      </div>
    </div>
  );
};
