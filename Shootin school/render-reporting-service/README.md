# Shootin School Render Reporting Service

Local-first Node service for generating **weekly** and **monthly** PDF reports from Google Sheets JSON payloads.

## What it does
- accepts the `n8n` JSON payload shape you shared
- normalizes the rows locally
- splits data into:
  - `3` AI chunks for weekly reports
  - `6` AI chunks for monthly reports
- sends each chunk to an OpenAI-powered sub-agent when `OPENAI_API_KEY` is present
- runs a final synthesis agent on the chunk mini-reports
- falls back to deterministic local summaries if no API key is set
- renders HTML for easy local review
- can generate a PDF when Playwright is installed

## Project structure
- `src/server.js` — Express API endpoints
- `src/reporting/pipeline.js` — normalization, chunking, mini-report, synthesis logic
- `src/reporting/template.js` — HTML template for the PDF/report preview
- `examples/sample-payload.json` — sample payload matching the n8n structure

## Run locally
```powershell
cd "c:\Users\zubair\Desktop\Shootin school\render-reporting-service"
copy .env.example .env
npm install
npx playwright install chromium
npm start
```

## Environment variables
Put your OpenAI key in `render-reporting-service/.env`:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
```

## Endpoints
- `GET /health`
- `POST /generate-weekly-report`
- `POST /generate-monthly-report`
- `POST /generate-report`

## Local preview
To inspect the result as JSON:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/generate-weekly-report" `
  -ContentType "application/json" `
  -InFile ".\examples\sample-payload.json"
```

To inspect the HTML preview directly in the browser:
```text
http://localhost:3000/generate-weekly-report?format=html
```

To request a PDF:
```text
http://localhost:3000/generate-weekly-report?format=pdf
```

## Render deployment
Once the layout looks correct locally:
1. push this folder to a Git repo
2. create a Render Web Service
3. use start command:
```text
npm install && npm start
```
4. point `n8n` HTTP Request nodes to the deployed Render URL

## Note about AI
The service now supports OpenAI-based chunk analysis and final synthesis when `OPENAI_API_KEY` is set in `.env`.
If the key is missing, it automatically falls back to local deterministic summaries so you can still test the full pipeline end-to-end.
