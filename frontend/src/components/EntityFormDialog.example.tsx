/**
 * Example usage of EntityFormDialog component
 * 
 * This file demonstrates how to use the EntityFormDialog component
 * for creating and editing entities.
 */

import { useState } from 'react';
import EntityFormDialog, { type FieldConfig } from './EntityFormDialog';
import { Button } from '@mui/material';

// Example: Simple Category form
export function CategoryFormExample() {
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

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

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    // Call API to create/update category
    setOpen(false);
  };

  // Example of how to open edit dialog with existing data
  // const handleEdit = (category: any) => {
  //   setEditData(category);
  //   setOpen(true);
  // };

  return (
    <>
      <Button onClick={() => { setEditData(null); setOpen(true); }}>
        Add Category
      </Button>
      
      <EntityFormDialog
        open={open}
        title={editData ? 'Edit Category' : 'Create Category'}
        fields={fields}
        initialData={editData || {}}
        onSubmit={handleSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// Example: Person form with required field
export function PersonFormExample() {
  const [open, setOpen] = useState(false);

  const fields: FieldConfig[] = [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true, // Will show * and validate
    },
    {
      name: 'description',
      label: 'Description',
      type: 'text',
      multiline: true,
      rows: 3,
    },
  ];

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Person created:', data);
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Person</Button>
      
      <EntityFormDialog
        open={open}
        title="Create Person"
        fields={fields}
        onSubmit={handleSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// Example: Room form with select dropdown
export function RoomFormExample() {
  const [open, setOpen] = useState(false);

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
        { value: 'loc-3', label: 'Storage Unit' },
      ],
    },
    {
      name: 'floor',
      label: 'Floor',
      type: 'select',
      options: [
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground Floor' },
        { value: '1st', label: '1st Floor' },
        { value: '2nd', label: '2nd Floor' },
      ],
    },
  ];

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Room created:', data);
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Room</Button>
      
      <EntityFormDialog
        open={open}
        title="Create Room"
        fields={fields}
        onSubmit={handleSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// Example: Thing form with date fields
export function ThingFormExample() {
  const [open, setOpen] = useState(false);

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
      rows: 3,
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
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'cat-1', label: 'Electronics' },
        { value: 'cat-2', label: 'Furniture' },
        { value: 'cat-3', label: 'Tools' },
      ],
    },
  ];

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Thing created:', data);
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Thing</Button>
      
      <EntityFormDialog
        open={open}
        title="Create Thing"
        fields={fields}
        onSubmit={handleSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
