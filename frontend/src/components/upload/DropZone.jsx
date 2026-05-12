import { useState, useRef } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { useUploadThing } from '../../utils/uploadthing';
import { useSessionStore } from '../../store/sessionStore';
import { useToastStore } from '../../store/toastStore';
import { APP_CONFIG } from '../../config/app.config';
import { STRINGS } from '../../constants/strings';
import api from '../../utils/api';

const COLD_START_MS = 6000;

export default function DropZone({ onSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState('');
  const inputRef   = useRef(null);
  const setSession = useSessionStore((s) => s.setSession);
  const addToast   = useToastStore((s) => s.addToast);

  const { startUpload, isUploading } = useUploadThing('pdfUploader', {
    onClientUploadComplete: async (res) => {
      const file     = res[0];
      const fileUrl  = file.ufsUrl;
      const fileKey  = file.key;
      const fileName = file.name;
      await createSession({ fileUrl, fileKey, fileName });
    },
    onUploadError: (err) => {
      console.error('[UploadThing] upload error:', err);
      setError(STRINGS.TOAST_UPLOAD_ERROR);
    },
    onUploadBegin: (fileName) => console.log('[UploadThing] upload began:', fileName),
  });

  async function createSession({ fileUrl, fileKey, fileName }) {
    // Delete the previous session's backend data (Pinecone, local files, UploadThing)
    // before starting a new one. Fire-and-forget — don't block the upload flow.
    const prevSessionId = useSessionStore.getState().sessionId;
    if (prevSessionId) {
      api.delete(`/session/${prevSessionId}`).catch(() => {});
    }

    const sessionId = crypto.randomUUID();
    setSession({ sessionId, fileUrl, fileKey, fileName });

    // Show cold-start toast if /ingest hasn't responded after 6 seconds
    const coldTimer = setTimeout(
      () => addToast({ message: STRINGS.TOAST_COLD_START, type: 'info', duration: 10000 }),
      COLD_START_MS,
    );
    try {
      await api.post('/ingest', { file_url: fileUrl, file_key: fileKey, session_id: sessionId });
      onSuccess(sessionId);
    } catch {
      setError(STRINGS.ERROR_GENERIC);
    } finally {
      clearTimeout(coldTimer);
    }
  }

  function validateFile(file) {
    if (!file) return false;
    if (file.type !== 'application/pdf') {
      setError(STRINGS.ERROR_FILE_TYPE);
      return false;
    }
    if (file.size > APP_CONFIG.maxFileSizeMB * 1024 * 1024) {
      setError(STRINGS.ERROR_FILE_SIZE);
      return false;
    }
    setError('');
    return true;
  }

  function handleFiles(files) {
    const file = files[0];
    if (validateFile(file)) startUpload([file]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="PDF upload drop zone — click to browse or drag a file here"
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg py-12 px-6 text-center transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-coral-300
          ${isDragging
            ? 'border-coral-400 bg-coral-50'
            : 'border-stone-300 bg-white hover:border-coral-300 hover:bg-coral-50'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files))}
          aria-hidden="true"
        />

        {isUploading ? (
          <>
            <div
              className="w-10 h-10 mx-auto mb-3 border-2 border-coral-400 border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Uploading"
            />
            <p className="font-body text-coral-500 font-medium text-sm">{STRINGS.DROP_ZONE_UPLOADING}</p>
          </>
        ) : (
          <>
            <Upload className="text-coral-400 w-10 h-10 mx-auto mb-3" aria-hidden="true" />
            <p className="font-body text-stone-700 font-medium text-sm">{STRINGS.DROP_ZONE_IDLE}</p>
            <p className="font-body text-stone-400 text-xs mt-1">PDF only · Max {APP_CONFIG.maxFileSizeMB} MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-error text-xs font-body" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
