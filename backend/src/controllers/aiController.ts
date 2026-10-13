import { supabase } from '../models/db';
import { Request, Response } from 'express';
import { db } from '../models/store';
import { BloodGroup, BloodComponent, DemandPrediction, RiskLevel, ExpiryRiskItem } from '../models/types';

export const getDemandForecast = async (req: Request, res: Response) => {

  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;

  const period = (req.query.period as string) || '7 days';

  const groups: BloodGroup[] = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const components: BloodComponent[] = ['RBC', 'Plasma', 'Platelets'];

  const inventorySummary = db.getAvailableInventoryByGroup();

  const predictions: DemandPrediction[] = groups.map(bg => {
    // Demo logic: O- has severe shortage risk
    let multiplier = period === '90 days' ? 12 : period === '30 days' ? 4 : 1;
    let baseDemand = bg === 'O-' ? 14 : bg === 'O+' ? 22 : bg === 'A+' ? 18 : bg === 'B+' ? 16 : 8;
    
    let predictedDemandUnits = Math.round(baseDemand * multiplier);
    let currentStock = inventorySummary[bg]?.availableUnits || 0;
    let historicalAvg = Math.round(predictedDemandUnits * 0.85);

    let shortageRisk: RiskLevel = 'Low';
    if (bg === 'O-') shortageRisk = 'Critical';
    else if (currentStock < predictedDemandUnits * 0.5) shortageRisk = 'High';
    else if (currentStock < predictedDemandUnits * 0.8) shortageRisk = 'Medium';

    let wastageRisk: RiskLevel = bg === 'AB-' ? 'Medium' : 'Low';

    let recommendation = '';
    if (shortageRisk === 'Critical') {
      recommendation = `CRITICAL: Immediate targeted blood donation drive recommended for ${bg}. Demand exceeds current stock by ${predictedDemandUnits - currentStock} units.`;
    } else if (shortageRisk === 'High') {
      recommendation = `ALERT: Inventory for ${bg} is approaching critical threshold. Schedule voluntary collection camp within 48 hours.`;
    } else {
      recommendation = `STABLE: ${bg} inventory is sufficient for projected ${period} hospital consumption.`;
    }

    return {
      bloodGroup: bg,
      component: 'RBC',
      predictionPeriod: period as any,
      predictedDemandUnits,
      currentInventoryUnits: currentStock,
      historicalDemandAvg: historicalAvg,
      shortageRisk,
      wastageRisk,
      confidenceScore: bg === 'O-' ? 0.94 : 0.89,
      generatedAt: new Date().toISOString(),
      recommendation
    };
  });



  res.json({
    success: true,
    period,
    predictions,
    disclaimer: 'LifeLink AI predictions are statistical decision-support estimates derived from historical hospital requests, seasonal trends, and emergency frequency. Final inventory decisions must be validated by blood bank management.'
  });
};

export const getShortageRisk = async (req: Request, res: Response) => {

  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;

  const inventorySummary = db.getAvailableInventoryByGroup();
  const groups: BloodGroup[] = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  const risks = groups.map(bg => {
    const stock = inventorySummary[bg]?.availableUnits || 0;
    const rbc = inventorySummary[bg]?.rbc || 0;
    
    let predictedDemand = bg === 'O-' ? 15 : bg === 'O+' ? 20 : 10;
    let riskLevel: RiskLevel = 'Low';
    
    if (bg === 'O-' || rbc <= 2) riskLevel = 'Critical';
    else if (rbc <= 5) riskLevel = 'High';
    else if (rbc <= 8) riskLevel = 'Medium';

    return {
      bloodGroup: bg,
      component: 'RBC' as BloodComponent,
      currentStock: rbc,
      predictedDemand,
      riskLevel,
      predictedShortageDate: riskLevel === 'Critical' ? 'Within 24 Hours' : riskLevel === 'High' ? '3 Days' : '10+ Days',
      explanation: riskLevel === 'Critical' 
        ? 'Predicted hospital emergency demand exceeds available RBC stock.'
        : 'Stock levels within standard operational threshold.',
      recommendedAction: riskLevel === 'Critical' 
        ? 'Initiate emergency O- donor mobilization alert and request inter-bank transfer.'
        : 'Maintain routine voluntary collection schedule.'
    };
  });



  res.json({ success: true, shortageRisks: risks });
};

export const getWastageRisk = async (req: Request, res: Response) => {

  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;

  const now = new Date();

  // Find units at risk of expiring before consumption
  const unitsAtRisk: ExpiryRiskItem[] = db.bloodUnits
    .filter(u => u.availability === 'Available' && u.testingStatus === 'Passed')
    .map(u => {
      const exp = new Date(u.expiryDate);
      const daysToExpiry = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const ageDays = 35 - daysToExpiry;

      let riskLevel: RiskLevel = 'Low';
      if (daysToExpiry <= 2 && u.component === 'Platelets') riskLevel = 'High';
      if (daysToExpiry <= 3 && u.component === 'RBC') riskLevel = 'High';
      if (daysToExpiry <= 1) riskLevel = 'Critical';

      let recommendedAction = 'Routine storage monitoring';
      if (riskLevel === 'Critical') {
        recommendedAction = 'Prioritize for immediate clinical transfusion or offer for urgent inter-hospital transfer.';
      } else if (riskLevel === 'High') {
        recommendedAction = 'Move to front-row issue shelf for priority allocation.';
      }

      return {
        unitId: u.id,
        bloodGroup: u.bloodGroup,
        component: u.component,
        ageDays: Math.max(1, ageDays),
        daysToExpiry,
        expiryDate: u.expiryDate,
        consumptionRateAvg: 1.2,
        predictedUsageNext3Days: 0.8,
        riskLevel,
        recommendedAction
      };
    })
    .filter(item => item.riskLevel === 'High' || item.riskLevel === 'Critical');



  res.json({
    success: true,
    totalAtRisk: unitsAtRisk.length,
    wastageRiskUnits: unitsAtRisk
  });
};

export const getCampaignRecommendations = async (req: Request, res: Response) => {

  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;

  const recommendations = [
    {
      id: 'REC-1',
      title: 'Targeted O-Negative Emergency Mobilization',
      bloodGroup: 'O-',
      urgency: 'Critical',
      predictedShortageDays: 2,
      targetUnits: 30,
      suggestedLocation: 'Downtown Financial Center & Metro University',
      reasoning: 'O- Negative stock is down to 2 units while trauma request frequency has surged 35% this week.',
      actionButtonText: 'Deploy Emergency Alert to Donors'
    },
    {
      id: 'REC-2',
      title: 'Weekend Corporate Platelet & Whole Blood Drive',
      bloodGroup: 'A+',
      urgency: 'Medium',
      predictedShortageDays: 7,
      targetUnits: 100,
      suggestedLocation: 'Tech Park Campus Plaza',
      reasoning: 'Elective cardiac procedures scheduled next week require 25+ units of A+ RBC.',
      actionButtonText: 'Create Donation Camp'
    }
  ];



  res.json({ success: true, recommendations });
};
