// Entry point of the clickable prototype. The order matters: the stand-in backend goes in first,
// then the stand-ins for the socket and storage, and only then the app itself.
import './boot.js';
import './patch.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import DemoBar from './DemoBar.jsx';
import '../styles.css';

// The prototype keeps its place in memory instead of in the address bar, which belongs to the page hosting it.
let start = '/';
try { start = sessionStorage.getItem('astrobook.prototype.at') || '/'; } catch { /* start at the landing page */ }
function Router({ children }) { return <MemoryRouter initialEntries={[start]}>{children}</MemoryRouter>; }

createRoot(document.getElementById('root')).render(<StrictMode><App Router={Router} overlay={<DemoBar />} /></StrictMode>);
