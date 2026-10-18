import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, ExternalLink, Maximize2, MessageCircle, RotateCcw } from 'lucide-react';

// Direct chatbot URL — bypasses the Vite/Gateway proxy chain and any cached 301 redirects.
// Chatbot server always listens on port 3000 regardless of whether you access via gateway or Vite.
const CHATBOT_DIRECT_URL = 'http://localhost:3000/?embed=1';

export const FloatingChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // Used to force-reload iframe
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [hasUnreadPulse, setHasUnreadPulse] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for external open events (from Navbar / Sidebar buttons)
  useEffect(() => {
    const handleOpenChatbot = () => {
      setIsOpen(true);
      setHasUnreadPulse(false);
    };
    window.addEventListener('open-lifelink-chatbot', handleOpenChatbot);
    return () => window.removeEventListener('open-lifelink-chatbot', handleOpenChatbot);
  }, []);

  const handleToggle = () => {
    setIsOpen(prev => {
      if (!prev) {
        setHasUnreadPulse(false);
        setIframeLoaded(false); // Show loader when opening
      }
      return !prev;
    });
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(CHATBOT_DIRECT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleReload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIframeLoaded(false);
    setIframeKey(k => k + 1); // Forces iframe to fully remount
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end"
      style={{ fontFamily: 'inherit' }}
    >
      {/* ═══════════════════════════════════
          Floating Chat Panel
      ═══════════════════════════════════ */}
      {isOpen && (
        <div
          className="mb-3 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{
            width: isExpanded ? 'min(720px, calc(100vw - 2rem))' : 'min(460px, calc(100vw - 2rem))',
            height: isExpanded ? 'min(780px, calc(100vh - 5rem))' : 'min(640px, calc(100vh - 6rem))',
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(15,23,42,0.08)',
            animation: 'chatbot-slide-in 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
            transition: 'width 0.25s ease, height 0.25s ease',
          }}
          role="dialog"
          aria-label="LifeLink AI Health Assistant"
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 shrink-0 select-none"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#E81743', boxShadow: '0 2px 8px rgba(232,23,67,0.4)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-xs tracking-wide leading-none">
                    LifeLink AI Assistant
                  </span>
                  <span
                    className="inline-block px-1.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider leading-none py-0.5"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}
                  >
                    Live
                  </span>
                </div>
                <p className="text-slate-400 text-[10px] mt-0.5 leading-none">
                  Blood Stock · Camps · Local AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={handleReload}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                title="Reload chatbot"
                aria-label="Reload"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                title={isExpanded ? 'Standard view' : 'Expand view'}
                aria-label="Toggle size"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleOpenNewTab}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                title="Open full-screen in new tab"
                aria-label="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToggle}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                title="Minimize"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Iframe Content Area */}
          <div className="flex-1 relative overflow-hidden bg-[#F9F7F2]">
            {/* Loading skeleton */}
            {!iframeLoaded && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                style={{ background: '#F9F7F2' }}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: '#4A6B5D',
                    borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <div className="text-center">
                  <p className="text-xs font-semibold" style={{ color: '#272522' }}>
                    Connecting to AI Companion…
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#878278' }}>
                    Loading live blood stock & health assistant
                  </p>
                </div>
              </div>
            )}

            {/* The iframe — points DIRECTLY to chatbot port 3000 to bypass
                the proxy chain and any browser-cached 301 redirects */}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={CHATBOT_DIRECT_URL}
              title="LifeLink AI Health Assistant"
              className="w-full h-full border-0"
              style={{
                // Inject CSS that makes the chatbot fit perfectly in the panel
                opacity: iframeLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
              onLoad={() => setIframeLoaded(true)}
              // Inject compact-mode CSS via srcdoc won't work; we use ?embed param instead
              // so the chatbot can detect it and render compact layout
            />
          </div>

          {/* Quick Footer */}
          <div
            className="flex items-center justify-between px-3 py-1.5 shrink-0 border-t"
            style={{ borderColor: '#E4DED4', background: '#F9F7F2' }}
          >
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" style={{ color: '#4A6B5D' }} />
              <span className="text-[10px] font-medium" style={{ color: '#5C5850' }}>
                eRaktKosh · Llama 3.2 · Atomic KG
              </span>
            </div>
            <button
              onClick={handleOpenNewTab}
              className="flex items-center gap-0.5 text-[10px] font-bold cursor-pointer"
              style={{ color: '#4A6B5D' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              <Maximize2 className="w-2.5 h-2.5" />
              Full Screen
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          Floating Trigger Button
      ═══════════════════════════════════ */}
      <button
        onClick={handleToggle}
        className="relative flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-bold text-xs cursor-pointer transition-all duration-200"
        style={{
          background: isOpen
            ? 'linear-gradient(135deg, #1e293b, #0f172a)'
            : 'linear-gradient(135deg, #E81743, #c01234)',
          boxShadow: isOpen
            ? '0 4px 12px rgba(0,0,0,0.25)'
            : '0 8px 24px rgba(232,23,67,0.45), 0 2px 8px rgba(232,23,67,0.3)',
          transform: isOpen ? 'scale(1)' : 'scale(1)',
        }}
        onMouseEnter={e => {
          if (!isOpen) e.currentTarget.style.transform = 'scale(1.04)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open LifeLink AI Assistant'}
        title="LifeLink AI Health & Blood Availability Assistant"
      >
        {/* Pulse beacon when closed */}
        {hasUnreadPulse && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{
                background: '#E81743',
                animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            <span
              className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white"
              style={{ background: '#ff4d75' }}
            />
          </span>
        )}

        {isOpen ? (
          <X className="w-4 h-4 shrink-0" />
        ) : (
          <Sparkles className="w-4 h-4 shrink-0" />
        )}

        <span className="leading-none tracking-wide">
          {isOpen ? 'Close' : 'AI Health Assistant'}
        </span>

        {!isOpen && (
          <span
            className="hidden sm:inline-block px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider leading-none"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            Ask AI
          </span>
        )}
      </button>

      {/* Keyframe styles injected inline to avoid needing a CSS file */}
      <style>{`
        @keyframes chatbot-slide-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
