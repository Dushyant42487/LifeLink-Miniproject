import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';

// Public Module Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NotificationsPage } from './pages/public/NotificationsPage';
import { LandingAwareness } from './components/landing/LandingAwareness';

// Donor Module Pages
import { DonorDashboard } from './pages/donor/DonorDashboard';
import { DonorEligibility } from './pages/donor/DonorEligibility';
import { DonorHistory } from './pages/donor/DonorHistory';
import { DonorEmergencyAlerts } from './pages/donor/DonorEmergencyAlerts';
import { DonorProfile } from './pages/donor/DonorProfile';
import { DonorCampsPage } from './pages/donor/DonorCampsPage';
import { DonorNearbyHospitals } from './pages/donor/DonorNearbyHospitals';

// Hospital Module Pages
import { HospitalDashboard } from './pages/hospital/HospitalDashboard';
import { HospitalProfilePage } from './pages/hospital/HospitalProfilePage';
import { SearchBloodPage } from './pages/hospital/SearchBloodPage';
import { CreateRequestPage } from './pages/hospital/CreateRequestPage';
import { HospitalRequestsPage } from './pages/hospital/HospitalRequestsPage';
import { HospitalEmergencyPage } from './pages/hospital/HospitalEmergencyPage';
import { PatientSamplesPage } from './pages/hospital/PatientSamplesPage';
import { RequestMessagesPage } from './pages/hospital/RequestMessagesPage';
import { HospitalLogisticsPage } from './pages/hospital/HospitalLogisticsPage';

// Blood Bank Module Pages
import { BloodBankDashboard } from './pages/bloodbank/BloodBankDashboard';
import { InventoryPage } from './pages/bloodbank/InventoryPage';
import { CollectionsPage } from './pages/bloodbank/CollectionsPage';
import { TestingPage } from './pages/bloodbank/TestingPage';
import { ExpiryPage } from './pages/bloodbank/ExpiryPage';
import { HospitalRequestsHub } from './pages/bloodbank/HospitalRequestsHub';
import { ReservationsPage } from './pages/bloodbank/ReservationsPage';
import { AIInsightsPage } from './pages/bloodbank/AIInsightsPage';
import { ReportsPage } from './pages/bloodbank/ReportsPage';
import { ColdStoragePage } from './pages/bloodbank/ColdStoragePage';
import { BloodBankProfilePage } from './pages/bloodbank/BloodBankProfilePage';
import { UserRole } from './types';

// Role-Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({
  children,
  allowedRoles
}) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="p-8 text-center text-xs text-slate-500 font-semibold flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading LifeLink Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Strict Role Isolation: If user does not have required role, redirect them directly to their own dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleDashboard = 
      user.role === 'donor' 
        ? '/donor/dashboard' 
        : user.role === 'hospital' 
        ? '/hospital/dashboard' 
        : '/blood-bank/dashboard';
    
    return <Navigate to={roleDashboard} replace />;
  }

  return <>{children}</>;
};

import { EmergencyAlertBanner } from './components/common/EmergencyAlertBanner';
import { FloatingChatbot } from './components/common/FloatingChatbot';

// Main Layout Wrapper
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isPublicPage = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register';
  const showSidebar = user && !isPublicPage;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <Navbar />
      <EmergencyAlertBanner />
      <div className="flex-1 flex">
        {showSidebar && <Sidebar />}
        <main className={`flex-1 ${isPublicPage ? 'w-full' : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full'}`}>
          {children}
        </main>
      </div>
      <FloatingChatbot />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <MainLayout>
            <Routes>
            {/* ========================================================= */}
            {/* 1. PUBLIC / LANDING MODULE                                 */}
            {/* ========================================================= */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/search-blood" element={<SearchBloodPage />} />
            <Route path="/awareness" element={<LandingAwareness />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* ========================================================= */}
            {/* 2. DONOR MODULE ROUTES (Strictly Role 'donor')            */}
            {/* ========================================================= */}
            <Route 
              path="/donor/dashboard" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/profile" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorProfile /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/eligibility" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorEligibility /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/donations" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorHistory /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/camps" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorCampsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/alerts" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorEmergencyAlerts /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/emergency-alerts" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorEmergencyAlerts /></ProtectedRoute>} 
            />
            <Route 
              path="/donor/hospitals" 
              element={<ProtectedRoute allowedRoles={['donor']}><DonorNearbyHospitals /></ProtectedRoute>} 
            />

            {/* ========================================================= */}
            {/* 3. HOSPITAL MODULE ROUTES (Strictly Role 'hospital')       */}
            {/* ========================================================= */}
            <Route 
              path="/hospital/dashboard" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/profile" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalProfilePage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/availability" 
              element={<ProtectedRoute allowedRoles={['hospital']}><SearchBloodPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/requests/new" 
              element={<ProtectedRoute allowedRoles={['hospital']}><CreateRequestPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/create-request" 
              element={<ProtectedRoute allowedRoles={['hospital']}><CreateRequestPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/requests" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalRequestsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/requests/:id" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalRequestsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/tracking" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalRequestsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/emergency" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalEmergencyPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/samples" 
              element={<ProtectedRoute allowedRoles={['hospital']}><PatientSamplesPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/messages" 
              element={<ProtectedRoute allowedRoles={['hospital']}><RequestMessagesPage /></ProtectedRoute>} 
            />
            <Route 
              path="/hospital/logistics" 
              element={<ProtectedRoute allowedRoles={['hospital']}><HospitalLogisticsPage /></ProtectedRoute>} 
            />

            {/* ========================================================= */}
            {/* 4. BLOOD BANK MODULE ROUTES (Strictly Role 'blood_bank')   */}
            {/* ========================================================= */}
            <Route 
              path="/blood-bank/dashboard" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><BloodBankDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/inventory" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><InventoryPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/cold-storage" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><ColdStoragePage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/requests" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><HospitalRequestsHub /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/hospital-requests" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><HospitalRequestsHub /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/reservations" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><ReservationsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/camps" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><CollectionsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/collections" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><CollectionsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/analytics" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><ReportsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/reports" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><ReportsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/testing" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><TestingPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/expiry" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><ExpiryPage /></ProtectedRoute>} 
            />
            <Route 
              path="/blood-bank/ai-insights" 
              element={<ProtectedRoute allowedRoles={['blood_bank']}><AIInsightsPage /></ProtectedRoute>} 
            />

            {/* Catch All Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
