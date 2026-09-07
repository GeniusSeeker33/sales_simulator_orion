import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ReviewerHistory from '../../src/pages/ReviewerHistory';
import '../../src/styles/app.css';
createRoot(document.getElementById('root')).render(<MemoryRouter><div role="note" style={{padding:12,background:'#f4d991',color:'#152030'}}>SYNTHETIC UI TEST — no hosted accounts or data</div><ReviewerHistory/></MemoryRouter>);
