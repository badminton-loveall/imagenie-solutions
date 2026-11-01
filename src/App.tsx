import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Contact } from './pages/Contact'
import { NotFound } from './pages/NotFound'
import { AdminAuthProvider } from './admin/AdminAuth'
import { AdminLayout } from './admin/AdminLayout'
import { AdminLogin } from './admin/AdminLogin'
import { LeadsPage } from './admin/LeadsPage'
import { SubscriptionsPage } from './admin/SubscriptionsPage'
import { OverviewPage } from './admin/OverviewPage'
import { BillsPage } from './admin/BillsPage'
import { TransactionsPage } from './admin/TransactionsPage'
import { SettingsPage } from './admin/SettingsPage'

function AdminRoot() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="admin" element={<AdminRoot />}>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
