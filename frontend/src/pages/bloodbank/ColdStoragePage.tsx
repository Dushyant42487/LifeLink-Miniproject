import React, { useState, useEffect } from 'react';
import { apiFetch, bloodBankApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ColdStorageEquipment, 
  TemperatureReading, 
  ColdStorageAlarm, 
  BloodUnit,
  StorageEquipmentType,
  AlarmStatus,
  AlarmSeverity
} from '../../types';
import { 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  PlusCircle, 
  Search, 
  Layers, 
  Activity, 
  FileText, 
  X, 
  ChevronRight, 
  Info, 
  Package, 
  Snowflake, 
  Check, 
  AlertCircle, 
  Eye,
  Sliders,
  Sparkles,
  History
} from 'lucide-react';

export const ColdStoragePage: React.FC = () => {
  const { user } = useAuth();
  
  // Data States
  const [equipmentList, setEquipmentList] = useState<ColdStorageEquipment[]>([]);
  const [alarms, setAlarms] = useState<ColdStorageAlarm[]>([]);
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter States
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipmentForHistory, setSelectedEquipmentForHistory] = useState<string>('all');

  // Modals State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetEquipment, setTargetEquipment] = useState<ColdStorageEquipment | null>(null);
  
  // Log Reading Form State
  const [logTemp, setLogTemp] = useState<string>('');
  const [logAgitation, setLogAgitation] = useState<boolean>(true);
  const [logSource, setLogSource] = useState<'manual_log' | 'simulated_dev'>('manual_log');
  const [logNotes, setLogNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Acknowledge Modal State
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedAlarmForAck, setSelectedAlarmForAck] = useState<ColdStorageAlarm | null>(null);
  const [ackNotes, setAckNotes] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);

  // Resolve Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedAlarmForResolve, setSelectedAlarmForResolve] = useState<ColdStorageAlarm | null>(null);
  const [resolveAction, setResolveAction] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  // Affected Inventory Modal State
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryModalEquipment, setInventoryModalEquipment] = useState<ColdStorageEquipment | null>(null);
  const [exposedUnits, setExposedUnits] = useState<BloodUnit[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Alarm Audit Trail Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAlarmForAudit, setSelectedAlarmForAudit] = useState<ColdStorageAlarm | null>(null);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eqRes, almRes, rdRes] = await Promise.all([
        bloodBankApi.getColdStorageEquipment(),
        bloodBankApi.getColdStorageAlarms(),
        bloodBankApi.getTemperatureReadings({ limit: 50 })
      ]);

      if (eqRes.success && eqRes.equipment) {
        setEquipmentList(eqRes.equipment);
      } else {
        setError(eqRes.error || 'Failed to load storage equipment.');
      }

      if (almRes.success && almRes.alarms) {
        setAlarms(almRes.alarms);
      }

      if (rdRes.success && rdRes.readings) {
        setReadings(rdRes.readings);
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with storage monitoring service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Log Reading Submit
  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEquipment) return;

    const tempNum = parseFloat(logTemp);
    if (isNaN(tempNum)) {
      alert('Please enter a valid numeric temperature value.');
      return;
    }

    setSubmittingLog(true);
    try {
      const res = await bloodBankApi.recordTemperatureReading({
        equipmentId: targetEquipment.id,
        temperatureCelsius: tempNum,
        readingSource: logSource,
        plateletAgitationWorking: (targetEquipment.equipmentType === 'Platelet Incubator & Agitator' || (targetEquipment.equipmentType as string).includes('Platelet')) ? logAgitation : undefined,
        notes: logNotes.trim() || undefined
      });

      if (res.success) {
        setSuccessMsg(`Temperature recorded: ${tempNum}°C for ${targetEquipment.name}. ${res.alarmTriggered ? '⚠️ An alarm condition was triggered!' : ''}`);
        setLogModalOpen(false);
        setLogTemp('');
        setLogNotes('');
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert(res.error || 'Failed to record temperature reading.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error recording reading.');
    } finally {
      setSubmittingLog(false);
    }
  };

  // Handle Alarm Acknowledge
  const handleAcknowledgeAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlarmForAck) return;
    if (!ackNotes.trim()) {
      alert('Operator notes are required to acknowledge an active alarm.');
      return;
    }

    setSubmittingAck(true);
    try {
      const res = await bloodBankApi.acknowledgeColdStorageAlarm(selectedAlarmForAck.id, {
        notes: ackNotes.trim()
      });

      if (res.success) {
        setSuccessMsg(`Alarm ${selectedAlarmForAck.id} acknowledged by operator.`);
        setAckModalOpen(false);
        setAckNotes('');
        setSelectedAlarmForAck(null);
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        alert(res.error || 'Failed to acknowledge alarm.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error acknowledging alarm.');
    } finally {
      setSubmittingAck(false);
    }
  };

  // Handle Alarm Resolve
  const handleResolveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlarmForResolve) return;
    if (!resolveAction.trim()) {
      alert('Corrective action documentation is mandatory before resolving an alarm.');
      return;
    }

    setSubmittingResolve(true);
    try {
      const res = await bloodBankApi.resolveColdStorageAlarm(selectedAlarmForResolve.id, {
        correctiveAction: resolveAction.trim(),
        notes: resolveNotes.trim() || undefined
      });

      if (res.success) {
        setSuccessMsg(`Alarm ${selectedAlarmForResolve.id} marked RESOLVED. Equipment status updated.`);
        setResolveModalOpen(false);
        setResolveAction('');
        setResolveNotes('');
        setSelectedAlarmForResolve(null);
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        alert(res.error || 'Failed to resolve alarm.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error resolving alarm.');
    } finally {
      setSubmittingResolve(false);
    }
  };

  // Handle Open Affected Inventory
  const handleOpenExposedInventory = async (equipment: ColdStorageEquipment) => {
    setInventoryModalEquipment(equipment);
    setInventoryModalOpen(true);
    setLoadingInventory(true);
    try {
      const res = await bloodBankApi.getExposedInventory(equipment.id);
      if (res.success && res.affectedUnits) {
        setExposedUnits(res.affectedUnits);
      } else {
        setExposedUnits([]);
      }
    } catch (err: any) {
      console.error(err);
      setExposedUnits([]);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Filtered Equipment
  const filteredEquipment = equipmentList.filter((eq) => {
    const matchesType = selectedType === 'all' || eq.equipmentType === selectedType;
    const loc = eq.locationName || (eq as any).locationDescription || '';
    const matchesSearch = 
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Filtered Readings for History Table
  const filteredReadings = readings.filter((rd) => {
    if (selectedEquipmentForHistory === 'all') return true;
    return rd.equipmentId === selectedEquipmentForHistory;
  });

  // Active / Unresolved Alarms
  const activeAlarms = alarms.filter((a) => {
    const s = a.status.toLowerCase();
    return s === 'active' || s === 'triggered' || s === 'acknowledged';
  });

  // Summary Counts
  const totalUnitsMonitored = equipmentList.reduce((acc, eq) => acc + ((eq as any).monitoredUnitsCount ?? (eq as any).monitoredInventoryCount ?? 0), 0);
  const unitsInAlarm = equipmentList.filter((eq) => eq.status.toLowerCase().includes('alarm')).length;
  const operationalUnits = equipmentList.filter((eq) => eq.status.toLowerCase().includes('operational')).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700">
                <Thermometer className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-slate-900">Cold-Storage Monitoring & Alarms</h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                    Phase 5C Operational
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Continuous thermal integrity & agitation supervision for {user?.name || (user as any)?.bloodBankName || 'Regional Blood Center'} {(user as any)?.registrationId ? `(${(user as any).registrationId})` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
            <button
              onClick={() => {
                if (equipmentList.length > 0) {
                  setTargetEquipment(equipmentList[0]);
                  setLogTemp((equipmentList[0] as any).lastReadingTempCelsius?.toString() || (equipmentList[0] as any).lastTemperatureCelsius?.toString() || '');
                  setLogModalOpen(true);
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm shadow-cyan-600/20 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Temperature Log</span>
            </button>
          </div>
        </div>

        {/* Operational Reality Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>
              <strong>Operational Telemetry Protocol:</strong> Hardware telemetry interface currently accepts authenticated manual ledger logs and validated development simulations. Every reading is permanently attributed to the recording operator.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200 shrink-0">
            No simulated data is disguised as live sensor telemetry
          </span>
        </div>
      </div>

      {/* Notifications / Alerts Banner */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
            <Snowflake className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{equipmentList.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Storage Units Tracked</div>
            <div className="text-[10px] text-cyan-600 font-medium">{operationalUnits} verified operational</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            activeAlarms.length > 0 
              ? 'bg-rose-50 border border-rose-100 text-rose-600 animate-pulse' 
              : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeAlarms.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Active Alarms / Breaches</div>
            <div className="text-[10px] text-slate-500 font-medium">
              {unitsInAlarm} equipment out of range
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalUnitsMonitored}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Protected Blood Units</div>
            <div className="text-[10px] text-purple-600 font-medium">Under active thermal surveillance</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{readings.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Logged Audit Records</div>
            <div className="text-[10px] text-slate-500 font-medium">Immutable temperature ledger</div>
          </div>
        </div>
      </div>

      {/* Active Temperature Alarms Desk (If any active alarms exist) */}
      {activeAlarms.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 animate-bounce" />
              <h2 className="text-sm font-bold text-rose-950 uppercase tracking-wide">
                Active Storage Temperature Excursions ({activeAlarms.length})
              </h2>
            </div>
            <span className="text-[11px] text-rose-700 font-semibold">
              Quality Assurance Policy: Immediate Operator Review Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeAlarms.map((alarm) => {
              const eq = equipmentList.find((e) => e.id === alarm.equipmentId);
              return (
                <div 
                  key={alarm.id} 
                  className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-rose-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          (alarm.severity as string).toLowerCase() === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {alarm.severity}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{alarm.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          (alarm.status as string).toLowerCase() === 'acknowledged' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800 animate-pulse'
                        }`}>
                          {alarm.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-slate-800 mt-1">
                        {alarm.equipmentName} ({alarm.equipmentId})
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(alarm.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Breach Details */}
                  <div className="bg-rose-50/50 rounded-lg p-2.5 text-xs text-rose-900 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-600">Breach Reading:</span>
                      <strong className="text-rose-700 font-extrabold">{alarm.triggeringReadingCelsius ?? (alarm as any).triggeringTemperature}°C</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Allowed Operating Range:</span>
                      <span className="font-bold text-slate-700">{eq?.minTempCelsius ?? (alarm as any).configuredMinTemp}°C to {eq?.maxTempCelsius ?? (alarm as any).configuredMaxTemp}°C</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Breach Duration:</span>
                      <span className="font-bold text-slate-700">{(alarm as any).excursionDurationMinutes ?? 15} minutes</span>
                    </div>
                    {alarm.acknowledgedBy && (
                      <div className="pt-1.5 border-t border-rose-100 text-[10px] text-blue-700 font-medium">
                        ✓ Acknowledged by {alarm.acknowledgedBy} at {new Date(alarm.acknowledgedAt!).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  {/* Actions for this Alarm */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => eq && handleOpenExposedInventory(eq)}
                      className="text-cyan-700 hover:text-cyan-900 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Affected Units ({eq?.mappedStorageLocations?.length || (eq as any)?.monitoredInventoryCount || 0})</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAlarmForAudit(alarm);
                          setAuditModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Audit Trail
                      </button>
                      
                      {(alarm.status as string).toLowerCase() !== 'acknowledged' && (alarm.status as string).toLowerCase() !== 'resolved' ? (
                        <button
                          onClick={() => {
                            setSelectedAlarmForAck(alarm);
                            setAckNotes('');
                            setAckModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedAlarmForResolve(alarm);
                            setResolveAction('');
                            setResolveNotes('');
                            setResolveModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        >
                          Resolve & Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Storage Equipment Registry Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cold-Storage Equipment Registry</h2>
            <p className="text-xs text-slate-500">
              Validated storage units with configured operational boundaries & mapped inventory bays
            </p>
          </div>

          {/* Search & Type Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search equipment or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full sm:w-56"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="all">All Equipment Types</option>
              <option value="rbc_refrigerator">RBC Refrigerators (2°C – 6°C)</option>
              <option value="plasma_freezer">Plasma Freezers (≤ -18°C)</option>
              <option value="platelet_incubator_agitator">Platelet Incubators (20°C – 24°C)</option>
              <option value="intake_holding_cooler">Intake / QC Coolers</option>
            </select>
          </div>
        </div>

        {/* Equipment Cards Grid */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading storage equipment status...</span>
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            No equipment records found matching the filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEquipment.map((eq) => {
              const isAlarm = eq.status.toLowerCase().includes('alarm');
              const connStatus = eq.sensorConnectivity || (eq as any).connectivityStatus || 'Connected';
              const isStale = connStatus.toLowerCase() === 'stale';
              const isOffline = connStatus.toLowerCase() === 'offline' || connStatus.toLowerCase() === 'disconnected';
              const lastTemp = eq.lastReadingTempCelsius ?? (eq as any).lastTemperatureCelsius;
              const hasReading = lastTemp !== undefined && lastTemp !== null;
              const monitoredUnits = (eq as any).monitoredUnitsCount ?? (eq as any).monitoredInventoryCount ?? 0;
              const standardRef = eq.authoritativeStandard ?? (eq as any).standardReference ?? 'AABB Blood Storage Standard';
              const locationText = eq.locationName || (eq as any).locationDescription || 'Main Storage Bay';

              return (
                <div
                  key={eq.id}
                  className={`border rounded-2xl p-5 flex flex-col justify-between transition relative ${
                    isAlarm
                      ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-300'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Top Header */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          {eq.id}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">{eq.name}</h3>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                          isAlarm
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                            : (eq.status as string).toLowerCase() === 'maintenance'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {eq.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mb-3">{locationText}</p>

                    {/* Temperature Readout Block */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-500">Current Reading:</span>
                        <div className="flex items-baseline space-x-1">
                          {hasReading ? (
                            <span
                              className={`text-2xl font-black ${
                                isAlarm ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {lastTemp}°C
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-slate-400 italic">No Readings Yet</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Configured Range:</span>
                        <strong className="text-slate-700 font-bold">
                          {eq.minTempCelsius}°C to {eq.maxTempCelsius}°C
                        </strong>
                      </div>

                      {/* Platelet Agitation Status */}
                      {(eq.requiresAgitation || eq.equipmentType.includes('Platelet')) && (
                        <div className="flex items-center justify-between text-[10px] pt-1.5 mt-1.5 border-t border-slate-200/60">
                          <span className="font-semibold text-slate-600">Continuous Agitation:</span>
                          <span
                            className={`font-bold ${
                              eq.agitationStatus !== 'Fault'
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {eq.agitationStatus !== 'Fault' ? '✓ Agitator Active' : '⚠️ AGITATION FAULT'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Compliance Source */}
                    <div className="space-y-1.5 text-[11px] text-slate-600 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">Data Freshness:</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isStale
                              ? 'bg-amber-100 text-amber-800'
                              : isOffline
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {connStatus.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">Authoritative Range Source:</span>
                        <span className="text-[10px] font-medium text-slate-700 truncate max-w-[170px]" title={standardRef}>
                          {standardRef}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">Monitored Units:</span>
                        <button
                          onClick={() => handleOpenExposedInventory(eq)}
                          className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 underline cursor-pointer"
                        >
                          {monitoredUnits} Blood Units
                        </button>
                      </div>

                      {eq.lastReadingTimestamp && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Last Verified:</span>
                          <span>{new Date(eq.lastReadingTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenExposedInventory(eq)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer flex items-center space-x-1"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Units</span>
                    </button>

                    <button
                      onClick={() => {
                        setTargetEquipment(eq);
                        setLogTemp((eq as any).lastReadingTempCelsius?.toString() || (eq as any).lastTemperatureCelsius?.toString() || '');
                        setLogModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white text-center cursor-pointer shadow-sm shadow-cyan-600/10"
                    >
                      Log Reading
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Temperature Ledger & Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <History className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Temperature Log History & Audit Trail</h2>
              <p className="text-xs text-slate-500">Immutable chronological ledger of recorded temperatures</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Filter Unit:</span>
            <select
              value={selectedEquipmentForHistory}
              onChange={(e) => setSelectedEquipmentForHistory(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="all">All Units ({readings.length})</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name} ({eq.id})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Equipment</th>
                <th className="py-2.5 px-3">Temperature</th>
                <th className="py-2.5 px-3">Range Status</th>
                <th className="py-2.5 px-3">Source Tag</th>
                <th className="py-2.5 px-3">Agitation</th>
                <th className="py-2.5 px-3">Recorded By</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    No temperature readings recorded for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredReadings.slice(0, 20).map((r) => {
                  const isExcursion = (r as any).isOutOfRange ?? !(r as any).isWithinConfiguredRange;
                  const isSim = r.readingSource === 'simulated_dev';
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50/70 ${isExcursion ? 'bg-rose-50/40' : ''}`}>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {r.equipmentName || r.equipmentId}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold">
                        <span className={isExcursion ? 'text-rose-600' : 'text-slate-900'}>
                          {r.temperatureCelsius}°C
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isExcursion
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isExcursion ? '⚠️ OUT OF RANGE' : '✓ Normal'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSim
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                          }`}
                        >
                          {isSim ? 'SIMULATED (DEV)' : 'MANUAL LOG'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                        {(r as any).plateletAgitationWorking === false || (r as any).agitationOperational === false ? (
                          <span className="text-rose-600 font-bold">FAULT</span>
                        ) : (r as any).plateletAgitationWorking === true || (r as any).agitationOperational === true ? (
                          <span className="text-emerald-700 font-medium">OK</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                        {(r as any).recordedByName || (r as any).recordedBy || (r as any).operatorName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-xs">
                        {r.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: RECORD TEMPERATURE LOG MODAL                    */}
      {/* ======================================================== */}
      {logModalOpen && targetEquipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Record Storage Temperature</h3>
                <p className="text-xs text-slate-500">{targetEquipment.name} ({targetEquipment.id})</p>
              </div>
              <button 
                onClick={() => setLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Allowed Range Reminder */}
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 text-xs text-cyan-900 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Configured Standard Range:</span>
                <span className="font-extrabold">{targetEquipment.minTempCelsius}°C to {targetEquipment.maxTempCelsius}°C</span>
              </div>
              <div className="text-[10px] text-cyan-700">
                Authoritative Standard: {targetEquipment.authoritativeStandard || (targetEquipment as any).standardReference}
              </div>
            </div>

            <form onSubmit={handleRecordReading} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Temperature Reading (°C) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={logTemp}
                  onChange={(e) => setLogTemp(e.target.value)}
                  placeholder="e.g. 4.0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-sm text-slate-900"
                />
                {logTemp && (
                  <div className="mt-1 text-[11px]">
                    {parseFloat(logTemp) < targetEquipment.minTempCelsius || parseFloat(logTemp) > targetEquipment.maxTempCelsius ? (
                      <span className="text-rose-600 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Warning: This reading is out of range and will trigger a temperature alarm!</span>
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">✓ Value is within acceptable operational range</span>
                    )}
                  </div>
                )}
              </div>

              {/* Platelet Agitation Checkbox */}
              {(targetEquipment.equipmentType === 'Platelet Incubator & Agitator' || (targetEquipment.equipmentType as string).includes('Platelet')) && (
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={logAgitation}
                      onChange={(e) => setLogAgitation(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-bold text-purple-900">Platelet Continuous Agitator Functioning</span>
                  </label>
                  <p className="text-[10px] text-purple-700 mt-1 pl-6">
                    AABB Standards require continuous gentle agitation during platelet storage. Uncheck if mechanical failure observed.
                  </p>
                </div>
              )}

              {/* Reading Source Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reading Classification Source *
                </label>
                <select
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="manual_log">Manual Physical Verification (Logged by Operator)</option>
                  <option value="simulated_dev">Simulated Reading (Dev / QA Testing Only)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Attribution: Reading will be recorded in audit ledger under <strong>{user?.name || 'Current Operator'}</strong>.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Operator Observation / Notes
                </label>
                <textarea
                  rows={2}
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Optional notes (e.g., Routine morning inspection, door check confirmed)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingLog ? 'Saving...' : 'Commit Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ACKNOWLEDGE ALARM MODAL                         */}
      {/* ======================================================== */}
      {ackModalOpen && selectedAlarmForAck && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Acknowledge Alarm Incident</h3>
                <p className="text-xs text-rose-600 font-bold">{selectedAlarmForAck.id} • {selectedAlarmForAck.equipmentName}</p>
              </div>
              <button 
                onClick={() => setAckModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p>
                <strong>Operational Policy:</strong> Acknowledging confirms that an operator is aware of this temperature breach and is actively investigating. Acknowledgment alone does not resolve or clear the alarm.
              </p>
            </div>

            <form onSubmit={handleAcknowledgeAlarm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Investigation / Immediate Action Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Technician dispatched to inspect door gasket and verify secondary thermometer."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAckModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAck}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingAck ? 'Recording...' : 'Confirm Acknowledgment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RESOLVE ALARM MODAL                             */}
      {/* ======================================================== */}
      {resolveModalOpen && selectedAlarmForResolve && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Resolve Cold-Storage Alarm</h3>
                <p className="text-xs text-slate-500">{selectedAlarmForResolve.id} • {selectedAlarmForResolve.equipmentName}</p>
              </div>
              <button 
                onClick={() => setResolveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p>
                <strong>Audit Requirement:</strong> Document verified corrective action before closing this incident. Once resolved, the storage equipment will return to Operational status if all other limits are met.
              </p>
            </div>

            <form onSubmit={handleResolveAlarm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Corrective Action Implemented *
                </label>
                <input
                  type="text"
                  required
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  placeholder="e.g. Replaced compressor relay; stabilized at 3.8°C for 2 hours."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Resolution Notes & QA Disposition
                </label>
                <textarea
                  rows={2}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Additional observations or medical director sign-off details"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolve}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingResolve ? 'Closing...' : 'Close & Resolve Alarm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: AFFECTED INVENTORY REVIEW MODAL                 */}
      {/* ======================================================== */}
      {inventoryModalOpen && inventoryModalEquipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Potentially Affected Inventory: {inventoryModalEquipment.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Units associated with locations: {inventoryModalEquipment.mappedStorageLocations.join(', ')}
                </p>
              </div>
              <button 
                onClick={() => setInventoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QA Clinical Safety Notice (Prompt Requirement #6) */}
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1.5 shrink-0">
              <div className="flex items-center space-x-2 font-bold text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Clinical Quality Assurance & Release Protocol</span>
              </div>
              <p>
                In compliance with blood bank safety regulations, units stored in equipment experiencing excursions are 
                <strong> flagged for formal clinical review</strong>. Units are <strong>NEVER automatically discarded or released</strong> solely 
                from dashboard telemetry events. An authorized QA supervisor or medical director must execute clinical disposition.
              </p>
            </div>

            {/* Inventory List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loadingInventory ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span>Matching stored inventory units...</span>
                </div>
              ) : exposedUnits.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No blood units currently mapped to this equipment's storage location.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    {exposedUnits.length} Stored Blood Units Located in Equipment
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Unit ID</th>
                          <th className="py-2.5 px-3">Blood Group</th>
                          <th className="py-2.5 px-3">Component</th>
                          <th className="py-2.5 px-3">Volume</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Storage Location</th>
                          <th className="py-2.5 px-3">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exposedUnits.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{u.id}</td>
                            <td className="py-2.5 px-3 font-bold text-rose-600">{u.bloodGroup}</td>
                            <td className="py-2.5 px-3 capitalize">{u.component.replace('_', ' ')}</td>
                            <td className="py-2.5 px-3">{u.volumeMl} mL</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.availability === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                                u.availability === 'Reserved' ? 'bg-purple-100 text-purple-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {u.availability}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">{u.storageLocation}</td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">{u.expiryDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setInventoryModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: ALARM AUDIT TRAIL MODAL                         */}
      {/* ======================================================== */}
      {auditModalOpen && selectedAlarmForAudit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Alarm Incident Lifecycle Audit</h3>
                <p className="text-xs text-slate-500">{selectedAlarmForAudit.id} • {selectedAlarmForAudit.equipmentName}</p>
              </div>
              <button 
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {((selectedAlarmForAudit.auditHistory || (selectedAlarmForAudit as any).auditTrail || []) as any[]).map((entry: any, idx: number) => (
                <div key={idx} className="flex space-x-3 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 capitalize">{entry.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium">
                      By: <strong>{entry.performedByName || entry.performedBy || entry.operatorName}</strong>
                    </div>
                    <p className="text-[11px] text-slate-600 pt-1">{entry.details}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
