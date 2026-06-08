# Requirements Document

## Introduction

This feature adds a comprehensive insurance reporting system to the home inventory application. It enables users to generate insurance-ready reports of their household contents, receive UK-specific policy alerts (single item limits, underinsurance warnings), manage proof of ownership evidence, handle storage/out-of-home items separately, and produce guided claim packs when an incident occurs. The system supports multiple report levels (basic through premium) and export formats (PDF, CSV/Excel, claim mode).

## Glossary

- **Report_Generator**: The backend service responsible for aggregating inventory data, computing valuations, applying policy rules, and producing structured report output.
- **Insurance_Report_UI**: The frontend interface where users configure, preview, and export insurance reports.
- **Claim_Pack_Wizard**: The guided frontend flow that walks users through creating an insurance claim pack after an incident.
- **PDF_Renderer**: The service that converts structured report data into a formatted, human-readable PDF document with inline photos.
- **CSV_Exporter**: The service that converts structured report data into CSV/Excel format suitable for claims handlers.
- **Policy_Analyser**: The component that evaluates inventory items against UK insurance policy thresholds and generates alerts and warnings.
- **Evidence_Manager**: The component responsible for associating, validating, and bundling proof-of-ownership evidence (photos, receipts, serial numbers) with inventory items.
- **Storage_Tagger**: The component that manages the "in storage" designation on items and generates separate storage-specific insurance reports.
- **Report_Version_Store**: The component that persists historical snapshots of generated reports for audit and comparison purposes.
- **Thing**: An inventory item in the system, with properties including name, description, category, location, room, estimated value, photos, serial numbers, receipts, warranties, and condition.
- **Single_Item_Limit**: A UK home insurance policy threshold (typically £1,000–£1,500) above which individual items must be declared separately to the insurer.
- **Underinsurance**: A situation where the total declared contents value is significantly lower than the estimated replacement cost, risking proportional claim payouts.
- **Claim_Pack**: A bundled export containing an incident summary, police report reference, filtered list of affected items, and associated evidence.
- **Incident_Type**: A classification of the event triggering a claim, such as fire, theft, flood, or accidental damage.

## Requirements

---

### Requirement 1: Report Summary Generation

**User Story:** As a homeowner, I want to generate a summary of my insured contents, so that I can see the total value and breakdown of my household inventory at a glance.

#### Acceptance Criteria

1. WHEN a user requests an insurance report for an inventory, THE Report_Generator SHALL compute and return the total estimated replacement value of all items in that inventory.
2. WHEN a user requests an insurance report, THE Report_Generator SHALL return the total number of items included in the report.
3. WHEN a user requests an insurance report, THE Report_Generator SHALL return a breakdown of item count and total value grouped by room.
4. WHEN a user requests an insurance report, THE Report_Generator SHALL return a breakdown of item count and total value grouped by category.
5. WHEN a user requests an insurance report, THE Report_Generator SHALL return a list of high-value items, defined as items whose estimated replacement value exceeds the configurable Single_Item_Limit threshold.

---

### Requirement 2: Item-Level Detail in Reports

**User Story:** As a homeowner, I want each item in my insurance report to include full detail, so that I have a complete record for my insurer.

#### Acceptance Criteria

1. THE Report_Generator SHALL include the following fields for each item in the report: name, description, category name, room name, location name, estimated replacement value, purchase date, condition, and notes.
2. WHEN an item has one or more photos, THE Report_Generator SHALL include the photo references in that item's report entry.
3. WHEN an item has one or more receipts or warranty documents, THE Report_Generator SHALL include the document references in that item's report entry.
4. WHEN an item has a serial number, THE Report_Generator SHALL include the serial number in that item's report entry.
5. WHEN an item has a make or model, THE Report_Generator SHALL include the make and model in that item's report entry.

---

### Requirement 3: UK Single Item Limit Alerts

**User Story:** As a UK homeowner, I want to be alerted when an item exceeds the typical single item limit on my policy, so that I know which items to declare separately to my insurer.

#### Acceptance Criteria

