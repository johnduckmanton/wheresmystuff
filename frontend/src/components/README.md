# Components Directory

This directory contains React components organized by feature:

## Implemented Components

### EntityFormDialog
A reusable modal dialog component for creating and editing entities.

**Props:**
- `open: boolean` - Controls dialog visibility
- `title: string` - Dialog title
- `fields: FieldConfig[]` - Array of field configurations
- `initialData?: Record<string, any>` - Initial form data for editing
- `onSubmit: (data: Record<string, any>) => void` - Callback when form is submitted
- `onClose: () => void` - Callback when dialog is closed

**FieldConfig:**
- `name: string` - Field name (key in form data)
- `label: string` - Field label displayed to user
- `type: 'text' | 'textarea' | 'select' | 'date'` - Field type
- `required?: boolean` - Whether field is required (marked with *)
- `multiline?: boolean` - For text fields, enable multiline
- `rows?: number` - Number of rows for multiline/textarea
- `options?: Array<{ value: string; label: string }>` - Options for select fields

**Features:**
- Field validation with inline error messages
- Required field indicators (*)
- Support for text, textarea, select, and date fields
- Pre-population for edit mode
- Cancel and Submit buttons

### EntityTable
A reusable data table component with sorting, filtering, and pagination.

**Features:**
- Global search across all columns
- Per-column filtering
- Column sorting (ascending/descending)
- Pagination
- Edit and Delete action buttons
- Row click handling
- Filtered item count display

## Planned Structure

- **auth/** - Authentication components (SignIn, SignOut, ProtectedRoute)
- **layout/** - Layout components (AppLayout, Sidebar, Header)
- **tables/** - Data table components (EntityTable, ExpandableLocationRow)
- **forms/** - Form dialog components (ThingFormDialog, LocationFormDialog, etc.)
- **photos/** - Photo upload components (PhotoUploadZone, PhotoPreviewGrid)
- **inputs/** - Specialized input components (CountrySelector, FloorSelector)

Additional components will be implemented in subsequent tasks.
