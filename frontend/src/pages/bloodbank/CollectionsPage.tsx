import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, bloodBankApi } from '../../services/api';
import { BloodGroup, BloodComponent, BloodCollectionRecord, ComponentFractionationRecord, DonationCamp, CampRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Syringe, 
  CheckCircle2, 
  ArrowRight, 
  Compass, 
  Search, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Users, 
  RefreshCw, 
  AlertTriangle, 
  Layers, 
  Plus, 
  X, 
  Clock, 
  Edit3, 
  Ban, 
  FileText, 
  Activity, 
  ShieldAlert,
  Info,
  Building2
} from 'lucide-react';

export const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'phlebotomy' | 'camps' | 'camp-requests' | 'fractionation'>('phlebotomy');

  // ==========================================
  // TAB 1: PHLEBOTOMY LOGGER STATE
  // ==========================================
  const [donorSearch, setDonorSearch] = useState('');
  const [donorSearchResults, setDonorSearchResults] = useState<any[]>([]);
  const [searchingDonors, setSearchingDonors] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<any | null>(null);
  const [verifyingDonor, setVerifyingDonor] = useState(false);
  const [staffVerifying, setStaffVerifying] = useState(false);

  const [donorCode, setDonorCode] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O-');
  const [collectionType, setCollectionType] = useState<'In-House Phlebotomy' | 'Mobile Camp'>('In-House Phlebotomy');
  const [selectedCampId, setSelectedCampId] = useState<string>('');
  const [volumeMl, setVolumeMl] = useState('450');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectionTime, setCollectionTime] = useState(new Date().toTimeString().slice(0, 5));
  const [phlebotomistName, setPhlebotomistName] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingCollection, setSubmittingCollection] = useState(false);
  const [createdCollection, setCreatedCollection] = useState<BloodCollectionRecord | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Collections History
  const [recentCollections, setRecentCollections] = useState<BloodCollectionRecord[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // ==========================================
  // TAB 2: CAMPS STATE
  // ==========================================
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(false);
  const [campsError, setCampsError] = useState<string | null>(null);

  // Camp Modals
  const [showCreateCampModal, setShowCreateCampModal] = useState(false);
  const [showEditCampModal, setShowEditCampModal] = useState(false);
  const [editingCamp, setEditingCamp] = useState<DonationCamp | null>(null);
  const [campModalError, setCampModalError] = useState<string | null>(null);
  const [submittingCamp, setSubmittingCamp] = useState(false);

  // Camp Collections Modal
  const [inspectingCamp, setInspectingCamp] = useState<DonationCamp | null>(null);
  const [campCollections, setCampCollections] = useState<BloodCollectionRecord[]>([]);
  const [loadingCampCollections, setLoadingCampCollections] = useState(false);

  // New Camp Form
  const [campForm, setCampForm] = useState({
    title: '',
    organizer: '',
    location: '',
    address: '',
    city: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    timeSlot: '',
    targetUnits: 50,
    contactPhone: '',
    description: '',
    isUrgent: false
  });

  // ==========================================
  // TAB 3: FRACTIONATION STATE
  // ==========================================
  const [pendingCollections, setPendingCollections] = useState<BloodCollectionRecord[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [fractionationHistory, setFractionationHistory] = useState<ComponentFractionationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fractionationError, setFractionationError] = useState<string | null>(null);

  // Fractionation Processing Modal
  const [activeFractionatingCollection, setActiveFractionatingCollection] = useState<BloodCollectionRecord | null>(null);
  const [processingFractionation, setProcessingFractionation] = useState(false);
  const [fractionationModalError, setFractionationModalError] = useState<string | null>(null);
  const [fractionationSuccess, setFractionationSuccess] = useState<any | null>(null);

  // Fractionation Components Config
  const [fracRbc, setFracRbc] = useState(true);
  const [fracRbcVolume, setFracRbcVolume] = useState('250');
  const [fracRbcBay, setFracRbcBay] = useState('');

  const [fracPlasma, setFracPlasma] = useState(true);
  const [fracPlasmaVolume, setFracPlasmaVolume] = useState('200');
  const [fracPlasmaBay, setFracPlasmaBay] = useState('');

  const [fracPlatelets, setFracPlatelets] = useState(false);
  const [fracPlateletsVolume, setFracPlateletsVolume] = useState('50');
  const [fracPlateletsBay, setFracPlateletsBay] = useState('');

  const [processingNotes, setProcessingNotes] = useState('');

  // ==========================================
  // TAB 4: CAMP REQUESTS STATE
  // ==========================================
  const [campRequests, setCampRequests] = useState<CampRequest[]>([]);
  const [loadingCampRequests, setLoadingCampRequests] = useState(false);
  const [campRequestsFilter, setCampRequestsFilter] = useState<'all' | 'Submitted' | 'Approved' | 'Rejected'>('all');
  const [activeCampRequest, setActiveCampRequest] = useState<CampRequest | null>(null);
  const [showAcceptCampModal, setShowAcceptCampModal] = useState(false);
  const [acceptingCampDate, setAcceptingCampDate] = useState('');
  const [acceptingCampTime, setAcceptingCampTime] = useState('');
  const [acceptingCampNotes, setAcceptingCampNotes] = useState('');
  const [processingCampAction, setProcessingCampAction] = useState(false);
  const [campActionMessage, setCampActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ==========================================
  // EFFECTS & FETCHERS
  // ==========================================

  // Dynamic Donor Search
  useEffect(() => {
    if (!donorSearch || donorSearch.trim().length < 2) {
      setDonorSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingDonors(true);
      try {
        const res = await apiFetch(`/blood-bank/donors/search?q=${encodeURIComponent(donorSearch.trim())}`);
        if (res.success && res.donors) {
          setDonorSearchResults(res.donors);
        }
      } catch (err) {
        // Ignore search errors
      } finally {
        setSearchingDonors(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [donorSearch]);

  // Initial load & Tab switching
  useEffect(() => {
    fetchCamps();
    fetchRecentCollections();
    fetchCampRequests();
    if (activeTab === 'fractionation') {
      fetchFractionationData();
    }
  }, [activeTab]);

  const fetchCampRequests = async () => {
    setLoadingCampRequests(true);
    try {
      const res = await bloodBankApi.getCampRequests();
      if (res.success && res.requests) {
        setCampRequests(res.requests);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingCampRequests(false);
    }
  };

  const handleOpenAcceptModal = (req: CampRequest) => {
    setActiveCampRequest(req);
    setAcceptingCampDate(req.proposedDate);
    setAcceptingCampTime(req.preferredTimeSlot || '09:00 AM - 05:00 PM');
    setAcceptingCampNotes('');
    setShowAcceptCampModal(true);
  };

  const handleConfirmAcceptCamp = async () => {
    if (!activeCampRequest) return;
    setProcessingCampAction(true);
    setCampActionMessage(null);
    try {
      const res = await bloodBankApi.acceptCampRequest(activeCampRequest.id, {
        scheduledDate: acceptingCampDate,
        timeSlot: acceptingCampTime,
        notes: acceptingCampNotes
      });
      if (res.success) {
        setCampActionMessage({ type: 'success', text: `Camp request approved and scheduled successfully!` });
        setShowAcceptCampModal(false);
        setActiveCampRequest(null);
        await Promise.all([fetchCampRequests(), fetchCamps()]);
      } else {
        setCampActionMessage({ type: 'error', text: res.error || 'Failed to approve camp request.' });
      }
    } catch {
      setCampActionMessage({ type: 'error', text: 'Server communication error while approving camp request.' });
    } finally {
      setProcessingCampAction(false);
    }
  };

  const handleRejectCamp = async (req: CampRequest) => {
    const reason = window.prompt(`Please provide a reason for declining the camp request from ${req.organizationName}:`, 'Logistical or scheduling capacity constraints.');
    if (reason === null) return;
    setProcessingCampAction(true);
    setCampActionMessage(null);
    try {
      const res = await bloodBankApi.rejectCampRequest(req.id, { reason });
      if (res.success) {
        setCampActionMessage({ type: 'success', text: `Camp request from ${req.organizationName} declined.` });
        await fetchCampRequests();
      } else {
        setCampActionMessage({ type: 'error', text: res.error || 'Failed to decline camp request.' });
      }
    } catch {
      setCampActionMessage({ type: 'error', text: 'Server communication error.' });
    } finally {
      setProcessingCampAction(false);
    }
  };

  const fetchRecentCollections = async () => {
    setLoadingCollections(true);
    try {
      const res = await apiFetch('/blood-bank/collections');
      if (res.success && res.collections) {
        setRecentCollections(res.collections);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchCamps = async () => {
    setLoadingCamps(true);
    setCampsError(null);
    try {
      const res = await apiFetch('/blood-bank/camps');
      if (res.success && res.camps) {
        setCamps(res.camps);
      } else {
        setCampsError(res.error || 'Failed to load donation drives.');
      }
    } catch (err: any) {
      setCampsError(err?.message || 'Network error fetching drives.');
    } finally {
      setLoadingCamps(false);
    }
  };

  const fetchFractionationData = async () => {
    setLoadingPending(true);
    setLoadingHistory(true);
    setFractionationError(null);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        apiFetch('/blood-bank/fractionation/pending'),
        apiFetch('/blood-bank/fractionation')
      ]);

      if (pendingRes.success && pendingRes.collections) {
        setPendingCollections(pendingRes.collections);
      }
      if (historyRes.success && historyRes.records) {
        setFractionationHistory(historyRes.records);
      }
    } catch (err: any) {
      setFractionationError(err?.message || 'Error fetching fractionation data.');
    } finally {
      setLoadingPending(false);
      setLoadingHistory(false);
    }
  };

  // Select and verify donor
  const handleSelectDonor = async (donor: any) => {
    setVerifyingDonor(true);
    setCollectionError(null);
    try {
      const res = await apiFetch(`/blood-bank/donors/${donor.id}`);
      if (res.success && res.donor) {
        const d = res.donor;
        setSelectedDonor(d);
        setDonorCode(`${d.donorCode} (${d.name})`);
        if (d.bloodGroup) {
          setBloodGroup(d.bloodGroup as BloodGroup);
        }
      } else {
        setSelectedDonor(donor);
        setDonorCode(`${donor.donorCode} (${donor.name})`);
        if (donor.bloodGroup) {
          setBloodGroup(donor.bloodGroup as BloodGroup);
        }
      }
    } catch (err) {
      setSelectedDonor(donor);
      setDonorCode(`${donor.donorCode} (${donor.name})`);
    } finally {
      setVerifyingDonor(false);
      setDonorSearchResults([]);
      setDonorSearch('');
    }
  };

  // Submit Blood Collection
  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCollection(true);
    setCollectionError(null);

    // Front-end eligibility check
    if (selectedDonor && selectedDonor.isEligible === false) {
      setCollectionError(`Donor is clinically deferred: ${selectedDonor.deferralReason || 'Ineligible for donation'}. Collection cannot proceed.`);
      setSubmittingCollection(false);
      return;
    }

    const vol = Number(volumeMl);
    if (isNaN(vol) || vol < 300 || vol > 550) {
      setCollectionError('Whole blood collection volume must be clinically between 300 mL and 550 mL.');
      setSubmittingCollection(false);
      return;
    }

    // Client idempotency key
    const clientKey = `phleb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await apiFetch('/blood-bank/collections', {
        method: 'POST',
        body: JSON.stringify({
          donorId: selectedDonor?.id,
          donorCode: donorCode || undefined,
          collectionType,
          campId: collectionType === 'Mobile Camp' ? selectedCampId : undefined,
          volumeMl: vol,
          collectionDate,
          collectionTime,
          phlebotomistName,
          notes,
          idempotencyKey: clientKey
        })
      });

      if (res.success && res.collectionRecord) {
        setCreatedCollection(res.collectionRecord);
        setSelectedDonor(null);
        setDonorCode('');
        fetchRecentCollections();
      } else {
        setCollectionError(res.error || 'Failed to record collection record.');
      }
    } catch (err: any) {
      setCollectionError(err?.message || 'Network error recording collection.');
    } finally {
      setSubmittingCollection(false);
    }
  };

  // Submit Camp Creation
  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCamp(true);
    setCampModalError(null);

    try {
      const res = await apiFetch('/blood-bank/camps', {
        method: 'POST',
        body: JSON.stringify(campForm)
      });

      if (res.success && res.camp) {
        setShowCreateCampModal(false);
        setCampForm({
          title: '',
          organizer: '',
          location: '',
          address: '',
          city: 'Metropolis',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          timeSlot: '09:00 AM - 04:00 PM',
          targetUnits: 50,
          contactPhone: '+1-555-0199',
          description: '',
          isUrgent: false
        });
        fetchCamps();
      } else {
        setCampModalError(res.error || 'Failed to create donation drive.');
      }
    } catch (err: any) {
      setCampModalError(err?.message || 'Network error creating camp.');
    } finally {
      setSubmittingCamp(false);
    }
  };

  // Submit Camp Edit
  const handleUpdateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamp) return;
    setSubmittingCamp(true);
    setCampModalError(null);

    try {
      const res = await apiFetch(`/blood-bank/camps/${editingCamp.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingCamp.title,
          organizer: editingCamp.organizer,
          location: editingCamp.location,
          address: editingCamp.address,
          startDate: editingCamp.startDate,
          endDate: editingCamp.endDate,
          timeSlot: editingCamp.timeSlot,
          targetUnits: Number(editingCamp.targetUnits),
          contactPhone: editingCamp.contactPhone,
          description: editingCamp.description,
          isUrgent: editingCamp.isUrgent
        })
      });

      if (res.success && res.camp) {
        setShowEditCampModal(false);
        setEditingCamp(null);
        fetchCamps();
      } else {
        setCampModalError(res.error || 'Failed to update camp.');
      }
    } catch (err: any) {
      setCampModalError(err?.message || 'Network error updating camp.');
    } finally {
      setSubmittingCamp(false);
    }
  };

  // Cancel Camp
  const handleCancelCamp = async (camp: DonationCamp) => {
    if (!window.confirm(`Are you sure you want to cancel the donation drive "${camp.title}" (${camp.id})?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/blood-bank/camps/${camp.id}/cancel`, {
        method: 'POST'
      });
      if (res.success) {
        fetchCamps();
      } else {
        alert(res.error || 'Failed to cancel camp.');
      }
    } catch (err: any) {
      alert(err?.message || 'Network error cancelling camp.');
    }
  };

  // View Camp Collections
  const handleInspectCampCollections = async (camp: DonationCamp) => {
    setInspectingCamp(camp);
    setLoadingCampCollections(true);
    try {
      const res = await apiFetch(`/blood-bank/camps/${camp.id}/collections`);
      if (res.success && res.collections) {
        setCampCollections(res.collections);
      } else {
        setCampCollections([]);
      }
    } catch (err) {
      setCampCollections([]);
    } finally {
      setLoadingCampCollections(false);
    }
  };

  // Open Fractionation Modal for a collection
  const handleOpenFractionation = (col: BloodCollectionRecord) => {
    setActiveFractionatingCollection(col);
    setFractionationModalError(null);
    setFractionationSuccess(null);

    // Estimate realistic component breakdown based on source volume
    const vol = col.volumeMl || 450;
    if (vol >= 450) {
      setFracRbc(true);
      setFracRbcVolume('250');
      setFracPlasma(true);
      setFracPlasmaVolume('200');
      setFracPlatelets(false);
      setFracPlateletsVolume('50');
    } else {
      setFracRbc(true);
      setFracRbcVolume(String(Math.round(vol * 0.55)));
      setFracPlasma(true);
      setFracPlasmaVolume(String(Math.round(vol * 0.45)));
      setFracPlatelets(false);
      setFracPlateletsVolume('50');
    }
  };

  // Process Fractionation
  const handleProcessFractionation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFractionatingCollection) return;

    setProcessingFractionation(true);
    setFractionationModalError(null);

    const componentsToProduce: any[] = [];
    let totalOutputVol = 0;

    if (fracRbc) {
      const rVol = Number(fracRbcVolume);
      if (rVol <= 0) {
        setFractionationModalError('RBC volume must be greater than 0.');
        setProcessingFractionation(false);
        return;
      }
      totalOutputVol += rVol;
      componentsToProduce.push({
        component: 'RBC',
        volumeMl: rVol,
        storageLocation: fracRbcBay || 'Quarantine Bay RBC-1'
      });
    }

    if (fracPlasma) {
      const pVol = Number(fracPlasmaVolume);
      if (pVol <= 0) {
        setFractionationModalError('Plasma volume must be greater than 0.');
        setProcessingFractionation(false);
        return;
      }
      totalOutputVol += pVol;
      componentsToProduce.push({
        component: 'Plasma',
        volumeMl: pVol,
        storageLocation: fracPlasmaBay || 'Quarantine Bay FFP-1'
      });
    }

    if (fracPlatelets) {
      const plVol = Number(fracPlateletsVolume);
      if (plVol <= 0) {
        setFractionationModalError('Platelets volume must be greater than 0.');
        setProcessingFractionation(false);
        return;
      }
      totalOutputVol += plVol;
      componentsToProduce.push({
        component: 'Platelets',
        volumeMl: plVol,
        storageLocation: fracPlateletsBay || 'Quarantine Bay PLT-1'
      });
    }

    if (componentsToProduce.length === 0) {
      setFractionationModalError('Please select at least one component to fractionate.');
      setProcessingFractionation(false);
      return;
    }

    if (totalOutputVol > activeFractionatingCollection.volumeMl + 50) {
      setFractionationModalError(`Sum of component volumes (${totalOutputVol} mL) exceeds source whole blood volume (${activeFractionatingCollection.volumeMl} mL) beyond acceptable tolerance.`);
      setProcessingFractionation(false);
      return;
    }

    try {
      const res = await apiFetch('/blood-bank/fractionation', {
        method: 'POST',
        body: JSON.stringify({
          collectionId: activeFractionatingCollection.id,
          components: componentsToProduce,
          processingNotes
        })
      });

      if (res.success && res.fractionationRecord) {
        setFractionationSuccess(res);
        fetchFractionationData();
        fetchRecentCollections();
      } else {
        setFractionationModalError(res.error || 'Failed to complete fractionation process.');
      }
    } catch (err: any) {
      setFractionationModalError(err?.message || 'Network error processing fractionation.');
    } finally {
      setProcessingFractionation(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
              <Syringe className="w-3 h-3" />
              <span>Blood Processing & Drives</span>
            </span>
            <span className="text-xs text-slate-400">Phase 5B Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Collections, Mobile Drives & Fractionation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log verified donor phlebotomies, coordinate mobile drives, and trace component fractionation into quarantined units.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto space-x-1">
          <button
            onClick={() => setActiveTab('phlebotomy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'phlebotomy'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Syringe className="w-3.5 h-3.5" />
            <span>Phlebotomy Logger</span>
          </button>
          <button
            onClick={() => setActiveTab('camps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'camps'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Mobile Drives</span>
          </button>
          <button
            onClick={() => setActiveTab('camp-requests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'camp-requests'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Org Camp Requests</span>
            {campRequests.filter(r => r.status === 'Submitted').length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                {campRequests.filter(r => r.status === 'Submitted').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('fractionation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'fractionation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Component Fractionation</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: IN-HOUSE DONOR PHLEBOTOMY LOGGER                   */}
      {/* ======================================================== */}
      {activeTab === 'phlebotomy' && (
        <div className="space-y-6">
          {/* Clinical Workflow Notice */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authoritative Phlebotomy & Lifecycle Rules</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Recording a phlebotomy generates a validated <strong>Blood Collection Record</strong> in <strong>Quarantine</strong>. 
                Collections do <em>not</em> immediately enter available inventory. Units undergo mandatory viral marker screening and/or component fractionation before lab release.
              </p>
            </div>
          </div>

          {/* Success Banner */}
          {createdCollection && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Whole Blood Collection Successfully Recorded & Quarantined!</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Collection Barcode ID</span>
                    <span className="font-extrabold text-blood-700 font-mono text-sm">{createdCollection.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Donor Code</span>
                    <span className="font-bold text-slate-900">{createdCollection.donorCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Blood Group & Volume</span>
                    <span className="font-bold text-slate-900">{createdCollection.bloodGroup} • {createdCollection.volumeMl} mL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Collection Type</span>
                    <span className="font-semibold text-slate-700">{createdCollection.collectionType}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    Status: <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Testing Quarantine</span>
                  </span>
                  <span className="text-slate-600">
                    Fractionation: <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Pending</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  onClick={() => setCreatedCollection(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  Log Another Donor
                </button>
                <button
                  onClick={() => {
                    handleOpenFractionation(createdCollection);
                    setActiveTab('fractionation');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Process into Components (Fractionate)</span>
                </button>
                <button
                  onClick={() => navigate('/blood-bank/testing')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center space-x-1 cursor-pointer"
                >
                  <span>View Lab Screening</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Form Error */}
          {collectionError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{collectionError}</span>
            </div>
          )}

          {/* Phlebotomy Form */}
          <form onSubmit={handleRecordCollection} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Syringe className="w-4 h-4 text-blood-600" />
              <span>Donor Verification & Phlebotomy Intake</span>
            </h3>

            {/* Donor Search / Lookup Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Authoritative Donor Search & Eligibility Check
                </label>
                {selectedDonor && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    ID: {selectedDonor.id}
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  placeholder="Search donor by name, donor code (e.g. donor-1), email, or blood group..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blood-500/20"
                />
                {searchingDonors && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  </div>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {donorSearchResults.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-10 relative">
                  {donorSearchResults.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDonor(d)}
                      className="p-2.5 hover:bg-rose-50/50 cursor-pointer text-xs flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{d.name}</span>
                        <span className="text-slate-400 ml-2">({d.donorCode})</span>
                        <div className="text-[11px] text-slate-500">{d.email}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-50 text-rose-700 border border-rose-100">
                          {d.bloodGroup}
                        </span>
                        <div className={`text-[10px] font-semibold mt-0.5 ${d.isVerified === false ? 'text-amber-600 font-bold' : (d.isEligible === false ? 'text-rose-600' : 'text-emerald-600')}`}>
                          {d.isVerified === false ? (d.verificationStatus || 'Unverified') : (d.isEligible === false ? 'Deferred' : 'Eligible')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Donor Card */}
              {selectedDonor && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  selectedDonor.isEligible === false
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <User className={`w-4 h-4 ${selectedDonor.isEligible === false ? 'text-rose-600' : 'text-emerald-600'}`} />
                      <span className="font-bold text-sm">
                        {selectedDonor.name} <span className="font-mono text-xs font-normal">({selectedDonor.donorCode})</span>
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setSelectedDonor(null); setDonorCode(''); }}
                      className="text-[11px] underline font-bold cursor-pointer opacity-80 hover:opacity-100"
                    >
                      Change Donor
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-200/50 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Blood Group:</span>
                      <strong className="text-slate-900 font-bold">{selectedDonor.bloodGroup}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Verification:</span>
                      <strong className={selectedDonor.isVerified === false ? 'text-amber-700' : 'text-emerald-700'}>
                        {selectedDonor.verificationStatus || selectedDonor.bloodGroupVerificationStatus || (selectedDonor.isVerified ? 'Verified' : 'Unverified')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Weight:</span>
                      <span className="font-semibold text-slate-800">{selectedDonor.weightKg || '55'} kg</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Last Donation:</span>
                      <span className="font-semibold text-slate-800">{selectedDonor.lastDonationDate || 'None on record'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Medical Clearance:</span>
                      <strong className={selectedDonor.isEligible === false ? 'text-rose-700' : 'text-emerald-700'}>
                        {selectedDonor.isEligible === false ? 'Deferred' : 'Cleared for Donation'}
                      </strong>
                    </div>
                  </div>

                  {/* Staff Verification Action for Unverified/Pending Donors */}
                  {selectedDonor.isVerified === false && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start space-x-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs">Donor Verification Required</p>
                          <p className="text-[11px] text-amber-800">
                            Donor identity and blood group verification must be confirmed by authorized staff before blood collection.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setStaffVerifying(true);
                            const res = await apiFetch(`/blood-bank/donors/${selectedDonor.id}/verify`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'Verified' })
                            });
                            if (res.success) {
                              await handleSelectDonor({ id: selectedDonor.id });
                            } else {
                              setCollectionError(res.error || 'Failed to verify donor.');
                            }
                          } catch (err: any) {
                            setCollectionError(err.message || 'Error verifying donor.');
                          } finally {
                            setStaffVerifying(false);
                          }
                        }}
                        disabled={staffVerifying}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {staffVerifying ? 'Verifying...' : 'Approve & Verify Donor'}
                      </button>
                    </div>
                  )}

                  {selectedDonor.isEligible === false && selectedDonor.isVerified !== false && (
                    <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-700 font-medium text-[11px] flex items-center space-x-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span><strong>Clinical Alert:</strong> {selectedDonor.deferralReason || 'Donor does not meet standard clinical eligibility criteria.'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Donor ID / Code *</label>
                <input
                  type="text"
                  required
                  value={donorCode}
                  onChange={(e) => setDonorCode(e.target.value)}
                  placeholder="e.g. donor-1 or DON-1001"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Donor Blood Group *</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Setting *</label>
                <select
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="In-House Phlebotomy">In-House Blood Bank Phlebotomy</option>
                  <option value="Mobile Camp">Mobile Donation Drive / Camp</option>
                </select>
              </div>

              {collectionType === 'Mobile Camp' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Mobile Drive *</label>
                  <select
                    required
                    value={selectedCampId}
                    onChange={(e) => setSelectedCampId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
                  >
                    <option value="">Select Registered Drive...</option>
                    {camps.filter(c => c.status !== 'Cancelled').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Component</label>
                  <input
                    type="text"
                    disabled
                    value="Whole Blood (For Fractionation)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Whole Blood Volume (mL) *</label>
                <input
                  type="number"
                  required
                  min="300"
                  max="550"
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
                />
                <span className="text-[10px] text-slate-400">Standard whole blood: 350 mL or 450 mL</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Date *</label>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Time</label>
                <input
                  type="time"
                  value={collectionTime}
                  onChange={(e) => setCollectionTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phlebotomist Staff *</label>
                <input
                  type="text"
                  required
                  value={phlebotomistName}
                  onChange={(e) => setPhlebotomistName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phlebotomy Procedure Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submittingCollection || (selectedDonor && selectedDonor.isEligible === false)}
                className={`w-full py-3 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  selectedDonor && selectedDonor.isEligible === false
                    ? 'bg-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blood-600 hover:bg-blood-700 shadow-blood-500/20'
                }`}
              >
                <Syringe className="w-4 h-4" />
                <span>
                  {submittingCollection 
                    ? 'Validating & Recording Phlebotomy...' 
                    : selectedDonor && selectedDonor.isEligible === false
                    ? 'Cannot Record Collection (Donor Deferred)'
                    : 'Record Phlebotomy & Place in Testing Quarantine'}
                </span>
              </button>
            </div>
          </form>

          {/* Recent Collections Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Recent Collection Records</h3>
                <p className="text-[11px] text-slate-500">Authoritative whole-blood intake log scoped to this blood bank.</p>
              </div>
              <button
                onClick={fetchRecentCollections}
                disabled={loadingCollections}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCollections ? 'animate-spin' : ''}`} />
                <span>Refresh Log</span>
              </button>
            </div>

            {loadingCollections ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-300 mb-1" />
                <span>Loading recent collections...</span>
              </div>
            ) : recentCollections.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <span>No phlebotomy collections recorded yet.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Collection ID</th>
                      <th className="py-2.5 px-3">Donor</th>
                      <th className="py-2.5 px-3">Group</th>
                      <th className="py-2.5 px-3">Volume</th>
                      <th className="py-2.5 px-3">Type / Source</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Fractionation</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentCollections.map((col) => (
                      <tr key={col.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-blood-700">{col.id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {col.donorName}
                          <div className="text-[10px] text-slate-400 font-mono">{col.donorCode}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded font-extrabold text-[10px] bg-rose-50 text-rose-700 border border-rose-100">
                            {col.bloodGroup}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{col.volumeMl} mL</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {col.collectionType}
                          {col.campName && <div className="text-[10px] text-purple-600 truncate max-w-[120px]">{col.campName}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{col.collectionDate}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            col.status === 'Fractionated'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {col.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            col.fractionationStatus === 'Fractionated'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {col.fractionationStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {col.fractionationStatus === 'Pending' ? (
                            <button
                              onClick={() => {
                                handleOpenFractionation(col);
                                setActiveTab('fractionation');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer"
                            >
                              Fractionate
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MOBILE DONATION DRIVES / CAMPS                    */}
      {/* ======================================================== */}
      {activeTab === 'camps' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Mobile Donation Drives & Camp Coordination</h3>
              <p className="text-[11px] text-slate-500">Manage field blood donation drives, schedule dates, and track actual collected units.</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchCamps}
                disabled={loadingCamps}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCamps ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => {
                  setCampModalError(null);
                  setShowCreateCampModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blood-600 hover:bg-blood-700 text-white text-xs font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Drive</span>
              </button>
            </div>
          </div>

          {campsError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{campsError}</span>
            </div>
          )}

          {loadingCamps ? (
            <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300 mb-2" />
              <span>Loading registered blood drives...</span>
            </div>
          ) : camps.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Compass className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No mobile blood drives currently registered for this center.</p>
              <p className="mt-1 text-slate-400">Upcoming community mobilization drives will be listed here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {camps.map((camp: any) => {
                const target = camp.targetUnits || 1;
                const actual = camp.actualCollectedUnits || 0;
                const percent = Math.min(100, Math.round((actual / target) * 100));

                return (
                  <div key={camp.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                              {camp.id}
                            </span>
                            {camp.isDevFixture && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                Dev Fixture
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              camp.status === 'Cancelled'
                                ? 'bg-slate-100 text-slate-500'
                                : camp.status === 'Completed'
                                ? 'bg-blue-100 text-blue-700'
                                : camp.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {camp.status || 'Active'}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">{camp.title}</h4>
                          <p className="text-[11px] text-slate-500">{camp.organizer}</p>
                        </div>
                        {camp.isUrgent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Urgent Drive
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{camp.location}, {camp.address}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{camp.startDate} {camp.endDate && camp.endDate !== camp.startDate ? `to ${camp.endDate}` : ''} ({camp.timeSlot})</span>
                        </div>

                        {camp.contactPhone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{camp.contactPhone}</span>
                          </div>
                        )}
                      </div>

                      {/* Target vs Actual Progress */}
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">
                            Target Units: <strong>{camp.targetUnits}</strong>
                          </span>
                          <span className="font-bold text-blood-700">
                            Actual Collected: {actual} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              percent >= 100 ? 'bg-emerald-500' : 'bg-blood-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 text-right">
                          Registered Donors: {camp.registeredCount || 0}
                        </div>
                      </div>

                      {camp.description && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded-xl">
                          "{camp.description}"
                        </p>
                      )}
                    </div>

                    {/* Camp Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleInspectCampCollections(camp)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        >
                          View Collections ({actual})
                        </button>
                        {camp.status !== 'Cancelled' && (
                          <button
                            onClick={() => {
                              setSelectedCampId(camp.id);
                              setCollectionType('Mobile Camp');
                              setActiveTab('phlebotomy');
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blood-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                          >
                            + Log Collection
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {camp.status !== 'Cancelled' && camp.status !== 'Completed' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingCamp({ ...camp });
                                setCampModalError(null);
                                setShowEditCampModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Edit Drive"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancelCamp(camp)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Cancel Drive"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ORGANIZATIONAL CAMP REQUESTS                     */}
      {/* ======================================================== */}
      {activeTab === 'camp-requests' && (
        <div className="space-y-6">
          {/* Header Notice */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 text-xs text-sky-900 flex items-start space-x-3">
            <Building2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Community & Corporate Blood Donation Camp Requests</p>
              <p className="text-sky-800 text-[11px] mt-0.5">
                Review and approve incoming blood drive coordination requests submitted by universities, corporate offices, and community organizers.
                Approving a request automatically schedules a public drive and dispatches in-app confirmation to the organizer.
              </p>
            </div>
          </div>

          {campActionMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              campActionMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>{campActionMessage.text}</span>
              <button onClick={() => setCampActionMessage(null)} className="text-xs hover:underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-1">
              {(['all', 'Submitted', 'Approved', 'Rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCampRequestsFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    campRequestsFilter === f
                      ? 'bg-blood-50 text-blood-700 border border-blood-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  {f === 'all' ? `All Requests (${campRequests.length})` : 
                   f === 'Submitted' ? `Pending Review (${campRequests.filter(r => r.status === 'Submitted').length})` :
                   f === 'Approved' ? `Approved (${campRequests.filter(r => r.status === 'Approved').length})` :
                   `Declined (${campRequests.filter(r => r.status === 'Rejected').length})`}
                </button>
              ))}
            </div>

            <button
              onClick={fetchCampRequests}
              disabled={loadingCampRequests}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCampRequests ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Requests List */}
          {loadingCampRequests ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blood-600" />
              <span>Loading camp requests...</span>
            </div>
          ) : campRequests.filter(r => campRequestsFilter === 'all' || r.status === campRequestsFilter).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="font-bold text-slate-700 text-sm">No Camp Requests Found</p>
              <p className="text-xs">No organizational requests match the selected status filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {campRequests
                .filter(r => campRequestsFilter === 'all' || r.status === campRequestsFilter)
                .map(req => (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-extrabold text-slate-900 text-sm">{req.organizationName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {req.organizationType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: {req.id} • Submitted: {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <StatusBadge status={req.status} />
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Organizer */}
                      <div className="bg-slate-50/70 rounded-xl p-3 space-y-1.5 border border-slate-100">
                        <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          Organizer Contact
                        </p>
                        <p className="font-bold text-slate-900">{req.organizerName} {req.organizerRole ? `(${req.organizerRole})` : ''}</p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {req.organizerPhone}
                        </p>
                        <p className="text-slate-500 text-[11px] truncate">{req.organizerEmail}</p>
                      </div>

                      {/* Logistics */}
                      <div className="bg-slate-50/70 rounded-xl p-3 space-y-1.5 border border-slate-100">
                        <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Target Schedule & Venue
                        </p>
                        <p className="font-bold text-slate-900">
                          {req.proposedDate} • {req.preferredTimeSlot || 'Flexible Slot'}
                        </p>
                        <p className="text-slate-600 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{req.venueAddress}, {req.city} {req.postalCode ? `(${req.postalCode})` : ''}</span>
                        </p>
                      </div>

                      {/* Scale & Facilities */}
                      <div className="bg-slate-50/70 rounded-xl p-3 space-y-1.5 border border-slate-100">
                        <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          Drive Scale & Facilities
                        </p>
                        <p className="text-slate-700">
                          Est. Participants: <span className="font-bold text-slate-900">{req.estimatedParticipants}</span>
                          {req.expectedDonations ? ` • Target: ${req.expectedDonations} units` : ''}
                        </p>
                        {req.availableFacilities && (
                          <p className="text-slate-500 text-[11px] line-clamp-2">
                            Facilities: {req.availableFacilities}
                          </p>
                        )}
                        {req.additionalNotes && (
                          <p className="text-slate-500 text-[11px] italic line-clamp-1">
                            "{req.additionalNotes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Notice or Action Buttons */}
                    {req.status === 'Submitted' ? (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleRejectCamp(req)}
                          disabled={processingCampAction}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer transition-all"
                        >
                          Decline Request
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAcceptModal(req)}
                          disabled={processingCampAction}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept & Schedule Drive</span>
                        </button>
                      </div>
                    ) : req.status === 'Approved' ? (
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          Approved & Scheduled with Drive ID: {req.scheduledCampId || 'Active'}
                        </span>
                        {req.statusNote && (
                          <span className="text-[11px] text-emerald-700 italic">
                            {req.statusNote}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Declined: {req.statusNote || 'Capacity constraints'}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TRACEABLE COMPONENT FRACTIONATION                  */}
      {/* ======================================================== */}
      {activeTab === 'fractionation' && (
        <div className="space-y-6">
          {/* Clinical Fractionation Notice */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 text-xs text-purple-900 flex items-start space-x-3">
            <Layers className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authoritative Component Fractionation & Traceability</p>
              <p className="text-purple-800 text-[11px] mt-0.5">
                Fractionation separates a validated Whole Blood collection into specific components (e.g., Packed RBCs, Fresh Frozen Plasma, Platelets).
                Each resulting component unit inherits source collection traceability and is generated in <strong>Quarantined</strong> status pending laboratory testing clearance.
              </p>
            </div>
          </div>

          {fractionationError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fractionationError}</span>
            </div>
          )}

          {/* Pending Collections for Fractionation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Collections Eligible for Fractionation</h3>
                <p className="text-[11px] text-slate-500">Unprocessed whole blood collections in quarantine awaiting component separation.</p>
              </div>
              <button
                onClick={fetchFractionationData}
                disabled={loadingPending}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPending ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPending ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-300 mb-1" />
                <span>Loading eligible collections...</span>
              </div>
            ) : pendingCollections.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <p className="font-semibold text-slate-600">No whole blood collections currently pending fractionation.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Record new phlebotomy collections in Tab 1 to route them to fractionation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingCollections.map((col) => (
                  <div key={col.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-blood-700 text-xs">{col.id}</span>
                        <span className="px-1.5 py-0.2 rounded font-extrabold text-[10px] bg-rose-50 text-rose-700 border border-rose-100">
                          {col.bloodGroup}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {col.volumeMl} mL Whole Blood
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-medium mt-1">
                        Donor: {col.donorName} <span className="text-slate-400 text-[10px]">({col.donorCode})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Collected: {col.collectionDate} • {col.collectionType}
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenFractionation(col)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Fractionate</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fractionation Batch Audit Trail */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Fractionation Processing Audit Trail</h3>
                <p className="text-[11px] text-slate-500">Traceable historical records linking source collections to their resulting component units.</p>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-300 mb-1" />
                <span>Loading audit records...</span>
              </div>
            ) : fractionationHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <span>No fractionation batches on record yet.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {fractionationHistory.map((batch) => (
                  <div key={batch.id} className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {batch.id}
                        </span>
                        <span className="text-slate-500">
                          Source: <strong className="font-mono text-blood-700">{batch.sourceCollectionId}</strong> ({batch.donorBloodGroup}, {batch.sourceVolumeMl} mL)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(batch.processedAt).toLocaleString()} • {batch.processedBy}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {batch.producedComponents.map((comp) => (
                        <div key={comp.unitId} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">{comp.unitId}</span>
                            <span className="font-bold text-purple-700">{comp.component}</span>
                          </div>
                          <div className="text-slate-500 flex justify-between">
                            <span>{comp.volumeMl} mL</span>
                            <span className="text-[10px] font-bold text-amber-700">{comp.testingStatus}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {comp.storageLocation}
                          </div>
                        </div>
                      ))}
                    </div>

                    {batch.notes && (
                      <p className="text-[10px] text-slate-400 italic">Method: {batch.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE CAMP                                       */}
      {/* ======================================================== */}
      {showCreateCampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Compass className="w-4 h-4 text-purple-600" />
                <span>Register Mobile Donation Drive</span>
              </h3>
              <button onClick={() => setShowCreateCampModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {campModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{campModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCamp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Camp / Drive Title *</label>
                <input
                  type="text"
                  required
                  value={campForm.title}
                  onChange={(e) => setCampForm({ ...campForm, title: e.target.value })}
                  placeholder="e.g. City Tech Park Blood Donation Drive"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Organizer / Partner *</label>
                  <input
                    type="text"
                    required
                    value={campForm.organizer}
                    onChange={(e) => setCampForm({ ...campForm, organizer: e.target.value })}
                    placeholder="e.g. Rotary Club / Tech Park Assoc"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Units *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="1000"
                    value={campForm.targetUnits}
                    onChange={(e) => setCampForm({ ...campForm, targetUnits: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Venue Name *</label>
                  <input
                    type="text"
                    required
                    value={campForm.location}
                    onChange={(e) => setCampForm({ ...campForm, location: e.target.value })}
                    placeholder="e.g. Main Auditorium"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={campForm.contactPhone}
                    onChange={(e) => setCampForm({ ...campForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Address *</label>
                <input
                  type="text"
                  required
                  value={campForm.address}
                  onChange={(e) => setCampForm({ ...campForm, address: e.target.value })}
                  placeholder="e.g. Building 4, Innovation Park Avenue"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={campForm.startDate}
                    onChange={(e) => setCampForm({ ...campForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={campForm.endDate}
                    onChange={(e) => setCampForm({ ...campForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operating Hours / Time Slot *</label>
                <input
                  type="text"
                  required
                  value={campForm.timeSlot}
                  onChange={(e) => setCampForm({ ...campForm, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Drive Description / Instructions</label>
                <textarea
                  rows={2}
                  value={campForm.description}
                  onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  placeholder="Notes on equipment logistics, van parking, refreshments..."
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="createUrgent"
                  checked={campForm.isUrgent}
                  onChange={(e) => setCampForm({ ...campForm, isUrgent: e.target.checked })}
                  className="rounded text-blood-600 focus:ring-blood-500"
                />
                <label htmlFor="createUrgent" className="font-semibold text-slate-700 cursor-pointer">
                  Mark as High-Priority / Emergency Mobilization Drive
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCampModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCamp}
                  className="px-4 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {submittingCamp ? 'Registering...' : 'Register Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT CAMP                                         */}
      {/* ======================================================== */}
      {showEditCampModal && editingCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Edit3 className="w-4 h-4 text-purple-600" />
                <span>Edit Drive: {editingCamp.id}</span>
              </h3>
              <button onClick={() => setShowEditCampModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {campModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{campModalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCamp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Camp / Drive Title *</label>
                <input
                  type="text"
                  required
                  value={editingCamp.title}
                  onChange={(e) => setEditingCamp({ ...editingCamp, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Organizer *</label>
                  <input
                    type="text"
                    required
                    value={editingCamp.organizer}
                    onChange={(e) => setEditingCamp({ ...editingCamp, organizer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Units *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="1000"
                    value={editingCamp.targetUnits}
                    onChange={(e) => setEditingCamp({ ...editingCamp, targetUnits: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Venue *</label>
                  <input
                    type="text"
                    required
                    value={editingCamp.location}
                    onChange={(e) => setEditingCamp({ ...editingCamp, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={editingCamp.contactPhone}
                    onChange={(e) => setEditingCamp({ ...editingCamp, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Address *</label>
                <input
                  type="text"
                  required
                  value={editingCamp.address}
                  onChange={(e) => setEditingCamp({ ...editingCamp, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={editingCamp.startDate}
                    onChange={(e) => setEditingCamp({ ...editingCamp, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={editingCamp.endDate}
                    onChange={(e) => setEditingCamp({ ...editingCamp, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operating Hours *</label>
                <input
                  type="text"
                  required
                  value={editingCamp.timeSlot}
                  onChange={(e) => setEditingCamp({ ...editingCamp, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditCampModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCamp}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {submittingCamp ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VIEW CAMP COLLECTIONS                             */}
      {/* ======================================================== */}
      {inspectingCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <Compass className="w-4 h-4 text-purple-600" />
                  <span>Collections for {inspectingCamp.title}</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">Camp ID: {inspectingCamp.id}</span>
              </div>
              <button onClick={() => setInspectingCamp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingCampCollections ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-300 mb-1" />
                <span>Loading camp phlebotomies...</span>
              </div>
            ) : campCollections.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                <span>No phlebotomy collections recorded for this mobile drive yet.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                      <th className="py-2 px-2">Collection ID</th>
                      <th className="py-2 px-2">Donor</th>
                      <th className="py-2 px-2">Group</th>
                      <th className="py-2 px-2">Volume</th>
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campCollections.map(c => (
                      <tr key={c.id}>
                        <td className="py-2 px-2 font-mono font-bold text-blood-700">{c.id}</td>
                        <td className="py-2 px-2 font-medium">{c.donorName}</td>
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded font-extrabold text-[10px] bg-rose-50 text-rose-700">
                            {c.bloodGroup}
                          </span>
                        </td>
                        <td className="py-2 px-2">{c.volumeMl} mL</td>
                        <td className="py-2 px-2 text-slate-500">{c.collectionDate}</td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectingCamp(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PROCESS COMPONENT FRACTIONATION                   */}
      {/* ======================================================== */}
      {activeFractionatingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Component Fractionation Processing</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Collection: {activeFractionatingCollection.id} ({activeFractionatingCollection.bloodGroup}, {activeFractionatingCollection.volumeMl} mL)
                </span>
              </div>
              <button onClick={() => setActiveFractionatingCollection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {fractionationSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Fractionation Completed & Units Quarantined!</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 space-y-1">
                  <p><strong>Batch ID:</strong> <span className="font-mono font-bold text-purple-700">{fractionationSuccess.fractionationRecord.id}</span></p>
                  <p><strong>Resulting Units:</strong></p>
                  <ul className="list-disc pl-4 space-y-0.5 mt-1 font-mono text-[11px]">
                    {fractionationSuccess.createdUnits.map((u: any) => (
                      <li key={u.id}>
                        {u.id} — {u.component} ({u.volumeMl} mL) &bull; <span className="text-amber-700 font-bold font-sans">Quarantined</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setActiveFractionatingCollection(null);
                    setFractionationSuccess(null);
                  }}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleProcessFractionation} className="space-y-4 text-xs">
                {fractionationModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{fractionationModalError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-800 block text-[11px]">Source Whole Blood Details</span>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Donor</span>
                      <strong>{activeFractionatingCollection.donorName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Blood Group</span>
                      <strong className="text-rose-700">{activeFractionatingCollection.bloodGroup}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Whole Blood Vol</span>
                      <strong>{activeFractionatingCollection.volumeMl} mL</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-bold text-slate-900 block text-xs">Components to Produce</span>

                  {/* RBC */}
                  <div className={`p-3 rounded-xl border transition-all ${fracRbc ? 'bg-rose-50/40 border-rose-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={fracRbc}
                          onChange={(e) => setFracRbc(e.target.checked)}
                          className="rounded text-blood-600"
                        />
                        <span>Packed Red Blood Cells (RBC)</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Initial: Quarantined
                      </span>
                    </div>

                    {fracRbc && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-rose-100">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Measured Vol (mL)</label>
                          <input
                            type="number"
                            value={fracRbcVolume}
                            onChange={(e) => setFracRbcVolume(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Storage Bay</label>
                          <input
                            type="text"
                            value={fracRbcBay}
                            onChange={(e) => setFracRbcBay(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plasma */}
                  <div className={`p-3 rounded-xl border transition-all ${fracPlasma ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={fracPlasma}
                          onChange={(e) => setFracPlasma(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span>Fresh Frozen Plasma (FFP)</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Initial: Quarantined
                      </span>
                    </div>

                    {fracPlasma && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-100">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Measured Vol (mL)</label>
                          <input
                            type="number"
                            value={fracPlasmaVolume}
                            onChange={(e) => setFracPlasmaVolume(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Storage Bay</label>
                          <input
                            type="text"
                            value={fracPlasmaBay}
                            onChange={(e) => setFracPlasmaBay(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Platelets */}
                  <div className={`p-3 rounded-xl border transition-all ${fracPlatelets ? 'bg-purple-50/40 border-purple-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={fracPlatelets}
                          onChange={(e) => setFracPlatelets(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>Platelet Concentrate (PLT)</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Initial: Quarantined
                      </span>
                    </div>

                    {fracPlatelets && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-purple-100">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Measured Vol (mL)</label>
                          <input
                            type="number"
                            value={fracPlateletsVolume}
                            onChange={(e) => setFracPlateletsVolume(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Storage Bay</label>
                          <input
                            type="text"
                            value={fracPlateletsBay}
                            onChange={(e) => setFracPlateletsBay(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Centrifugation / Process Method Notes</label>
                  <textarea
                    rows={2}
                    value={processingNotes}
                    onChange={(e) => setProcessingNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveFractionatingCollection(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingFractionation}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{processingFractionation ? 'Fractionating...' : 'Fractionate & Generate Barcodes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: ACCEPT & SCHEDULE ORGANIZATIONAL CAMP DRIVE       */}
      {/* ======================================================== */}
      {showAcceptCampModal && activeCampRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Accept & Schedule Camp Drive</h3>
                  <p className="text-xs text-slate-500">{activeCampRequest.organizationName}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAcceptCampModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <p><strong className="text-slate-900">Venue:</strong> {activeCampRequest.venueAddress}, {activeCampRequest.city}</p>
              <p><strong className="text-slate-900">Target Scale:</strong> {activeCampRequest.expectedDonations || activeCampRequest.estimatedParticipants} estimated donors</p>
              <p><strong className="text-slate-900">Organizer:</strong> {activeCampRequest.organizerName} ({activeCampRequest.organizerPhone})</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAcceptCamp();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirmed Drive Date *</label>
                <input
                  type="date"
                  required
                  value={acceptingCampDate}
                  onChange={(e) => setAcceptingCampDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operating Time Slot *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09:00 AM - 05:00 PM"
                  value={acceptingCampTime}
                  onChange={(e) => setAcceptingCampTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Coordination & Phlebotomy Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Mobile van dispatched at 08:30 AM. 4 beds and centrifuge equipment assigned."
                  value={acceptingCampNotes}
                  onChange={(e) => setAcceptingCampNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAcceptCampModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingCampAction}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{processingCampAction ? 'Scheduling...' : 'Confirm & Schedule Camp Drive'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