1. THE Policy_Analyser SHALL use a default Single_Item_Limit threshold of £1,500.
2. WHERE a user has configured a custom Single_Item_Limit threshold, THE Policy_Analyser SHALL use the user-configured threshold instead of the default.
3. WHEN an item's estimated replacement value exceeds the Single_Item_Limit threshold, THE Policy_Analyser SHALL flag that item with a "high-value" alert.
4. WHEN an item is flagged as high-value, THE Policy_Analyser SHALL include the recommendation "Declare this item separately to your insurer" in the alert.
5. WHEN an insurance report is generated, THE Report_Generator SHALL include the count of high-value items and the total value of high-value items in the report summary.

---

### Requirement 4: Underinsurance Risk Warnings

**User Story:** As a UK homeowner, I want to be warned if my total contents value suggests I may be underinsured, so that I can adjust my policy to avoid proportional claim payouts.

#### Acceptance Criteria

1. WHEN an insurance report is generated, THE Policy_Analyser SHALL compare the total estimated replacement value against a user-provided declared contents cover amount.
2. WHEN the total estimated replacement value exceeds the declared contents cover amount by more than 10%, THE Policy_Analyser SHALL generate an underinsurance warning.
3. WHEN an underinsurance warning is generated, THE Policy_Analyser SHALL include the estimated replacement total, the declared cover amount, and the percentage difference in the warning.
4. WHEN an underinsurance warning is generated, THE Policy_Analyser SHALL include the recommendation "Review your contents insurance cover amount with your insurer" in the warning.
5. IF a user has not provided a declared contents cover amount, THEN THE Policy_Analyser SHALL omit the underinsurance check and display a prompt to enter the declared cover amount.

---

### Requirement 5: Proof of Ownership Evidence Management

**User Story:** As a homeowner, I want to attach and manage proof of ownership evidence for my items, so that I have strong documentation to support any future claim.

#### Acceptance Criteria

1. WHEN a user uploads a photo for an item, THE Evidence_Manager SHALL store the photo and associate it with the item record.
2. WHEN a user uploads a receipt or bank statement for an item, THE Evidence_Manager SHALL store the document and associate it with the item record.
3. THE Evidence_Manager SHALL record a timestamp for each piece of evidence at the time of upload.
4. WHEN an insurance report is generated, THE Evidence_Manager SHALL include the count of evidence items (photos, receipts, serial numbers) per item in the report.
5. WHEN an item has zero evidence items attached, THE Evidence_Manager SHALL flag that item with a "missing evidence" warning in the report.

---

### Requirement 6: Storage and Out-of-Home Item Tagging

**User Story:** As a homeowner, I want to tag items that are in storage, so that I can generate a separate insurance report for items not covered by standard home insurance.

#### Acceptance Criteria

1. WHEN a user marks an item as "in storage", THE Storage_Tagger SHALL set the storage flag on that item record.
2. WHEN a user removes the "in storage" designation from an item, THE Storage_Tagger SHALL clear the storage flag on that item record.
3. WHEN a user requests an insurance report, THE Report_Generator SHALL exclude items flagged as "in storage" from the main home insurance report by default.
4. WHEN a user requests a storage insurance report, THE Report_Generator SHALL include only items flagged as "in storage" in that report.
5. WHEN a storage insurance report is generated, THE Report_Generator SHALL include a summary with total item count, total estimated value, and storage location details.

---

### Requirement 7: Report Levels

**User Story:** As a homeowner, I want to choose the level of detail in my insurance report, so that I can generate anything from a quick overview to a fully claim-ready document.

#### Acceptance Criteria

1. WHEN a user selects report level "basic", THE Report_Generator SHALL produce a report containing only the item list (name and value) and the total value.
2. WHEN a user selects report level "good", THE Report_Generator SHALL produce a report containing item photos, category groupings, room groupings, and the total value.
3. WHEN a user selects report level "target", THE Report_Generator SHALL produce a report containing claim-ready formatting, high-value item alerts, evidence attached per item, insurer-friendly structure, and version history metadata.
4. WHEN a user selects report level "premium", THE Report_Generator SHALL produce a Claim_Pack containing an incident summary section, police report reference field, filtered list of affected items, and an evidence bundle.
5. THE Insurance_Report_UI SHALL display the available report levels with descriptions and allow the user to select one before generating a report.

