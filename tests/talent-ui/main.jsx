import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TalentWorkspace from '../../src/pages/talent/TalentWorkspace';
import '../../src/styles/app.css';
const path = new URLSearchParams(window.location.search).get('path') || '/talent/candidates?workspace_id=00000000-0000-4000-8000-000000000010';
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/talent/candidates/:personId?" element={<TalentWorkspace />} /></Routes></MemoryRouter>);
