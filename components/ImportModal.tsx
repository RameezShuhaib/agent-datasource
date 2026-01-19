
import React, { useState, useRef, useEffect } from 'react';
import { parseCSV } from '../utils/csv';
import { execQuery, getTableColumns, ColumnMetadata, uploadCSV } from '../sqlDatabase';

interface ImportModalProps {
  resource: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ resource, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<{ headers: string[], rows: any[] } | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTableColumns(resource).then(setColumns);
  }, [resource]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setFile(selectedFile);
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      setFileData(parsed);
    } catch (err) {
      alert("Failed to parse CSV file.");
    }
  };

  const validateAndImport = async () => {
    if (!file || !fileData) return;
    setIsProcessing(true);

    try {
      // For replace mode, delete existing data first
      if (mode === 'replace') {
        const safeResource = `"${resource.replace(/"/g, '""')}"`;
        await execQuery(`DELETE FROM ${safeResource}`);
      }

      // Use the new upload endpoint
      const result = await uploadCSV(file, resource, 'append');
      onSuccess(result.rows_inserted);
    } catch (err: any) {
      console.error("Import failed:", err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Batch Import: {resource}</h3>
            <p className="text-sm text-slate-400">Map your CSV columns to the database schema</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!fileData ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-slate-800 transition-all cursor-pointer group bg-slate-900"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-900/30 transition-colors">
                <svg className="w-8 h-8 text-slate-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-slate-200 font-bold">Upload a CSV file</p>
              <p className="text-slate-500 text-sm mt-1">Columns needed: {columns.filter(c => !c.pk).map(c => c.name).join(', ')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Data Preview (Top 5 Rows)</h4>
                  <button onClick={() => { setFile(null); setFileData(null); }} className="text-xs text-blue-400 font-bold hover:underline">Pick different file</button>
                </div>
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-700 text-[11px]">
                    <thead className="bg-slate-950">
                      <tr>
                        {fileData.headers.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-bold text-slate-400 truncate">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {fileData.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {fileData.headers.map(h => (
                            <td key={h} className="px-3 py-2 text-slate-300 truncate max-w-[120px]">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-sm font-bold text-slate-300 mb-3">Choose Import Method</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setMode('append')}
                    className={`p-3 rounded-lg border text-left transition-all ${mode === 'append' ? 'bg-slate-900 border-blue-500 ring-2 ring-blue-500/20' : 'bg-transparent border-slate-700 hover:border-slate-600'}`}
                  >
                    <span className="font-bold text-sm block text-slate-200">Append Records</span>
                    <span className="text-xs text-slate-500">Add to existing table data.</span>
                  </button>
                  <button 
                    onClick={() => setMode('replace')}
                    className={`p-3 rounded-lg border text-left transition-all ${mode === 'replace' ? 'bg-slate-900 border-red-500 ring-2 ring-red-500/20' : 'bg-transparent border-slate-700 hover:border-slate-600'}`}
                  >
                    <span className="font-bold text-sm block text-red-400">Overwrite Table</span>
                    <span className="text-xs text-slate-500 text-red-900/50">Wipe table first (dangerous).</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            disabled={!fileData || isProcessing}
            onClick={validateAndImport}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-lg shadow-blue-900/40 hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {isProcessing ? 'Processing...' : 'Run Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
