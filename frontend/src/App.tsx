
import { useState } from 'react'
import axios from 'axios'
import { Github, UploadCloud, CheckCircle, Loader2, ArrowRight } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const DEPLOY_URL = import.meta.env.VITE_DEPLOY_URL;

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'deployed' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleDeploy = async () => {
    if (!repoUrl) return;

    setStatus('uploading');
    setErrorMsg('');

    try {
      const response = await axios.post(`${API_BASE_URL}/deploy`, {
        repoUrl
      });

      const { id } = response.data;
      setUploadId(id);
      setStatus('uploaded');

      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE_URL}/status?id=${id}`);
          const currentStatus = statusRes.data.status;

          if (currentStatus === 'deployed') {
            setStatus('deployed');
            clearInterval(interval);
          }
        } catch (err) {
            console.error("Polling error", err);
        }
      }, 2000);

    } catch (err) {
      setStatus('error');
      setErrorMsg('Failed to upload repository. Please check the URL and try again.');
        console.error(err);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-8 text-center">
      <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent leading-tight">
        Build Flow
      </h1>

      <div className="max-w-2xl mx-auto bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-700">
        <div className="mb-8">
            <p className="text-slate-400 text-lg">
                Deploy your GitHub repositories instantly.
            </p>
        </div>

        <div className="flex flex-col items-center gap-4">
            <div className="relative w-full">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-700 bg-slate-900 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
                    disabled={status === 'uploading' || status === 'uploaded'}
                />
            </div>

            <button
                onClick={handleDeploy}
                disabled={!repoUrl || status === 'uploading' || status === 'uploaded'}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 active:translate-y-[1px] transition-all disabled:bg-slate-600 disabled:cursor-not-allowed font-medium text-white shadow-sm"
            >
                {status === 'uploading' ? (
                    <>
                        <Loader2 className="animate-spin" size={20} /> Deploying...
                    </>
                ) : (
                    <>
                        <UploadCloud size={20} /> Deploy Now
                    </>
                )}
            </button>
        </div>

        {status !== 'idle' && (
            <div className="mt-8 text-left border-t border-slate-700 pt-6">
                <div className="flex items-center justify-center gap-3">
                    {status === 'uploading' && <Loader2 className="animate-spin text-blue-500" />}
                    {status === 'uploaded' && <Loader2 className="animate-spin text-amber-500" />}
                    {status === 'deployed' && <CheckCircle className="text-emerald-500" />}
                    {status === 'error' && <span className="text-red-500 font-bold">X</span>}

                    <span className="font-medium">
                        {status === 'uploading' && 'Cloning repository...'}
                        {status === 'uploaded' && 'Building project...'}
                        {status === 'deployed' && 'Deployment Complete!'}
                        {status === 'error' && 'Deployment Failed'}
                    </span>
                </div>

                {status === 'error' && <p className="text-red-500 text-sm">{errorMsg}</p>}

                {status === 'deployed' && uploadId && (
                    <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500 text-blue-500 break-all">
                        <p className="m-0 text-sm mb-2 text-blue-500">Project URL:</p>
                        <div className="flex items-center justify-between gap-4">
                            <a
                                href={`http://${uploadId}.${DEPLOY_URL}/index.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold hover:underline text-blue-500"
                            >
                                http://{uploadId}.{DEPLOY_URL}/index.html
                            </a>
                            <a
                                href={`http://${uploadId}.${DEPLOY_URL}/index.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600"
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

export default App
