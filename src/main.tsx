import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Short survey links (/s/<code>) land on the hash route the router uses.
const short = window.location.pathname.match(/^\/s\/([a-z0-9]{6,20})\/?$/);
if (short) window.history.replaceState(null, '', `/#/s/${short[1]}`);

createRoot(document.getElementById('root')!).render(<App />);