---

### Requirement 8: PDF Export

**User Story:** As a homeowner, I want to export my insurance report as a PDF, so that I have a clean, human-readable document to share with my insurer.

#### Acceptance Criteria

1. WHEN a user requests a PDF export, THE PDF_Renderer SHALL generate a structured PDF document organised room-by-room.
2. WHEN an item has photos and the report level includes photos, THE PDF_Renderer SHALL embed the item photos inline in the PDF.
3. THE PDF_Renderer SHALL include a cover page with the report title, generation date, inventory name, and total contents value.
4. THE PDF_Renderer SHALL include a table of contents listing each room section and the summary section.
5. WHEN the report includes high-value item alerts, THE PDF_Renderer SHALL visually highlight flagged items in the PDF.

---

### Requirement 9: CSV/Excel Export

**User Story:** As a homeowner, I want to export my insurance report as CSV or Excel, so that claims handlers can easily process my data.

#### Acceptance Criteria

1. WHEN a user requests a CSV export, THE CSV_Exporter SHALL generate a CSV file with one row per item and columns for: name, description, category, room, location, estimated value, purchase date, condition, serial number, make, model, and evidence count.
2. WHEN a user requests a CSV export, THE CSV_Exporter SHALL include a header row with column names as the first row.
3. THE CSV_Exporter SHALL format monetary values as plain numbers without currency symbols to ensure spreadsheet compatibility.
4. THE CSV_Exporter SHALL format dates in ISO 8601 format (YYYY-MM-DD).
5. WHEN the CSV contains items with commas or special characters in text fields, THE CSV_Exporter SHALL properly escape those fields using RFC 4180 quoting rules.

---

### Requirement 10: Claim Mode Export

**User Story:** As a homeowner who has experienced an incident, I want to export only the damaged or stolen items with their evidence, so that I can submit a focused claim to my insurer.

#### Acceptance Criteria

1. WHEN a user initiates a claim mode export, THE Report_Generator SHALL include only items that the user has marked as affected.
2. WHEN a claim mode export is generated, THE Report_Generator SHALL include the incident summary (incident type, date, affected rooms) in the export.
3. WHEN a claim mode export is generated, THE Evidence_Manager SHALL bundle all evidence (photos, receipts, documents) for affected items into the export.
4. WHEN a claim mode export is generated as PDF, THE PDF_Renderer SHALL include the incident summary on the first page followed by the affected items with inline evidence.
5. WHEN a claim mode export is generated as CSV, THE CSV_Exporter SHALL include additional columns for incident type, incident date, and police report reference.

---

### Requirement 11: Claim Pack Wizard Flow

**User Story:** As a homeowner who has experienced an incident, I want a guided flow to create my insurance claim pack, so that I can quickly and accurately report what happened and which items were affected.

#### Acceptance Criteria

1. WHEN a user starts the Claim Pack Wizard, THE Claim_Pack_Wizard SHALL present a step to select the incident type from a predefined list (fire, theft, flood, accidental damage, storm, other).
2. WHEN a user has selected an incident type, THE Claim_Pack_Wizard SHALL present a step to enter the incident date and an optional police report reference number.
3. WHEN a user has entered incident details, THE Claim_Pack_Wizard SHALL present a step to select which rooms were affected.
4. WHEN rooms are selected, THE Claim_Pack_Wizard SHALL auto-select all items located in those rooms as affected items.
5. WHEN items are auto-selected, THE Claim_Pack_Wizard SHALL allow the user to manually add or remove individual items from the affected list.
6. WHEN the user confirms the affected items, THE Claim_Pack_Wizard SHALL generate a claim pack preview showing the incident summary and affected items with evidence.
7. WHEN the user approves the preview, THE Claim_Pack_Wizard SHALL offer export options (PDF, CSV) and generate the selected export.

---

### Requirement 12: Report Version History

**User Story:** As a homeowner, I want to keep a history of my generated insurance reports, so that I can track changes to my inventory valuation over time and reference previous reports.

#### Acceptance Criteria

