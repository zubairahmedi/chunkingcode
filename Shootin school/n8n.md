# n8n Learnings

## 1) Prefer explicit node references over plain `$json`
A common breakage in n8n happens when a node is inserted between two existing nodes.

If you use:
```javascript
{{$json.field_name}}
```
that expression only reads from the **immediately previous node output**.

So if another node gets inserted in the middle, the reference can break or point to the wrong data.

### Better approach
Use explicit references to the source node by name, for example:
```javascript
{{ $('Read Sheet Variables').item.json['First Name'] }}
{{ $('Read Sheet Variables').item.json.location }}
{{ $('Build Retell Payload').item.json.agent_id }}
```

This is safer because it keeps working even if the workflow changes in between.

---

## 2) Use node names as the source of truth
When building expressions for HTTP Request bodies, Set nodes, or IF logic:
- prefer `$('Node Name').item.json.field`
- avoid depending on only `$json.field` unless the previous node is guaranteed to stay the same

### Example
Instead of:
```javascript
{{$json.trainer_name}}
```
use:
```javascript
{{ $('Read Sheet Variables').item.json.trainer_name }}
```

---

## 3) Sheet headers with spaces need bracket notation
If Google Sheets columns have spaces in the header, use:
```javascript
{{ $('Read Sheet Variables').item.json['First Name'] }}
{{ $('Read Sheet Variables').item.json['Last Name'] }}
{{ $('Read Sheet Variables').item.json['Phone Number'] }}
```

Not:
```javascript
{{ $('Read Sheet Variables').item.json.First Name }}
```

---

## 4) Build payloads in one clean mapping step
A good pattern is:
1. Read rows from Google Sheets
2. Normalize / map fields in one `Edit Fields` node
3. Send the final mapped object to the HTTP Request node

This keeps the API node clean and easier to debug.

---

## 5) Keep API body fields aligned to the mapped node
If the `HTTP Request` node sends data to Retell, map from the prepared node fields like:
```javascript
{{ $('Build Retell Payload').item.json.from_number }}
{{ $('Build Retell Payload').item.json.to_number }}
{{ $('Build Retell Payload').item.json.agent_id }}
```

This is more stable than mixing raw sheet fields directly inside the HTTP node.

---

## 6) Use consistent naming
Try to keep these names stable across the flow:
- `from_number`
- `to_number`
- `agent_id`
- `trainer_name`
- `program_type`
- `location`
- `session_date`
- `call_time`

Consistent names make debugging much easier.

---

## 7) Debug by pinning sample data
When expressions are not resolving correctly:
- pin sample output in the node
- inspect the exact JSON shape
- verify whether the field is from the previous node or a named node

---

## Recommended rule
> In production n8n flows, prefer `$('Node Name').item.json.field` over `$json.field` when the data source matters or the flow may change later.

---

## 8) When user asks for “mapping” or “fill this node”
Interpret that as:
- take values from the **source/input node**
- map them into the **destination node**
- return the **full destination node JSON** ready to copy/paste
- do not return partial snippets unless the user explicitly asks for only one field

### Expected style
When the user says things like:
- “map this webhook into the sheet node”
- “fill this node”
- “give me the full node”
- “wire these fields into the next node”

The response should:
1. keep the existing node structure
2. update the mapping fields with explicit node-name references
3. return the **complete node JSON**
4. make it copy-paste ready for n8n

### Example pattern
Source node:
```javascript
{{ $('Webhook').item.json.body.call.call_analysis.custom_analysis_data.location }}
```

Destination node:
```json
{
  "Location": "={{ $('Webhook').item.json.body.call.call_analysis.custom_analysis_data.location || '' }}"
}
```

### Important rule
> For n8n mapping help, default to returning the **full updated destination node**, not just the individual expressions.

---

## 9) Current AI calling architecture — Type 1 and Type 2 trigger logic

### Overview
There are currently **two schedule-driven AI calling flows** in n8n:
- **Type 1 / Agent 1 flow** for school-event style programs
- **Type 2 / Agent 2 flow** for training/session style programs

These are **time-based trigger workflows**. Each flow is intended to run at **3 specific daily time windows** and then check the Google Sheet for rows that match the correct program type before continuing to the Retell call step.

---

### Type 1 flow (Agent 1)
**Purpose:** Same-day follow-up calls for Program Type 1 rows.

**Trigger windows:**
- `12:00 PM`
- `1:00 PM`
- `5:00 PM`

**Agent used:**
- `agent_ae22bec23522cdd114692de559`

**Business meaning:**
- This is treated as a **same-day retry ladder**.
- The workflow can attempt the first call at `12 PM`, retry at `1 PM` if needed, and retry again at `5 PM` if still unanswered.
- These times are best understood as **preferred call attempt windows**, not guaranteed mandatory 3 calls unless downstream no-answer logic is implemented.

