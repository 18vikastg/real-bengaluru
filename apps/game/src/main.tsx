import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadBundledTracks } from './audio/radio';
import './styles.css';
import './ui/city/city.css';

void loadBundledTracks(import.meta.env.BASE_URL);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
