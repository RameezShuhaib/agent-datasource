
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar }) => {
  return (
    <div className="h-screen w-screen flex bg-slate-950 overflow-hidden text-slate-200">
      {/* Sidebar Panel */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col h-full z-20 shadow-xl shadow-slate-950/50">
        <div className="h-16 flex-shrink-0 flex items-center px-6 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded text-white shadow-lg shadow-blue-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Agent DataSource</span>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {sidebar}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-950">
        <header className="h-16 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-slate-500">Cloud DB</span>
                  </div>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg className="flex-shrink-0 h-5 w-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                    </svg>
                    <span className="ml-2 text-sm font-semibold text-slate-200">TIPANDTOES_DB</span>
                  </div>
                </li>
              </ol>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-blue-400 bg-blue-950/40 px-2.5 py-1 rounded border border-blue-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span>
              Remote Linked
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-8">
          <div className="h-full max-w-full">
            {children}
          </div>
        </main>

        <footer className="h-10 flex-shrink-0 bg-slate-900 border-t border-slate-800 py-2 px-8">
          <div className="flex justify-between items-center h-full text-[11px] text-slate-500 font-medium">
            <p>Cloudflare Workers / D1 Storage</p>
            <p className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/50"></span>
              Persistent Cloud Session
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
