import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SharedLayout } from './components/layout/PublicLayout';
import { SkeletonCard } from './components/ui/Feedback';
import { RequireAuth } from './lib/auth';
import { ApplicationDetailPage } from './pages/ApplicationDetail';
import { ApplicationFormPage } from './pages/ApplicationForm';
import { ApplicationsPage } from './pages/Applications';
import { CalendarPage } from './pages/Calendar';
import { DashboardPage } from './pages/Dashboard';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { NotFoundPage } from './pages/NotFound';
import { PrivacyPage } from './pages/Privacy';
import { ResumesPage } from './pages/Resumes';
import { SettingsPage } from './pages/Settings';

// Recharts is the heaviest dependency; keep it out of the initial bundle.
const AnalyticsPage = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.AnalyticsPage })));

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/applications/new" element={<ApplicationFormPage />} />
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
        <Route path="/applications/:id/edit" element={<ApplicationFormPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/resumes" element={<ResumesPage />} />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<SkeletonCard h={320} label="Loading analytics" />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route element={<SharedLayout />}>
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
