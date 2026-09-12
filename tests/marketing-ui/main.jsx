import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MarketingWorkspace from '../../src/pages/marketing/MarketingWorkspace';
import '../../src/styles/app.css';
const path = new URLSearchParams(window.location.search).get('path') || '/marketing/campaigns';
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[path]}><div role="note">SYNTHETIC LOCAL TEST — no hosted data</div><Routes><Route path="/marketing/:section?/:campaignId?" element={<MarketingWorkspace />} /></Routes></MemoryRouter>);
