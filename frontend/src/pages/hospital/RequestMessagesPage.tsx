import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hospitalApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { RequestMessage, BloodRequest } from '../../types';
import { MessageSquare, Send, ShieldCheck, User, RefreshCw, AlertCircle, Phone, Landmark, PlusCircle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

export const RequestMessagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryReqId = searchParams.get('requestId');
  const { user } = useAuth();

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [text, setText] = useState('');
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all requisitions for this hospital to populate conversation hub
  useEffect(() => {
    const fetchHospitalConversations = async () => {
      setLoadingRequests(true);
      setError(null);

      const res = await hospitalApi.getRequests();
      if (res.success && res.requests) {
        setRequests(res.requests);

        // Preselection: use query param if present and valid; else first ticket
        if (queryReqId && res.requests.some((r: BloodRequest) => r.id === queryReqId)) {
          setSelectedReqId(queryReqId);
        } else if (res.requests.length > 0) {
          setSelectedReqId(res.requests[0].id);
          setSearchParams({ requestId: res.requests[0].id });
        } else {
          setSelectedReqId('');
        }
      } else {
        setError(res.error || 'Failed to load hospital requisition conversations.');
      }
      setLoadingRequests(false);
    };

    fetchHospitalConversations();
  }, [user]);

  // Sync selected requisition if query parameter changes
  useEffect(() => {
    if (queryReqId && requests.length > 0 && queryReqId !== selectedReqId) {
      if (requests.some(r => r.id === queryReqId)) {
        setSelectedReqId(queryReqId);
        setText('');
        setError(null);
      }
    }
  }, [queryReqId, requests]);

  // Load messages whenever selected conversation changes
  const fetchMessagesForRequisition = async (reqId: string) => {
    if (!reqId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);

    const res = await hospitalApi.getMessages(reqId);
    if (res.success && res.messages) {
      setMessages(res.messages);
    } else {
      setError(res.error || `Unable to load messages for requisition ${reqId}`);
      setMessages([]);
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (selectedReqId) {
      fetchMessagesForRequisition(selectedReqId);
    }
  }, [selectedReqId]);

  // Handle switching conversation
  const handleSelectConversation = (reqId: string) => {
    if (reqId === selectedReqId) return;
    setSelectedReqId(reqId);
    setSearchParams({ requestId: reqId });
    setText('');
    setError(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedReqId) return;

    setSending(true);
    setError(null);

    const messageContent = text.trim();
    const res = await hospitalApi.sendMessage(selectedReqId, messageContent);

    setSending(false);
    if (res.success && res.message) {
      setText('');
      // Optimistically append new message to avoid jitter
      setMessages(prev => [...prev, res.message]);
    } else {
      setError(res.error || 'Failed to send message. Please check connection and try again.');
    }
  };

  const selectedRequest = requests.find(r => r.id === selectedReqId);
  const facilityName = (user as any)?.hospitalName || user?.name || 'Hospital Facility';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Operational Communications
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">{facilityName}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Bank Communications Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Secure, request-isolated communication channel between surgical hospital staff and regional blood bank dispatchers.
          </p>
        </div>

        {selectedReqId && (
          <button
            onClick={() => fetchMessagesForRequisition(selectedReqId)}
            disabled={loadingMessages}
            title="Refresh current chat"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin text-blood-600' : ''}`} />
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Multi-Conversation Hub: Responsive 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Requisition / Conversation Switcher (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 flex flex-col h-[650px]">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-blood-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Requisitions ({requests.length})
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Select to Chat</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingRequests ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <span>Loading conversations...</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-xs">No active conversations</p>
                <p className="text-[11px] text-slate-400 px-4">
                  Each blood requisition establishes a dedicated communication channel with the fulfilling blood center.
                </p>
                <Link
                  to="/hospital/requests/new"
                  className="inline-block mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blood-50 text-blood-700 hover:bg-blood-100 transition-colors"
                >
                  + Create Requisition
                </Link>
              </div>
            ) : (
              requests.map(req => {
                const isSelected = req.id === selectedReqId;
                return (
                  <div
                    key={req.id}
                    onClick={() => handleSelectConversation(req.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blood-500 bg-blood-50/60 shadow-sm ring-1 ring-blood-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono font-bold text-xs text-slate-900">{req.id}</span>
                      <StatusBadge status={req.urgency} />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blood-700">{req.bloodGroup} {req.component}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{req.fulfilledUnits} / {req.quantityUnits} Units</span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      {req.bloodBankName || 'Regional Blood Center'}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Status: <strong className="text-slate-700">{req.status}</strong></span>
                      <span>{new Date(req.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Messages Workspace (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
          
          {selectedRequest ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-extrabold text-sm text-slate-900">{selectedRequest.id}</span>
                    <StatusBadge status={selectedRequest.urgency} />
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
                    <Landmark className="w-3.5 h-3.5 text-slate-400" />
                    <span>Lab Dispatch Partner: <strong className="text-slate-800">{selectedRequest.bloodBankName || 'Regional Blood Center'}</strong></span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Encrypted Channel</span>
                  </span>

                  <Link
                    to={`/hospital/samples?requestId=${selectedRequest.id}`}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                  >
                    Samples
                  </Link>
                </div>
              </div>

              {/* Message History Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Loading message history for {selectedRequest.id}...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-400">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                    <p className="font-bold text-xs text-slate-700">No messages exchanged yet</p>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      Send an operational verification note, blood transport query, or surgical schedule update to initiate direct communication with the blood bank lab.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isBloodBank = m.senderRole === 'blood_bank';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isBloodBank ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
                          <span className="font-bold text-slate-700">{m.senderName}</span>
                          <span>•</span>
                          <span className={`px-1 rounded text-[9px] font-bold uppercase ${
                            isBloodBank ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {isBloodBank ? 'Blood Bank Lab' : 'Hospital Staff'}
                          </span>
                          <span>•</span>
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl max-w-lg text-xs leading-relaxed shadow-sm ${
                            isBloodBank
                              ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                              : 'bg-blood-600 text-white rounded-tr-none'
                          }`}
                        >
                          {m.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex space-x-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type operational verification update, courier info, or clinical query..."
                  className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-blood-500 focus:outline-none"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-blood-600 hover:bg-blood-700 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">No Requisition Selected</p>
              <p className="text-xs text-slate-400">
                Select an active ticket from the left panel to open its encrypted communication channel.
              </p>
            </div>
          )}

        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};