1. WHEN an insurance report is generated at "target" or "premium" level, THE Report_Version_Store SHALL persist a snapshot of the report data with a unique version identifier and generation timestamp.
2. WHEN a user requests the version history for an inventory, THE Report_Version_Store SHALL return a list of previous report versions with version identifier, generation date, total value, and item count.
3. WHEN a user selects a previous report version, THE Report_Version_Store SHALL retrieve and display the full report data for that version.
4. THE Report_Version_Store SHALL retain report versions for a minimum of 7 years to support long-term insurance records.
5. WHEN two report versions are compared, THE Report_Version_Store SHALL identify items that were added, removed, or changed in value between the two versions.

---

### Requirement 13: Insurance Report API Endpoints

**User Story:** As a developer, I want well-defined API endpoints for insurance report operations, so that the frontend can request report generation, exports, and claim pack creation.

#### Acceptance Criteria

1. WHEN a GET request is made to the insurance report endpoint with an inventory ID and report level, THE Report_Generator SHALL return the structured report data as JSON.
2. WHEN a GET request is made to the insurance report endpoint with a format parameter of "pdf", THE PDF_Renderer SHALL return the report as a downloadable PDF file.
3. WHEN a GET request is made to the insurance report endpoint with a format parameter of "csv", THE CSV_Exporter SHALL return the report as a downloadable CSV file.
4. WHEN a POST request is made to the claim pack endpoint with incident details and affected item IDs, THE Report_Generator SHALL generate and return the claim pack data.
5. IF an unauthenticated request is made to any insurance report endpoint, THEN THE Report_Generator SHALL return a 401 Unauthorized response.
6. IF a user requests a report for an inventory they do not have access to, THEN THE Report_Generator SHALL return a 403 Forbidden response.

---

### Requirement 14: Insurance Report UI - Report Configuration and Preview

**User Story:** As a homeowner, I want a clear interface to configure and preview my insurance report before exporting, so that I can verify the contents and choose the right options.

#### Acceptance Criteria

1. THE Insurance_Report_UI SHALL display a report configuration panel with options for report level, declared cover amount, and Single_Item_Limit threshold.
2. WHEN a user configures report options and requests a preview, THE Insurance_Report_UI SHALL display a preview of the report summary including total value, item count, high-value alerts, and underinsurance warnings.
3. WHEN the report preview is displayed, THE Insurance_Report_UI SHALL show export buttons for PDF and CSV formats.
4. WHEN the report includes high-value item alerts, THE Insurance_Report_UI SHALL display the alerts prominently with the item name, value, and recommendation.
5. WHEN the report includes an underinsurance warning, THE Insurance_Report_UI SHALL display the warning prominently with the estimated total, declared cover, and percentage difference.
6. THE Insurance_Report_UI SHALL display a loading indicator while the report is being generated.

---

### Requirement 15: Insurance Report UI - Storage Items View

**User Story:** As a homeowner, I want to see and manage which items are in storage from the insurance report interface, so that I can ensure my storage items are separately insured.

#### Acceptance Criteria

1. THE Insurance_Report_UI SHALL display a toggle to switch between the main home insurance report and the storage insurance report.
2. WHEN the storage report view is active, THE Insurance_Report_UI SHALL display only items flagged as "in storage" with their details and evidence.
3. THE Insurance_Report_UI SHALL display the total count and total value of storage items separately from home items.
4. WHEN a user toggles an item's storage flag from the insurance report interface, THE Storage_Tagger SHALL update the item record and THE Insurance_Report_UI SHALL refresh the report view.

---

### Requirement 16: Report Data Serialisation

**User Story:** As a developer, I want the report data to be serialised and deserialised consistently, so that reports can be stored, retrieved, and exported without data loss.

#### Acceptance Criteria

1. THE Report_Generator SHALL serialise report data to JSON format for API responses and version storage.
2. THE Report_Generator SHALL deserialise stored JSON report data back into the same structured format without data loss.
3. FOR ALL valid report data objects, serialising to JSON then deserialising SHALL produce an object equivalent to the original (round-trip property).
4. THE CSV_Exporter SHALL serialise report data to CSV format following RFC 4180.
5. FOR ALL valid report data objects containing special characters (commas, quotes, newlines), serialising to CSV then parsing the CSV SHALL produce values equivalent to the original item fields (round-trip property).
