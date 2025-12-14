# EntityFormDialog Component

A reusable modal dialog component for creating and editing entities in the Home Inventory System.

## Features

- ✅ Modal dialog with form
- ✅ Configurable fields via props
- ✅ Field validation (required fields marked with *)
- ✅ Inline validation error messages
- ✅ Support for multiple field types: text, textarea, select, date
- ✅ Pre-population for edit mode
- ✅ Cancel and Submit buttons
- ✅ Automatic form reset on open/close

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `title` | `string` | Yes | Dialog title (e.g., "Create Category" or "Edit Thing") |
| `fields` | `FieldConfig[]` | Yes | Array of field configurations |
| `initialData` | `Record<string, any>` | No | Initial form data for editing (defaults to empty) |
| `onSubmit` | `(data: Record<string, any>) => void` | Yes | Callback when form is submitted with valid data |
| `onClose` | `() => void` | Yes | Callback when dialog is closed/cancelled |

## FieldConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Field name (key in form data object) |
| `label` | `string` | Yes | Field label displayed to user |
| `type` | `'text' \| 'textarea' \| 'select' \| 'date'` | Yes | Field type |
| `required` | `boolean` | No | Whether field is required (shows * and validates) |
| `multiline` | `boolean` | No | For text fields, enable multiline input |
| `rows` | `number` | No | Number of rows for multiline/textarea (default: 3-4) |
| `options` | `Array<{ value: string; label: string }>` | No | Options for select fields |

## Usage Examples

### Simple Category Form

```tsx
import EntityFormDialog, { type FieldConfig } from './EntityFormDialog';

const fields: FieldConfig[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    required: true,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    rows: 4,
  },
];

<EntityFormDialog
  open={open}
  title="Create Category"
  fields={fields}
  onSubmit={(data) => console.log('Submitted:', data)}
  onClose={() => setOpen(false)}
/>
```

### Edit Mode with Initial Data

```tsx
const category = { id: '123', name: 'Electronics', description: 'Electronic items' };

<EntityFormDialog
  open={open}
  title="Edit Category"
  fields={fields}
  initialData={category}
  onSubmit={(data) => updateCategory(category.id, data)}
  onClose={() => setOpen(false)}
/>
```

### Form with Select Dropdown

```tsx
const fields: FieldConfig[] = [
  {
    name: 'name',
    label: 'Room Name',
    type: 'text',
    required: true,
  },
  {
    name: 'locationId',
    label: 'Location',
    type: 'select',
    required: true,
    options: [
      { value: 'loc-1', label: 'Home' },
      { value: 'loc-2', label: 'Office' },
    ],
  },
];
```

### Form with Date Fields

```tsx
const fields: FieldConfig[] = [
  {
    name: 'name',
    label: 'Item Name',
    type: 'text',
    required: true,
  },
  {
    name: 'datePurchased',
    label: 'Date Purchased',
    type: 'date',
  },
  {
    name: 'nextReviewDate',
    label: 'Next Review Date',
    type: 'date',
  },
];
```

## Validation

The component automatically validates required fields on submit:

- Required fields must have a non-empty value
- Validation errors are displayed inline below each field
- Form submission is prevented until all validation passes
- Errors are cleared when the user starts typing in a field

## Behavior

1. **Opening the dialog**: Form is initialized with `initialData` or empty values
2. **Editing fields**: Errors are cleared as user types
3. **Submit**: Validates all required fields, calls `onSubmit` if valid
4. **Cancel**: Closes dialog without submitting, resets form state
5. **Close (X or outside click)**: Same as Cancel

## Requirements Validated

- **3.1**: Modal dialog with form for creating entities
- **3.3**: Required field validation with error display
- **5.1**: Pre-population for edit mode
- **5.4**: Inline validation error messages

## Next Steps

This component will be extended by:
- `ThingFormDialog` - Adds photo upload functionality
- `LocationFormDialog` - Adds country selector and room management
- `RoomFormDialog` - Adds floor selector with custom input toggle
- `CategoryFormDialog` - Simple wrapper with category-specific fields
- `PersonFormDialog` - Simple wrapper with person-specific fields
