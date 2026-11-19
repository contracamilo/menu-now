import { Route, Routes } from 'react-router';
import { NotFoundPage } from '../../NotFoundPage';
import { CatalogPage } from '../catalog/CatalogPage';
import { CategoryForm } from '../catalog/CategoryForm';
import { DishForm } from '../catalog/DishForm';
import { VenuePage } from '../venue/VenuePage';
import { AdminLayout } from './AdminLayout';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { LoginPage } from './LoginPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { RequireOwner } from './RequireOwner';
import '../../styles/admin.scss';

/** Zona de administración: se carga de forma diferida desde App (design D1). */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireOwner>
            <AdminLayout />
          </RequireOwner>
        }
      >
        <Route index element={<CatalogPage />} />
        <Route path="venue" element={<VenuePage />} />
        <Route path="categories/new" element={<CategoryForm />} />
        <Route path="categories/:id" element={<CategoryForm />} />
        <Route path="dishes/new" element={<DishForm />} />
        <Route path="dishes/:id" element={<DishForm />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