**Routing idea:**
- Read the sheet
- Check whether `Program Type = 1`
- If true, continue into the Agent 1 Retell call branch

---

### Type 2 flow (Agent 2)
**Purpose:** Next-day follow-up calls for Program Type 2 rows.

**Agent used:**
- `agent_a184e6c574d185523239e23ef1`

**Observed n8n node chain from the current JSON:**
1. `Schedule Trigger2`
2. `Read Sheet Variables`
3. `Edit Fields`
4. `If`

**Exact trigger times configured in `Schedule Trigger2`:**
- `8:00 AM`
- `10:30 AM`
- `3:00 PM`

This comes from the schedule rule:
- `hoursInterval = 8`
- `hoursInterval = 10` with `triggerAtMinute = 30`
- `hoursInterval = 15`

**Sheet read details:**
- **Google Sheet document ID:** `158Yyz2rptKurR1i3KLGau4mJuca-J4Ke5xFZrbRq5KM`
- **Sheet tab:** `Sheet1` (`gid=0`)
- **Node name:** `Read Sheet Variables`

**Date filter logic in the Google Sheets node:**
- Lookup column: `Date`
- Match value 1: `={{ $now.minus(1,'days').format('M/d/yyyy') }}`
- Match value 2: `={{ $now.minus(1,'days').format('MM/dd/yyyy') }}`
- Filter combiner: `OR`

**Meaning of the date logic:**
- The Type 2 flow is intentionally looking for **yesterday’s rows**.
- It supports **two possible date formats** in the sheet:
  - `M/d/yyyy`
  - `MM/dd/yyyy`

**Program type routing condition:**
The `If` node checks:
```javascript
={{ $('Read Sheet Variables').item.json["Program Type"] }} == 2
```
with:
- operator type = `number`
- operation = `equals`
- type validation = `strict`

**Meaning:**
- Only rows where `Program Type` is a true numeric `2` should pass this branch.
- If the sheet stores it as text like `'2'`, `'Type 2'`, or `'Program 2'`, this condition may fail.

**Current hardcoded field in `Edit Fields`:**
- `toNumber = 13652753605`

**Meaning:**
- The flow is currently assigning a fixed number in the Set node.
- This looks like a **test/debug number override**, not a final production mapping from the sheet.

---

### Important technical debugging notes for Type 2
When debugging this flow later, check these items first:

1. **Schedule timezone**
   - `Schedule Trigger2` will run based on the n8n instance timezone, not just local expectation.
   - If calls appear early/late, verify the workflow/server timezone first.

2. **Date filter is for yesterday, not today**
   - The Google Sheets node explicitly uses:
   ```javascript
   $now.minus(1,'days')
   ```
   - So if the row date is today, this trigger will skip it.

3. **Two date formats are supported**
   - The node checks both `M/d/yyyy` and `MM/dd/yyyy` with `OR` logic.
   - This helps with inconsistent date formatting in the sheet.

4. **Strict numeric comparison on `Program Type`**
   - The `If` node expects a numeric `2`.
   - If the sheet value is stored as a string, the row may not pass.

5. **Hardcoded `toNumber` currently overrides dynamic phone routing**
   - The Set node currently inserts `13652753605` directly.
   - If production calling should go to the trainer’s real phone, this must later be replaced with a mapped sheet field.

6. **Current JSON only shows the pre-routing stage**
   - The excerpt ends at the `If` node.
   - The actual Retell HTTP Request / create-call node is not shown in this snippet.
   - So this JSON confirms the **trigger + filter + routing gate**, but not the final call execution step.

7. **`executeOnce: true` is enabled on the sheet read node**
   - This is worth double-checking during debugging if multiple matching rows are expected.

---

### Architecture summary in plain words
- **Type 1 flow** runs on the same day at `12 PM`, `1 PM`, and `5 PM`, checks for Program Type 1 records, and routes them to Agent 1.
- **Type 2 flow** runs the next day at `8 AM`, `10:30 AM`, and `3 PM`, reads yesterday’s sheet rows, checks for `Program Type = 2`, and routes them to Agent 2.
- In both flows, the trigger times are best understood as **scheduled calling windows / retry opportunities**, not automatic repeated calls unless no-answer handling is explicitly built downstream.

---

## 10) Post-call `Ai_status` / `aicall_status` logic

### Intended state flow
The AI calling status should behave like this:

1. **Before the call is made**
   - `Ai_status = pending`
   - Meaning: this row is still waiting for an AI call attempt.

2. **When the call finishes**
   - set `Ai_status = completed`
   - Meaning: the current call attempt has finished successfully from the workflow point of view.

