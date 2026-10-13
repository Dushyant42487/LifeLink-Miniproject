import React from 'react';
import { CreateRequestPage } from './CreateRequestPage';

/**
 * HospitalEmergencyPage: Route-compatible entrypoint for STAT emergency requisitions.
 * Reuses the authoritative unified CreateRequestPage configured in Emergency mode.
 */
export const HospitalEmergencyPage: React.FC = () => {
  return <CreateRequestPage forcedInitialUrgency="Emergency" />;
};
