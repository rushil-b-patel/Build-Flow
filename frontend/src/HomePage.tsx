import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Github,
  Loader2,
  TerminalSquare,
  UploadCloud,
} from 'lucide-react';
import { API_BASE_URL, DEPLOY_URL, normalizeState, statusLabel } from './types';
import type { DeploymentState, StatusPayload } from './types';

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [status, setStatus] = useState<DeploymentState>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const pollingRef = useRef<number | null>(null);
  const logsBoxRef = useRef<HTMLDivElement | null>(null);
  const logsEndpointUnavailableRef = useRef(false);

  const stopPolling = () => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollDeployment = async (id: string): Promise<DeploymentState> => {
    const statusRes = await axios.get<{ status: string | StatusPayload }>(`${API_BASE_URL}/status?id=${id}`);
    const statusPayload = statusRes.data.status;
    const currentStatus =
      typeof statusPayload === 'string'
        ? normalizeState(statusPayload)
        : normalizeState(statusPayload?.state);

    setStatus(currentStatus);

    try {
      const logsRes = await axios.get<{ logs: string[] }>(`${API_BASE_URL}/logs?id=${id}`);
      logsEndpointUnavailableRef.current = false;
      setLogs(logsRes.data.logs || []);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        if (!logsEndpointUnavailableRef.current && logs.length === 0) {
          logsEndpointUnavailableRef.current = true;
          setLogs([
            'Build logs endpoint is not available on the running upload service.',
            'Rebuild and restart the upload service to enable /logs.',
          ]);
        }
      } else {
        console.error('Logs polling error', err);
      }
    }

    if (typeof statusPayload !== 'string' && statusPayload?.error) {
      setErrorMsg(statusPayload.error);
    }

    if (currentStatus === 'deployed' || currentStatus === 'error') {
      stopPolling();
    }
    return currentStatus;
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      void pollDeployment(id).catch((err) => {
        console.error('Polling error', err);
      });
    }, 1500);
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (logsBoxRef.current) {
      logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handleDeploy = async () => {
    if (!repoUrl) return;

    setStatus('cloning');
    setLogs([]);
    setErrorMsg('');
    logsEndpointUnavailableRef.current = false;
    stopPolling();

    try {
      const token = localStorage.getItem('bf_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(`${API_BASE_URL}/deploy`, { repoUrl }, { headers });
      const { id } = response.data;
      setUploadId(id);
      const current = await pollDeployment(id);
      if (current !== 'deployed' && current !== 'error') {
        startPolling(id);
      }

    } catch (err) {
      setStatus('error');
      setErrorMsg('Failed to upload repository. Please check the URL and try again.');
      console.error(err);
    }
  }

  const isWorking =
    status === 'cloning' || status === 'uploading' || status === 'queued' || status === 'building';
  const projectUrl = uploadId ? `http://${uploadId}.${DEPLOY_URL}/index.html` : '';

  return (
    <div className="w-full max-w-6xl mx-auto p-6 md:p-10 text-center">
      <h1 className="text-5xl font-bold mb-2">
        Build Flow
      </h1>
      <p className="text-slate-600 mb-8">Ship frontend projects from a GitHub URL.</p>

      <div className="w-full max-w-5xl mx-auto p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="https://github.com/username/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
              disabled={isWorking}
            />
          </div>

          <button
            onClick={handleDeploy}
            disabled={!repoUrl || isWorking}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl bg-black hover:bg-white border hover:text-black active:translate-y-px transition-all disabled:cursor-not-allowed font-medium text-white shadow-sm"
          >
            {isWorking ? (
              <>
                Deploying...
              </>
            ) : (
              <>
                <UploadCloud size={20} /> Deploy Now
              </>
            )}
          </button>
        </div>

        {status !== 'idle' && (
        <div className="mt-8 text-left border-t border-slate-200 pt-6">
          <div className="flex items-center justify-center gap-2 font-medium">
            <span>{statusLabel(status)}</span>
            {isWorking && <Loader2 className="animate-spin text-sky-600" />}
            {status === 'deployed' && <CheckCircle2 className="text-emerald-600" />}
            {status === 'error' && <AlertTriangle className="text-rose-600" />}
          </div>

          <div className="mt-5 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl shadow-slate-900/50 ring-1 ring-slate-800/50">
            <div className="terminal-header px-4 py-2.5 bg-slate-900/90 border-b border-slate-700/80 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/90 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-amber-400/90 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-sm" />
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <TerminalSquare size={14} className="text-slate-500" />
                <span className="font-medium text-xs tracking-wider text-slate-400">Build Logs</span>
              </div>
              <span className={`ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${status === 'deployed' ? 'bg-emerald-500/20 text-emerald-400' : status === 'error' ? 'bg-red-500/20 text-red-400' : isWorking ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-600/30 text-slate-500'}`}>
                {status}
              </span>
            </div>

            <div
              ref={logsBoxRef}
              className="terminal-content max-h-80 overflow-y-auto px-5 py-4 font-mono text-sm space-y-1 text-slate-300"
            >
                {logs.length === 0 && (
                  <p className="text-slate-500 flex items-center gap-3">
                    <span className="text-emerald-500/80">»</span>
                    <span>Waiting for build...</span>
                    <span className="terminal-cursor inline-block w-2 h-4 bg-emerald-400/80 ml-0.5" />
                  </p>
                )}
                {logs.map((line, idx) => (
                  <p key={`${idx}-${line.slice(0, 16)}`} className="whitespace-pre-wrap wrap-break-words leading-relaxed flex">
                    <span className="text-slate-600 select-none mr-3 shrink-0">{String(idx + 1).padStart(3, '0')}</span>
                    <span className="text-slate-300">{line}</span>
                  </p>
                ))}
              </div>
            </div>

          {status === 'error' && (
              <p className="text-rose-600 text-sm mt-4 wrap-break-words">
                {errorMsg || 'Deployment failed. Check logs for details.'}
              </p>
          )}

          {status === 'deployed' && uploadId && (
              <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-200 text-sky-800 break-all">
                <p className="m-0 text-sm mb-2 text-sky-700">Project URL:</p>
                <div className="flex items-center justify-between gap-4">
                  <a
                    href={projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold hover:underline text-sky-700"
                  >
                    {projectUrl}
                  </a>
                  <a
                    href={projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:text-sky-900"
                  >
                    <ArrowRight size={18} />
                  </a>
                </div>
              </div>
            )}
        </div>
        )}
      </div>
    </div>
  )
}