3. **Then immediately check `Needs Follow-up?` with an `If` node**
   - If `Needs Follow-up? = yes` → update `Ai_status` back to `pending`
   - Else → leave `Ai_status = completed`

### Business meaning
- `pending` = row should still be picked up by the call workflow
- `completed` = no more AI follow-up is currently needed for that row
- If a completed call reveals that follow-up is still needed, the row is intentionally moved back to `pending` so it can re-enter the retry / follow-up cycle

### Plain-language rule
```text
pending -> call happens -> completed
if Needs Follow-up? = yes -> pending again
if Needs Follow-up? != yes -> stay completed
```

### n8n implementation idea
Typical order after the Retell result comes back:
1. Update sheet row: `Ai_status = completed`
2. Use an `If` node to check `Needs Follow-up?`
3. **True / yes branch:** Update the same row again to `Ai_status = pending`
4. **False / no branch:** Do nothing further, leaving the row as `completed`

### Important debugging note
Because the workflow sets `completed` first and may then switch it back to `pending`, seeing `pending` after a finished call does **not** always mean the call never happened. It can also mean:
- the call was completed,
- `Needs Follow-up?` came back as `yes`,
- and the row was deliberately re-queued for another AI follow-up attempt.

---

## 11) `Attemp_no` retry / never-picked-up logic

### Purpose
A separate retry counter is now being tracked in the Google Sheet using the column:
- `Attemp_no`

This field starts **empty** for a new row and is used to decide whether the workflow is on the first attempt, second attempt, or final no-answer outcome.

---

### Current node sequence for attempt handling
1. `Check attempt number` — Google Sheets lookup by `Phone Number`
2. `Switch` — decides which attempt branch to use
3. One of these update nodes runs:
   - `attempt 1`
   - `attempt2`
   - `attempt`

---

### Current logic in plain words
```text
If Attemp_no is empty -> this is the first call attempt -> set Attemp_no = 1
If Attemp_no = 1      -> this is the follow-up attempt -> set Attemp_no = 2
If Attemp_no = 2      -> this is the last stage -> mark aicall_status = "Did Not Pick Up"
```

So the flow behaves as:
- **blank** = no previous attempt recorded yet
- **1** = one attempt has already happened
- **2** = second attempt has already happened
- after that, instead of incrementing again, the sheet is marked as:
  - `aicall_status = Did Not Pick Up`

---

### Exact switch conditions currently used

#### Branch 1 — first attempt
The Switch node checks:
```javascript
{{ $json.Attemp_no.toString() }}
```
and tests whether it is **empty**.

**If empty:**
- route to node: `attempt 1`
- update in Google Sheets:
```text
Attemp_no = 1
```

#### Branch 2 — follow-up attempt
The Switch node checks:
```javascript
{{ $json.Attemp_no }} == 1
```

**If true:**
- route to node: `attempt2`
- update in Google Sheets:
```text
Attemp_no = 2
```

#### Branch 3 — final no-answer outcome
The Switch node checks:
```javascript
{{ $json.Attemp_no }} == 2
```

**If true:**
- route to node: `attempt`
- update in Google Sheets:
```text
aicall_status = Did Not Pick Up
```

---

### Matching key used for updates
All three Google Sheets update nodes currently match the row by:
- `Phone Number`

This means the retry counter and status are being updated against the sheet row where:
```text
Phone Number = {{ $json['Phone Number'] }}
```

---

### Business meaning
- New record with blank `Attemp_no` → first outbound attempt
- If that still needs another call window, next pass sets `Attemp_no = 2`
- If it reaches the final branch after that, the trainer is treated as **never picked up** and the row is marked:
```text
Did Not Pick Up
```

---

### Important debugging notes
1. **Column name is currently spelled `Attemp_no`**
   - This is not `Attempt_no`.
   - Keep the exact spelling consistent in the sheet and in all n8n expressions unless you intentionally rename it everywhere.

2. **Phone Number is the row match key**
   - If duplicate phone numbers exist in the sheet, the wrong row could be updated.

3. **Empty-check uses `.toString()`**
   - The current expression is:
   ```javascript
   {{ $json.Attemp_no.toString() }}
   ```
   - This works if the field exists but is blank.
   - If `Attemp_no` is truly missing or null in some cases, this should be watched carefully during debugging.

4. **Final branch does not increment again**
   - After `Attemp_no = 2`, the flow no longer sets `3`.
   - It directly marks `aicall_status = Did Not Pick Up`.

5. **This logic is separate from post-call follow-up status logic**
   - `Attemp_no` tracks the **retry stage**
   - `aicall_status` tracks the **current call state / final outcome**


