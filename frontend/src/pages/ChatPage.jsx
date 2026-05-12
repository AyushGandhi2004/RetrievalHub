import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

import { APP_CONFIG } from '../config/app.config';
import { STRINGS } from '../constants/strings';
import { useSessionStore } from '../store/sessionStore';
import { useTreeStore } from '../store/treeStore';
import { useChatStore } from '../store/chatStore';
import { useToastStore } from '../store/toastStore';
import { useQuery } from '../hooks/useQuery';
import api from '../utils/api';

import Sidebar from '../components/layout/Sidebar';
import NodeDrawer from '../components/tree/NodeDrawer';
import ChatArea from '../components/chat/ChatArea';
import InputBar from '../components/chat/InputBar';
import Modal from '../components/common/Modal';

export default function ChatPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const urlSession = params.get('session_id');

  // ── Session ────────────────────────────────────────────────────────────────
  const sessionId    = useSessionStore((s) => s.sessionId);
  const fileName     = useSessionStore((s) => s.fileName);
  const setMeta      = useSessionStore((s) => s.setMeta);
  const clearSession = useSessionStore((s) => s.clearSession);

  // ── Tree ───────────────────────────────────────────────────────────────────
  const treeData  = useTreeStore((s) => s.treeData);
  const clearTree = useTreeStore((s) => s.clearTree);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { submitQuery } = useQuery();

  // ── Toast ──────────────────────────────────────────────────────────────────
  const addToast = useToastStore((s) => s.addToast);

  // URL param wins on hard-refresh; falls back to localStorage value
  const activeSession = urlSession || sessionId;

  // ── Load session meta on mount — handle Render ephemeral session loss ──────
  useEffect(() => {
    if (!activeSession) { navigate('/'); return; }
    api
      .get(`/session/${activeSession}/meta`)
      .then((res) => setMeta(res.data))
      .catch(() => {
        addToast({ message: STRINGS.TOAST_SESSION_LOST, type: 'warning', duration: 7000 });
        clearSession();
        clearTree();
        navigate('/');
      });
  }, [activeSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tree stats ─────────────────────────────────────────────────────────────
  const totalNodes      = treeData?.total_nodes ?? 0;
  const treeDepth       = treeData?.depth ?? 0;
  const ingestionTokens = treeData?.ingestion_tokens ?? 0;

  // ── Delete session ─────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]               = useState(false);

  async function handleDelete() {
    if (!activeSession) return;
    setDeleting(true);
    try {
      await api.delete(`/session/${activeSession}`);
      addToast({ message: STRINGS.TOAST_DELETE_SUCCESS, type: 'success' });
    } catch {
      // Session may already be gone on Render restart; proceed with local cleanup
    } finally {
      clearSession();
      clearTree();
      navigate('/');
    }
  }

  // ── Query submit ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (question) => submitQuery(question, activeSession),
    [submitQuery, activeSession],
  );

  return (
    <div className="flex flex-col h-screen bg-stone-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between gap-3">
        <span className="font-display text-stone-900 text-lg flex-shrink-0">
          {APP_CONFIG.appName}
        </span>
        <span
          className="bg-coral-50 text-coral-600 border border-coral-200 rounded-full text-sm px-3 py-1 font-body truncate max-w-[40%] sm:max-w-xs"
          title={fileName || 'document.pdf'}
        >
          {fileName || 'document.pdf'}
        </span>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-stone-400 hover:text-error transition-colors flex-shrink-0 p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-300"
          aria-label="Delete session"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Responsive sidebar: desktop fixed / tablet overlay / mobile FAB ── */}
        <Sidebar
          sessionId={activeSession}
          totalNodes={totalNodes}
          treeDepth={treeDepth}
          ingestionTokens={ingestionTokens}
        />

        {/* ── Chat area ─────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatArea />
          <InputBar onSubmit={handleSubmit} disabled={isStreaming} />
        </main>
      </div>

      {/* Node detail drawer — fixed overlay, rendered outside sidebar */}
      <NodeDrawer />

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal
        open={showDeleteModal}
        title={STRINGS.DELETE_MODAL_TITLE}
        body={STRINGS.DELETE_MODAL_BODY}
        confirmLabel={STRINGS.DELETE_CONFIRM}
        cancelLabel={STRINGS.DELETE_CANCEL}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setShowDeleteModal(false)}
        loading={deleting}
        destructive
      />
    </div>
  );
}
