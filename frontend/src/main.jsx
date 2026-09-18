import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { sanitizeRoutePath } from './services/analytics';
import './services/invitationBootstrap';

// Vercel Analytics URL redaction: the puzzle publicId is an access capability
// and must never reach a third party. Every reported URL is reduced to a
// route template with no query string or fragment; unparseable URLs are
// dropped rather than sent raw.
const redactAnalyticsEvent = (event) => {
  if (!event || !event.url) return event;
  try {
    const url = new URL(event.url);
    url.search = '';
    url.hash = '';
    url.pathname = sanitizeRoutePath(url.pathname);
    return { ...event, url: url.toString() };
  } catch (e) {
    return null;
  }
};
import ScrollToTop from './components/ScrollToTop';
import LandingPage from './pages/LandingPage';
import CreatePage from './pages/CreatePage';
import ReceivePage from './pages/ReceivePage';
import TermsPage from './pages/TermsPage';
import LegalPolicyPage from './pages/LegalPolicyPage';
import AboutPage from './pages/AboutPage';
import AdminLayout from './pages/admin/AdminLayout';
import Home from './pages/admin/Home';
import Customers from './pages/admin/Customers';
import CustomerDetail from './pages/admin/CustomerDetail';
import Orders from './pages/admin/Orders';
import OrderDetail from './pages/admin/OrderDetail';
import DeliveryCentre from './pages/admin/DeliveryCentre';
import FinanceOverview from './pages/admin/FinanceOverview';
import Growth from './pages/admin/Growth';
import SystemSettings from './pages/admin/SystemSettings';
import ScrollConceptPage from './pages/ScrollConceptPage';
import PaymentResult from './pages/PaymentResult';
const BusinessLandingPage = lazy(() => import('./pages/business/BusinessLandingPage'));
const BusinessHomePage = lazy(() => import('./pages/business/BusinessHomePage'));
const BusinessCampaignStudioPage = lazy(() => import('./pages/business/BusinessCampaignStudioPage'));
const BusinessCampaignResultsPage = lazy(() => import('./pages/business/BusinessCampaignResultsPage'));
const BusinessAuthVerifyPage = lazy(() => import('./pages/business/BusinessAuthVerifyPage'));
const BusinessLoginPage = lazy(() => import('./pages/business/BusinessLoginPage'));
const InvitationRecipientPage = lazy(() => import('./pages/InvitationRecipientPage'));
import './i18n';
import './index.css';

// Root layout: mounts ScrollToTop once so every route navigation resets scroll
// to the top, then renders the matched route via <Outlet />.
function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

// Configure standard client-side routing routes
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />
      },
      {
        path: '/create',
        element: <CreatePage />
      },
      {
        path: '/payment/result',
        element: <PaymentResult />
      },
      {
        path: '/scroll-concept',
        element: <ScrollConceptPage />
      },
      {
        path: '/p/:publicId',
        element: <ReceivePage />
      },
      {
        path: '/i',
        element: <Suspense fallback={null}><InvitationRecipientPage /></Suspense>
      },
      {
        path: '/terms',
        element: <TermsPage />
      },
      { path: '/privacy', element: <LegalPolicyPage policy="privacy" /> },
      { path: '/upload-content', element: <LegalPolicyPage policy="upload" /> },
      { path: '/refunds', element: <LegalPolicyPage policy="refund" /> },
      { path: '/cookies', element: <LegalPolicyPage policy="cookies" /> },
      {
        path: '/about',
        element: <AboutPage />
      },
      {
        path: '/business',
        element: <Suspense fallback={null}><BusinessLandingPage /></Suspense>
      },
      {
        path: '/business/campaigns',
        element: <Suspense fallback={null}><BusinessHomePage /></Suspense>
      },
      {
        path: '/business/campaigns/new',
        element: <Suspense fallback={null}><BusinessCampaignStudioPage /></Suspense>
      },
      {
        path: '/business/campaigns/:campaignId',
        element: <Suspense fallback={null}><BusinessCampaignStudioPage /></Suspense>
      },
      {
        path: '/business/campaigns/:campaignId/results',
        element: <Suspense fallback={null}><BusinessCampaignResultsPage /></Suspense>
      },
      {
        path: '/business/login',
        element: <Suspense fallback={null}><BusinessLoginPage /></Suspense>
      },
      {
        path: '/business/auth/verify',
        element: <Suspense fallback={null}><BusinessAuthVerifyPage /></Suspense>
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'customers', element: <Customers /> },
          { path: 'customers/:customerId', element: <CustomerDetail /> },
          { path: 'orders', element: <Orders /> },
          { path: 'orders/:orderId', element: <OrderDetail /> },
          { path: 'delivery', element: <DeliveryCentre /> },
          { path: 'finance', element: <FinanceOverview /> },
          { path: 'growth', element: <Growth /> },
          { path: 'system', element: <SystemSettings /> }
        ]
      },
      // Keep receive.html mapping as fallback for local dev compatibility
      {
        path: '/receive.html',
        element: <ReceivePage />
      }
    ]
  }
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Analytics beforeSend={redactAnalyticsEvent} />
  </React.StrictMode>
);

