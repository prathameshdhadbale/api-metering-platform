import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './auth/RouteGuards.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { LoadingState } from './components/Ui.jsx';

const LoginPage = lazy(() => import('./pages/AuthPages.jsx').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages.jsx').then((module) => ({ default: module.RegisterPage })));
const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'));
const KeysPage = lazy(() => import('./pages/KeysPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const PlansPage = lazy(() => import('./pages/PlansPage.jsx'));
const ApiGuidePage = lazy(() => import('./pages/ApiGuidePage.jsx'));

export default function App() {
  return <AuthProvider><Suspense fallback={<LoadingState/>}><Routes>
    <Route path="/login" element={<PublicOnlyRoute><LoginPage/></PublicOnlyRoute>}/>
    <Route path="/register" element={<PublicOnlyRoute><RegisterPage/></PublicOnlyRoute>}/>
    <Route element={<ProtectedRoute/>}>
      <Route element={<DashboardLayout/>}>
        <Route index element={<OverviewPage/>}/>
        <Route path="keys" element={<KeysPage/>}/>
        <Route path="analytics" element={<AnalyticsPage/>}/>
        <Route path="plans" element={<PlansPage/>}/>
        <Route path="docs" element={<ApiGuidePage/>}/>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense></AuthProvider>;
}
