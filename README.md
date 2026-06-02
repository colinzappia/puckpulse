# PuckPulse: Live Hockey Analytics

A professional hockey event tracking and analytics dashboard with AI-driven insights powered by Google Gemini.

## Features
- Real-time game event tracking on an interactive rink
- AI-powered roster sync and tactical analysis
- Play-by-play log, faceoff summary, and analytics dashboard
- PDF/Excel/HTML export of game reports
- Drag-and-drop line management

## Deploy to Vercel (Free)

1. Create a free account at [vercel.com](https://vercel.com)
2. Import this project from GitHub (or drag-drop the folder)
3. Add your `GEMINI_API_KEY` in Vercel's Environment Variables settings
4. Click Deploy — your site will be live at a `*.vercel.app` URL

## Local Development

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
```

## Get a Gemini API Key (Free)

Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create a free key.
