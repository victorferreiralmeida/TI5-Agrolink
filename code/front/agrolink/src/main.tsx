import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installFetchLoadingInterceptor } from './loading/fetchLoadingBridge';
import 'leaflet/dist/leaflet.css';
import './index.css';

installFetchLoadingInterceptor();

const el = document.getElementById('root');
if (!el) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
