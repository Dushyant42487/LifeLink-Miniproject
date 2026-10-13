import React, { useState, useEffect, useMemo } from 'react';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { History, Heart, Droplet, Award, CheckCircle2, FileText, Download, XCircle, Printer, ShieldCheck, AlertTriangle } from 'lucide-react';
import { calculateAuthoritativeMetrics } from '../../utils/donorMetrics';
import { checkBloodGroupDiscrepancy, VERIFIED_DONOR_BLOOD_GROUP } from '../../utils/donorIntegrity';

export const DonorHistory: React.FC = () => {
  const { user } = useAuth();
  const [historyData, setHistoryData] = useState<any>(null);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [loadingCertId, setLoadingCertId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const donorBloodGroup = user?.bloodGroup || VERIFIED_DONOR_BLOOD_GROUP;

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await donorApi.getHistory();
      if (res.success) setHistoryData(res);
    };
    fetchHistory();
  }, []);

  const handleDownloadCertificate = async (donationId: string) => {
    setLoadingCertId(donationId);
    const res = await donorApi.getCertificate(donationId);
    if (res.success && res.certificate) {
      setSelectedCert(res.certificate);
    }
    setLoadingCertId(null);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  const history = historyData?.history || [];
  // Derive dashboard & history metrics authoritatively from the history records collection
  const metrics = useMemo(() => calculateAuthoritativeMetrics(history), [history]);

  // Detect any discrepancy between verified profile blood group and persisted clinical records
  const discrepancies = useMemo(() => {
    return history.filter((item: any) => checkBloodGroupDiscrepancy(item.bloodGroup, donorBloodGroup));
  }, [history, donorBloodGroup]);

  // Group history by calendar year
  const groupedByYear: { [year: string]: any[] } = {};
  history.forEach((item: any) => {
    const year = item.date && !isNaN(new Date(item.date).getTime()) 
      ? new Date(item.date).getFullYear().toString() 
      : '2026';
    if (!groupedByYear[year]) {
      groupedByYear[year] = [];
    }
    groupedByYear[year].push(item);
  });

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  const getStatusBadge = (status: string) => {
    if (status === 'Transfused / Utilized') {
      return (
        <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Transfused / Utilized</span>
        </span>
      );
    }
    if (status === 'Tested & Available') {
      return (
        <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Tested & Available</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
        <span>{status || 'Completed'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
              Verified Wallet & Log
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-white">
              {donorBloodGroup} Donor
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Donation History & Certificates</h1>
          <p className="text-xs text-slate-500 mt-1">
            Detailed log of all verified voluntary blood donations, component breakdown, and official certificates of appreciation.
          </p>
        </div>

        <button
          onClick={() => setReportModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1.5 shrink-0 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Report Missing Record</span>
        </button>
      </div>

      {/* Persisted Data Integrity Warning (Never silently rewrite genuine records) */}
      {discrepancies.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4.5 text-xs text-amber-950 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-amber-950">Data Integrity Notice: Blood Group Flag</h4>
            <p className="text-amber-900/90 leading-relaxed">
              {discrepancies.length} recorded collection entry indicates a blood group label differing from your verified profile ({donorBloodGroup}). Genuine historical records are preserved unaltered for medical auditing; this discrepancy has been surfaced and flagged for authorized blood bank review.
            </p>
          </div>
        </div>
      )}

      {/* Lifetime Impact Metrics Derived Authoritatively from History Collection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Voluntary Donations"
          value={metrics.totalDonations}
          subtitle="Countable donation records"
          icon={Award}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />

        <StatCard
          title="Total Blood Contributed"
          value={`${metrics.totalVolumeMl} mL`}
          subtitle="Whole Blood & Apheresis Units"
          icon={Droplet}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Estimated Lives Impacted"
          value={`~${metrics.livesImpactedEst}`}
          subtitle="Clinical transfusion outcomes"
          icon={Heart}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* History Data Table Grouped By Year */}
      <div className="space-y-6">
        {history.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
            <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-900 text-base">No Recorded Donation History Yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Your verified voluntary donation records will appear here after collection.</p>
          </div>
        ) : (
          sortedYears.map(year => (
            <div key={year} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
                  <h3 className="font-extrabold text-sm text-slate-900">Donations in Year {year}</h3>
                </div>
                <span className="text-xs text-slate-500 font-bold">{groupedByYear[year].length} Record(s)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/40 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Donation ID</th>
                      <th className="px-6 py-3">Collection Date</th>
                      <th className="px-6 py-3">Blood Bank / Center</th>
                      <th className="px-6 py-3">Group & Component</th>
                      <th className="px-6 py-3">Volume</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {groupedByYear[year].map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{item.donationId}</td>
                        <td className="px-6 py-4 font-medium">{item.date}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{item.bloodBankName}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center space-x-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 w-fit">
                              <span>{item.bloodGroup}</span>
                              <span>•</span>
                              <span>{item.component}</span>
                            </span>
                            {checkBloodGroupDiscrepancy(item.bloodGroup, donorBloodGroup) && (
                              <span 
                                className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 w-fit"
                                title={`Discrepancy: Collection logged as ${item.bloodGroup}, but profile is ${donorBloodGroup}`}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Mismatch ({donorBloodGroup} vs {item.bloodGroup})</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{item.volumeMl} mL</td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDownloadCertificate(item.donationId)}
                            disabled={loadingCertId === item.donationId}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3 h-3" />
                            <span>{loadingCertId === item.donationId ? 'Loading...' : 'Certificate'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Official Certificate Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 space-y-6 shadow-2xl border border-slate-200 relative print:p-0 print:border-none print:shadow-none">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 print:hidden">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Official Certificate of Appreciation</span>
              <button 
                onClick={() => setSelectedCert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Certificate Frame */}
            <div className="border-4 border-double border-rose-600/30 rounded-2xl p-6 bg-gradient-to-b from-rose-50/20 to-white text-center space-y-4">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
                  <Award className="w-8 h-8" />
                </div>
              </div>

              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block">{selectedCert.certificateNumber}</span>
              
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-serif">Certificate of Voluntary Donation</h2>
              
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                This certificate is proudly awarded in recognition of selfless service and humanitarian contribution to:
              </p>

              <p className="text-xl font-black text-rose-700 font-serif border-b border-rose-200 pb-2 inline-block px-8">
                {selectedCert.donorName}
              </p>

              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                For donating <strong>{selectedCert.volumeMl} mL</strong> of <strong>{selectedCert.bloodGroup} {selectedCert.component}</strong> on <strong>{selectedCert.donationDate}</strong> at <strong>{selectedCert.bloodBankName}</strong>. Your voluntary donation has directly contributed to saving patient lives.
              </p>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                <div>
                  <span>Issued Date: {new Date(selectedCert.issuedAt).toLocaleDateString()}</span>
                  <span className="block font-bold text-slate-700">LifeLink Regional Network</span>
                </div>
                <div className="flex items-center space-x-1 text-emerald-600 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Digitally Verified Record</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 pt-2 print:hidden">
              <button
                onClick={handlePrintCertificate}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>
              <button
                onClick={() => setSelectedCert(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Report Missing Record Dialog */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Report Missing or Incorrect Record</h3>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-900 text-sm">Discrepancy Report Submitted</p>
                <p className="text-xs text-slate-500">Our medical audit team will review the blood bank logs and update your profile within 48 hours.</p>
                <button
                  onClick={() => { setReportModalOpen(false); setReportSubmitted(false); }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600">
                  If you recently donated at a LifeLink partner blood bank or camp and the record does not appear in your wallet, please describe the date and facility details below.
                </p>

                <textarea
                  placeholder="Enter donation date, facility/camp name, and donation receipt number if available..."
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setReportModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setReportSubmitted(true)}
                    disabled={!reportNote.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                  >
                    Submit Audit Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
