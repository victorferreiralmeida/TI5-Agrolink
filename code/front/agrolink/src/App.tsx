import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { OfflineBanner } from './components/OfflineBanner';
import { RootLayout } from './layouts/RootLayout';
import { LoadingProvider } from './loading/LoadingContext';
import { RouteChangeLoader } from './loading/RouteChangeLoader';
import { OfflineSyncProvider } from './offline/OfflineSyncProvider';
import { ThemeProvider } from './theme/ThemeContext';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { NotificacoesPage } from './pages/NotificacoesPage';
import { EquipePage } from './pages/EquipePage';
import { MensagensPage } from './pages/MensagensPage';
import { OcorrenciaDetalhePage } from './pages/OcorrenciaDetalhePage';
import { OcorrenciasPage } from './pages/OcorrenciasPage';
import { RegistrarOcorrenciaPage } from './pages/RegistrarOcorrenciaPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { SignupPage } from './pages/SignupPage';
import { FazendaPage } from './pages/FazendaPage';
import { PerfilPage } from './pages/PerfilPage';

export default function App() {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <AuthProvider>
          <OfflineSyncProvider>
          <BrowserRouter>
          <RouteChangeLoader />
          <OfflineBanner />
          <Routes>
            <Route element={<RootLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<SignupPage />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/fazenda"
                element={
                  <RequireAuth>
                    <FazendaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/ocorrencias"
                element={
                  <RequireAuth>
                    <OcorrenciasPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/ocorrencias/:id"
                element={
                  <RequireAuth>
                    <OcorrenciaDetalhePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/mapa"
                element={
                  <RequireAuth>
                    <MapPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/registrar"
                element={
                  <RequireAuth>
                    <RegistrarOcorrenciaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/mensagens"
                element={
                  <RequireAuth>
                    <MensagensPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/equipe"
                element={
                  <RequireAuth>
                    <EquipePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <RequireAuth>
                    <RelatoriosPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/notificacoes"
                element={
                  <RequireAuth>
                    <NotificacoesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/perfil"
                element={
                  <RequireAuth>
                    <PerfilPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
          </OfflineSyncProvider>
        </AuthProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
}
