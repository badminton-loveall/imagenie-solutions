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
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
