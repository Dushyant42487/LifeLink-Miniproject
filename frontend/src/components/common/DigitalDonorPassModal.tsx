import React, { useEffect } from 'react';
import { QrCode, Printer, X, ShieldCheck } from 'lucide-react';

interface DigitalDonorPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: any;
}

export const DigitalDonorPassModal: React.FC<DigitalDonorPassModalProps> = ({
  isOpen,
  onClose,
  passData
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !passData) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Digital Donor Pass"
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative print:p-0 print:border-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">LifeLink Verified Digital Donor Pass</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close Digital Donor Pass"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Digital Card Frame */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 text-white rounded-2xl p-6 border border-slate-700 shadow-xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">LifeLink Donor Network</span>
              <h3 className="text-xl font-extrabold text-white">{passData.name}</h3>
              <p className="text-[11px] text-slate-300">
                Donor ID: <span className="font-mono text-white font-bold">{passData.donorId}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-600 text-white font-black text-xl flex items-center justify-center shadow-md border border-rose-400/30">
              {passData.bloodGroup}
            </div>
          </div>

          {/* QR Code Matrix */}
          <div className="bg-white p-4 rounded-xl text-center space-y-2 max-w-[200px] mx-auto shadow-inner">
            <div className="w-36 h-36 mx-auto bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center text-white space-y-1">
              <QrCode className="w-24 h-24 text-white" />
              <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">Verified Token Payload</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600 block truncate font-semibold">{passData.qrToken}</span>
          </div>

          <div className="text-[10px] text-slate-300 space-y-1 text-center border-t border-slate-700/80 pt-3">
            <p>
              Verified Donations: <strong className="text-white">{passData.totalDonations !== undefined ? passData.totalDonations : 0}</strong> • Status:{' '}
              <strong className={
                passData.verificationStatus === 'Verified' 
                  ? 'text-emerald-400' 
                  : passData.verificationStatus === 'Pending Verification'
                  ? 'text-amber-400'
                  : passData.verificationStatus === 'Rejected'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }>{passData.verificationStatus || 'Unverified'}</strong>
            </p>
            <p className="text-[9px] text-slate-400 leading-tight">{passData.passNotice}</p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-1 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save Pass</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
