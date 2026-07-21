import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CreatePage from './pages/CreatePage';
import ReceivePage from './pages/ReceivePage';
import TermsPage from './pages/TermsPage';
import AdminPortal from './pages/AdminPortal';
import ScrollConceptPage from './pages/ScrollConceptPage';
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
    path: '/admin',
    element: <AdminPortal />
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
  </React.StrictMode>
);

