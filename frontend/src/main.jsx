import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import LandingPage from './pages/LandingPage';
import CreatePage from './pages/CreatePage';
import ReceivePage from './pages/ReceivePage';
import TermsPage from './pages/TermsPage';
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
import './i18n';
import './index.css';

// Configure standard client-side routing routes
const router = createBrowserRouter([
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
    path: '/terms',
    element: <TermsPage />
  },
  {
    path: '/about',
    element: <AboutPage />
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
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Analytics />
  </React.StrictMode>
);

