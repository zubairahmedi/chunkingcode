# Render Reporting Architecture

## Goal
Build a **Render-hosted reporting service** that receives Google Sheets data from `n8n`, processes it with AI in chunks, and generates two PDF reports:
- **7-day / weekly report**
- **30-day / monthly report**

This service is for **PDF reporting only**, not video.

---

## High-level architecture

```text
Google Sheets -> n8n -> Render API -> chunking + AI mini-reports -> final synthesis -> HTML template -> PDF -> return to n8n -> email to client
```

---

## Role of each system

### `n8n`
`n8n` is responsible for:
- scheduling the report jobs
- reading rows from Google Sheets
- sending the selected report data to Render
- receiving the generated PDF or PDF URL
- emailing the report to the client / leadership

### `Render`
The Render server is responsible for:
- receiving report data as JSON
- normalizing and cleaning the data
- splitting the data into smaller chunks
- running AI agents on those chunks
- combining the chunk summaries into one final report
- rendering the final PDF

---

## Important transport rule
**Do not send one giant raw text dump if possible.**

Preferred format from `n8n` to Render:
- **structured JSON**
- one object per sheet row
- include report metadata such as report type and date range

### Recommended request payload
```json
{
  "reportType": "weekly",
  "dateRange": {
    "start": "2026-04-01",
    "end": "2026-04-07"
  },
  "rows": [
    {
      "Date": "4/7/2026",
      "First Name": "John",
      "Last Name": "Doe",
      "Phone Number": "3652753605",
      "Program Type": 1,
      "Location": "Example School",
      "Call Status": "completed",
      "Needs Follow-up?": "yes",
      "aicall_status": "pending",
      "Attemp_no": "1",
      "Flag Reason": "Injury reported"
    }
  ]
}
```

### Why JSON is better than plain text
- preserves row structure
- easier to clean and validate
- safer for chunking
- easier to debug on Render
- avoids breaking records in the middle

---

## Report pipeline on Render

### 1) Receive report job
The Render API receives:
- `reportType` = `weekly` or `monthly`
- `dateRange`
- `rows[]`

### 2) Normalize the data
Before any AI step, the server should normalize:
- date formats
- empty values
- `Program Type`
- `Needs Follow-up?`
- `aicall_status`
- `Attemp_no`
- any boolean / status field

This ensures all downstream agents see consistent input.

### 3) Chunk the dataset
The data should be split by **row groups / balanced size**, not random text slicing.

#### Weekly report
- split the data into **3 chunks**
- each chunk is processed by a worker AI agent

#### Monthly report
- split the data into **6 chunks**
- each chunk is processed by a worker AI sub-agent

> These chunks should be as equal as practical by row count or token size.

### 4) Generate mini-reports per chunk
Each chunk goes through a worker analysis step that produces a **small structured mini-report**, not a long essay.

### Expected mini-report shape
```json
{
  "summary": "",
  "incident_count": 0,
  "follow_up_count": 0,
  "did_not_pick_up_count": 0,
  "key_issues": ["", "", ""],
  "highlights": ["", "", ""]
}
```

### 5) Final synthesis step
A final synthesizer agent receives only the **mini-reports**, not all raw rows again.

Its job is to build the final management-ready report with sections such as:
- Executive Summary
- Key Highlights
- Risks / Incidents
- Follow-up Items
- Recommendations

This keeps the final step lightweight and avoids huge token usage.

### 6) HTML-to-PDF rendering
Once the final report content is ready, the Render service should:
- inject the content into an HTML template
- render the PDF using a tool such as:
  - `Puppeteer`, or
  - `Playwright`

### 7) Return result to n8n
The server should return either:
- the PDF binary directly, or
- a hosted file URL

Then `n8n` sends the report by email.

---

## Suggested AI agent structure

### Chunk worker agent
Used on each of the 3 weekly chunks or 6 monthly chunks.

**Output should be short JSON only.**
This agent should summarize:
- major incidents
- unresolved follow-ups
- call outcome patterns
- short highlights

### Final synthesizer agent
Used once after all chunk mini-reports are ready.

**Input:** all mini-report JSON objects
**Output:** one compact final report object suitable for the PDF template

---

## Why this architecture is practical
- `n8n` stays focused on orchestration and email delivery
- Render handles heavier analysis and PDF generation
- chunking reduces token pressure
- the final synthesis step stays manageable
- the same service can support both weekly and monthly reports

---

## Local-first development plan
The best implementation path is:

1. build the report service **locally**
2. test with real or sample Sheets JSON data
3. perfect the PDF layout, branding, spacing, and section structure
4. verify weekly and monthly output visually
5. deploy the same service to Render

This is the safest way to debug layout and data issues before going live.

---

## Recommended endpoints
Suggested Render API endpoints:
- `POST /generate-weekly-report`
- `POST /generate-monthly-report`
- optional: `GET /health`

Both report endpoints should accept JSON payloads from `n8n` and return a PDF or PDF link.

---

## Implementation notes / guardrails
- prefer **JSON input**, not raw text blobs
- chunk by records, not by arbitrary text characters
- keep all worker-agent outputs small and structured
- do not pass all raw sheet rows to the final synthesizer again
- use fixed report sections so the PDF layout remains consistent
- log the chunk count, date range, and report type for debugging

---

## Final summary
The reporting system should work like this:

```text
n8n reads Google Sheets -> sends JSON to Render -> Render splits into 3 weekly chunks or 6 monthly chunks -> AI sub-agents create mini-reports -> final synthesizer combines them -> Render generates PDF -> n8n emails the result
```

This is the planned architecture for **Render-based weekly and monthly PDF reporting**.
