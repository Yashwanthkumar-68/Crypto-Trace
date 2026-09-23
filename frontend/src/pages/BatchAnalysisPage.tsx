import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileSpreadsheet, Search, Download, AlertTriangle, CheckCircle } from 'lucide-react';

interface BatchResult {
  wallet_address: string;
  blockchain: string;
  input_label: string;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  is_vasp: boolean;
}

interface BatchJob {
  batch_id: string;
  filename: string;
  total: number;
  processed: number;
  status: string;
}

export const BatchAnalysisPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{total: number, processed: number, status: string}>({ total: 0, processed: 0, status: '' });
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Only CSV files are allowed');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Only CSV files are allowed');
      }
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    setResults([]);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem('token') || '';
      
      const response = await fetch('/api/batch/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }
      
      const data = await response.json();
      setBatchId(data.batch_id);
      setProgress({ total: data.total_wallets, processed: 0, status: data.status });
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const pollStatus = useCallback(async () => {
    if (!batchId) return;
    
    try {
      const token = localStorage.getItem('token') || '';
      
      const response = await fetch(`/api/batch/${batchId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get status');
      }
      
      const data = await response.json();
      setProgress({ total: data.total, processed: data.processed, status: data.status });
      
      if (data.status === 'completed') {
        setResults(data.results);
      }
    } catch (err) {
      console.error(err);
    }
  }, [batchId]);

  useEffect(() => {
    let interval: any;
    
    if (batchId && progress.status !== 'completed' && progress.status !== 'failed') {
      interval = setInterval(() => {
        pollStatus();
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [batchId, progress.status, pollStatus]);

  const exportCsv = () => {
    if (results.length === 0) return;
    
    const headers = ['Wallet Address', 'Blockchain', 'Input Label', 'Risk Score', 'Risk Level', 'Is VASP'];
    const csvContent = [
      headers.join(','),
      ...results.map(r => 
        `${r.wallet_address},${r.blockchain},${r.input_label || ''},${r.risk_score},${r.risk_level},${r.is_vasp}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_results_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const percentComplete = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  
  const highRiskCount = results.filter(r => r.risk_level === 'High').length;
  const mediumRiskCount = results.filter(r => r.risk_level === 'Medium').length;
  const lowRiskCount = results.filter(r => r.risk_level === 'Low').length;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-[#0F172A] rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <FileSpreadsheet className="mr-3" /> Bulk Wallet Batch Analysis
        </h1>
        <p className="text-slate-300">Upload a CSV file with wallet addresses to analyze risks in bulk.</p>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <h2 className="text-base font-bold text-[#1E293B] mb-4 flex items-center">
          <Upload className="mr-2 w-5 h-5 text-slate-500" /> Upload CSV
        </h2>
        
        <div 
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input 
            id="file-upload" 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileChange}
          />
          <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-slate-600 font-medium">Click to upload or drag and drop</p>
          <p className="text-slate-400 text-sm mt-1">CSV files only (wallet_address, blockchain, label)</p>
          
          {file && (
            <div className="mt-4 inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {file.name}
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center text-sm border border-red-200">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={uploadFile}
            disabled={!file || isUploading || progress.status === 'processing'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isUploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </span>
            ) : (
              <span className="flex items-center">
                <Search className="w-4 h-4 mr-2" />
                Analyze All
              </span>
            )}
          </button>
        </div>
      </div>

      {(progress.status === 'processing' || progress.status === 'completed') && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <h2 className="text-base font-bold text-[#1E293B] mb-4 flex items-center">
            {progress.status === 'completed' ? (
              <CheckCircle className="mr-2 w-5 h-5 text-green-500" />
            ) : (
              <div className="mr-2 w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            )}
            Analysis Progress
          </h2>
          
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>{progress.status === 'completed' ? 'Completed' : 'Processing wallets...'}</span>
            <span className="font-medium">{progress.processed} / {progress.total}</span>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${progress.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${percentComplete}%` }}
            ></div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-[#1E293B] flex items-center">
              <FileSpreadsheet className="mr-2 w-5 h-5 text-slate-500" />
              Results Summary
            </h2>
            <button
              onClick={exportCsv}
              className="flex items-center text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-4 rounded-lg transition-colors border border-slate-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-red-800 text-sm font-medium mb-1">High Risk</p>
              <p className="text-2xl font-bold text-red-900">{highRiskCount}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-orange-800 text-sm font-medium mb-1">Medium Risk</p>
              <p className="text-2xl font-bold text-orange-900">{mediumRiskCount}</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-green-800 text-sm font-medium mb-1">Low Risk</p>
              <p className="text-2xl font-bold text-green-900">{lowRiskCount}</p>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Wallet Address</th>
                  <th className="px-4 py-3 font-medium">Blockchain</th>
                  <th className="px-4 py-3 font-medium">Risk Score</th>
                  <th className="px-4 py-3 font-medium">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((result, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 truncate max-w-[200px]">
                      {result.wallet_address}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                        {result.blockchain}
                      </span>
                    </td>
                    <td className="px-4 py-3">{result.risk_score}/100</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        result.risk_level === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                        result.risk_level === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {result.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
