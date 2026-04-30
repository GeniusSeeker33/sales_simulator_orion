# GeniusSeeker Sales Simulator — Orion Edition

AI-powered sales training simulator for Orion Sales Executives.

## Setup

### 1. Install dependencies
npm install

### 2. Configure environment
Create a `.env` file:
OPENAI_API_KEY=your-openai-api-key-here

### 3. Run locally (with API functions)
npm install -g vercel
vercel link
vercel dev

### 4. Deploy to Vercel
vercel deploy --prod
# Add OPENAI_API_KEY in Vercel Dashboard → Settings → Environment Variables

## Features
- AI customer simulation (text + voice) using GPT-4.1-mini
- 8 customer personas × 4 difficulty levels
- AI-powered call scoring on 5 dimensions
- Manager view with RingCentral integration
- Rep progression levels (L1–L5)
- Bulk import: employees, contacts, products, call logs
