
import React, { useState, useEffect, useRef } from 'react';
import { useList, useDeleteMany, useUpdate, useCreate, CrudFilters, CrudSorting } from '@refinedev/core';
import { ImportModal } from './ImportModal';
import { getTableColumns, ColumnMetadata } from '../sqlDatabase';

interface ResourceListProps {
  resource: string;
}

const PAGE_SIZE = 25;

export const ResourceList: React.FC<ResourceListProps> = ({ resource }) => {
  const [searchValue, setSearchValue] = useState('');
  const [current, setCurrent] = useState(1);
  const [sorters, setSorters] = useState<CrudSorting>([]);
  const [filters, setFilters] = useState<CrudFilters>([]);
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Inline Editing State (Existing Rows)
  const [drafts, setDrafts] = useState<Record<number, any>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: number, fieldName: string } | null>(null);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);

  // Inline Creation State (New Row)
  const [isCreatingRow, setIsCreatingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [isCreatingSaving, setIsCreatingSaving] = useState(false);

  // Infinite Scroll State
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { query, result: listData } = useList<any>({
    resource,
    pagination: { current, pageSize: PAGE_SIZE, mode: "server" } as any,
    sorters,
    filters,
    queryOptions: {
      placeholderData: (previousData: any) => previousData,
      retry: 1
    }
  });

  const { isLoading, isFetching, refetch } = query;
  const { mutateAsync: updateMutate } = useUpdate();
  const { mutateAsync: createMutate } = useCreate();
  // Fix: isPending does not exist on useDeleteMany return type, use isLoading instead
  const { mutateAsync: deleteManyMutate, isLoading: isDeleting } = useDeleteMany();

  useEffect(() => {
    getTableColumns(resource).then(meta => setColumns(meta));
    setAllRecords([]);
    setCurrent(1);
    setHasMore(true);
    setSearchValue('');
    setSorters([]);
    setFilters([]);
    setDrafts({});
    setSelectedIds(new Set());
    setEditingCell(null);
    setIsCreatingRow(false);
    setNewRowData({});
  }, [resource]);

  useEffect(() => {
    setAllRecords([]);
    setCurrent(1);
    setHasMore(true);
  }, [filters, sorters]);

  useEffect(() => {
    if (listData?.data) {
      setAllRecords(prev => {
        if (current === 1) return listData.data;
        const combinedMap = new Map();
        prev.forEach(item => combinedMap.set(item.id, item));
        listData.data.forEach(item => combinedMap.set(item.id, item));
        return Array.from(combinedMap.values());
      });
      const total = listData.total || 0;
      const loadedSoFar = current * PAGE_SIZE;
      setHasMore(loadedSoFar < total && listData.data.length > 0);
    }
  }, [listData, current]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters(searchValue ? [{ field: "q", operator: "contains", value: searchValue }] : []);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchValue]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching && !isLoading && allRecords.length > 0) {
          setCurrent(prev => prev + 1);
        }
      },
      { threshold: 0.1, root: scrollContainerRef.current, rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, isFetching, isLoading, allRecords.length, current]);

  // Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = allRecords.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    try {
      await deleteManyMutate({
        resource,
        ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      setIsDeleteModalOpen(false);
      setAllRecords([]); // Force refresh
      setCurrent(1);
      refetch();
    } catch (err: any) {
      alert("Failed to delete records: " + err.message);
    }
  };

  const handleSort = (field: string) => {
    setSorters((prev) => {
      const existingSort = prev.find((s) => s.field === field);
      if (existingSort?.order === 'asc') {
        return [{ field, order: 'desc' }];
      } else if (existingSort?.order === 'desc') {
        return [];
      } else {
        return [{ field, order: 'asc' }];
      }
    });
  };

  const handleSaveAll = async () => {
    const rowIds = Object.keys(drafts).map(Number);
    if (rowIds.length === 0) return;

    setIsSavingDrafts(true);
    try {
      for (const id of rowIds) {
        await updateMutate({
          resource,
          id,
          values: drafts[id],
        });
      }
      setDrafts({});
      refetch();
    } catch (err) {
      alert("Failed to save some changes.");
    } finally {
      setIsSavingDrafts(false);
    }
  };

  const handleCellEdit = (rowId: number, fieldName: string, value: any) => {
    const col = columns.find(c => c.name === fieldName);
    let parsedValue = value;
    if (col) {
      const type = col.type.toUpperCase();
      if (type.includes('INT')) parsedValue = parseInt(value, 10);
      else if (type.includes('REAL') || type.includes('FLOAT') || type.includes('NUM')) parsedValue = parseFloat(value);
    }

    setDrafts(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [fieldName]: parsedValue
      }
    }));
  };

  const handleNewRowChange = (fieldName: string, value: any) => {
    const col = columns.find(c => c.name === fieldName);
    let parsedValue = value;
    if (col) {
      const type = col.type.toUpperCase();
      if (type.includes('INT')) parsedValue = parseInt(value, 10);
      else if (type.includes('REAL') || type.includes('FLOAT') || type.includes('NUM')) parsedValue = parseFloat(value);
    }
    setNewRowData(prev => ({ ...prev, [fieldName]: parsedValue }));
  };

  const handleSaveNewRow = async () => {
    setIsCreatingSaving(true);
    try {
      await createMutate({
        resource,
        values: newRowData
      });
      setIsCreatingRow(false);
      setNewRowData({});
      setAllRecords([]); 
      setCurrent(1);
      refetch();
    } catch (err: any) {
      alert("Failed to create record: " + err.message);
    } finally {
      setIsCreatingSaving(false);
    }
  };

  const cancelEdits = () => {
    setDrafts({});
    setEditingCell(null);
  };

  const formatValue = (col: ColumnMetadata, value: any, rowId: number) => {
    const draftValue = drafts[rowId]?.[col.name];
    const displayValue = draftValue !== undefined ? draftValue : value;

    if (displayValue === null || displayValue === undefined) return '-';
    
    const type = col.type.toUpperCase();
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('NUM') || col.name.includes('price') || col.name.includes('total')) {
      const num = typeof displayValue === 'string' ? parseFloat(displayValue) : displayValue;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
    }
    return String(displayValue);
  };

  const [isImporting, setIsImporting] = useState(false);
  const hasChanges = Object.keys(drafts).length > 0;
  const hasSelection = selectedIds.size > 0;

  // Header Checkbox State
  const isAllSelected = allRecords.length > 0 && allRecords.every(r => selectedIds.has(r.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight capitalize">{resource}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-400 font-medium">
                {listData?.total || 0} total records
              </p>
              {hasChanges && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-200 border border-amber-800 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  Unsaved Changes
                </span>
              )}
              {hasSelection && (
                 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-200 border border-blue-800 text-[10px] font-bold uppercase tracking-wider">
                  {selectedIds.size} Selected
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isCreatingRow ? (
               <>
                <button 
                  onClick={() => { setIsCreatingRow(false); setNewRowData({}); }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSaveNewRow}
                  disabled={isCreatingSaving}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-2 border border-transparent rounded-md shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-blue-900/40 transition-all"
                >
                  {isCreatingSaving ? 'Inserting...' : 'Insert Record'}
                </button>
              </>
            ) : hasChanges ? (
              <>
                <button 
                  onClick={cancelEdits}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSaveAll}
                  disabled={isSavingDrafts}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-2 border border-transparent rounded-md shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/40 transition-all"
                >
                  {isSavingDrafts ? 'Saving...' : `Save ${Object.keys(drafts).length} Changes`}
                </button>
              </>
            ) : hasSelection ? (
              <>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Clear Selection
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-2 border border-transparent rounded-md shadow-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-red-900/40 transition-all"
                >
                  Delete {selectedIds.size} Records
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsImporting(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">Import</button>
                <button 
                  onClick={() => {
                    setIsCreatingRow(true);
                    setNewRowData({});
                    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-slate-900 bg-white hover:bg-slate-200 transition-colors"
                >
                  Add Record
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input 
            type="text" 
            className="block w-full pl-10 pr-10 py-2.5 border border-slate-700 rounded-lg text-sm bg-slate-900 text-white shadow-sm focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none placeholder-slate-500"
            placeholder={`Search across columns in ${resource}...`}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 shadow-sm rounded-xl overflow-hidden flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-800 border-separate border-spacing-0">
            <thead className="bg-slate-900 sticky top-0 z-20">
              <tr className="shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                {/* Checkbox Header */}
                <th className="px-6 py-4 bg-slate-900 w-12 text-center">
                   <div className="flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 bg-slate-800 rounded border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                      checked={isAllSelected}
                      ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                    />
                  </div>
                </th>
                
                {columns.map(col => (
                  <th 
                    key={col.name} 
                    onClick={() => handleSort(col.name)} 
                    className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors bg-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      {col.name.replace('_', ' ')}
                      {sorters.find(s => s.field === col.name) && (
                        <span className="text-blue-500 font-black">{sorters.find(s => s.field === col.name)?.order === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800/50">
              
              {/* Inline Create Row */}
              {isCreatingRow && (
                <tr className="bg-blue-900/10 shadow-inner">
                  {/* Empty cell for checkbox column in new row */}
                  <td className="px-6 py-4 bg-blue-900/10 border-l-2 border-blue-500"></td>
                  
                  {columns.map(col => (
                    <td key={`new-${col.name}`} className="px-6 py-4 whitespace-nowrap p-2">
                      {col.pk ? (
                        <span className="text-blue-400 font-mono text-xs italic pl-4">New</span>
                      ) : (
                        <input 
                          autoFocus={columns.findIndex(c => !c.pk) === columns.indexOf(col)}
                          className="w-full px-3 py-2 text-sm border border-blue-500/50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-slate-950 text-white shadow-sm"
                          placeholder={col.name}
                          value={newRowData[col.name] || ''}
                          onChange={(e) => handleNewRowChange(col.name, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNewRow();
                            if (e.key === 'Escape') {
                              setIsCreatingRow(false);
                              setNewRowData({});
                            }
                          }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Existing Data Rows */}
              {allRecords.map((item: any) => {
                const isRowModified = drafts[item.id] !== undefined;
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors group ${isSelected ? 'bg-blue-900/10' : isRowModified ? 'bg-amber-900/10' : 'hover:bg-slate-800/50'}`}
                  >
                    {/* Checkbox Cell */}
                    <td className="px-6 py-4 whitespace-nowrap w-12 text-center">
                       <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-600 bg-slate-800 rounded border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </div>
                    </td>

                    {columns.map(col => {
                      const isEditing = editingCell?.rowId === item.id && editingCell?.fieldName === col.name;
                      const isModified = drafts[item.id]?.[col.name] !== undefined;

                      return (
                        <td 
                          key={col.name} 
                          className={`px-6 py-4 whitespace-nowrap text-sm font-medium relative ${isEditing ? 'p-0' : 'cursor-text group-hover:bg-slate-800'}`}
                          onClick={() => !col.pk && setEditingCell({ rowId: item.id, fieldName: col.name })}
                        >
                          {col.pk ? (
                            <span className="text-slate-500 font-mono text-xs">#{item[col.name]}</span>
                          ) : isEditing ? (
                            <input 
                              autoFocus
                              className="w-full h-full px-6 py-4 border-2 border-blue-500 outline-none bg-slate-950 text-white shadow-xl z-10 relative"
                              defaultValue={drafts[item.id]?.[col.name] ?? item[col.name]}
                              onBlur={(e) => {
                                handleCellEdit(item.id, col.name, e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellEdit(item.id, col.name, e.currentTarget.value);
                                  setEditingCell(null);
                                }
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`${isModified ? 'text-blue-400 font-bold' : 'text-slate-300'}`}>
                                {formatValue(col, item[col.name], item.id)}
                              </span>
                              {isModified && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Observer Sentinel */}
          <div ref={observerTarget} className="w-full py-12 flex flex-col items-center justify-center gap-4 bg-slate-900/50">
            {isFetching || isLoading ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-700 border-t-blue-500"></div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fetching...</span>
              </div>
            ) : !hasMore && allRecords.length > 0 ? (
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">End of Dataset</div>
            ) : null}
          </div>
        </div>
      </div>

      {isImporting && (
        <ImportModal 
          resource={resource} 
          onClose={() => setIsImporting(false)} 
          onSuccess={() => { setIsImporting(false); setAllRecords([]); setCurrent(1); refetch(); }} 
        />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-800">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white">Delete Records?</h3>
              <p className="text-slate-400 text-sm mt-2">Are you sure you want to delete <span className="font-bold text-slate-200">{selectedIds.size} records</span>? This cannot be undone.</p>
            </div>
            <div className="px-6 py-4 bg-slate-950 flex gap-3 border-t border-slate-800">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button disabled={isDeleting} onClick={handleDeleteSelected} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
