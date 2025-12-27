import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Autocomplete,
  Divider,
} from '@mui/material';
import type { Location, Room } from '../types/entities';
import InlineRoomEditor from './InlineRoomEditor';
import InventoryFormSelector from './InventoryFormSelector';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';

// ISO 3166-1 alpha-2 country codes with names
const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

export interface LocationFormDialogProps {
  open: boolean;
  location?: Location;
  onSubmit: (data: Partial<Location>) => void;
  onClose: () => void;
}

export default function LocationFormDialog({
  open,
  location,
  onSubmit,
  onClose,
}: LocationFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Location>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const { currentInventory } = useInventory();

  // Initialize form data when dialog opens or location changes
  useEffect(() => {
    if (open) {
      if (location) {
        setFormData({ ...location });
        loadRooms(location.id);
      } else {
        // Creating new location - auto-select current inventory
        setFormData({
          name: '',
          inventoryId: currentInventory?.id || '',
          addressLine1: '',
          addressLine2: '',
          town: '',
          county: '',
          postcode: '',
          country: '',
          description: '',
        });
        setRooms([]);
      }
      setErrors({});
    }
  }, [open, location]);

  // Load rooms for the current location
  const loadRooms = async (locationId: string) => {
    if (!currentInventory) return;
    
    try {
      const roomsData = await apiClient.getRooms(locationId, currentInventory.id);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  // Handle field change
  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (!formData.inventoryId || formData.inventoryId.trim() === '') {
      newErrors.inventoryId = 'Inventory is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({});
    setErrors({});
    onClose();
  };

  // Get country object from code
  const getCountryFromCode = (code: string | undefined) => {
    if (!code) return null;
    return COUNTRIES.find(c => c.code === code) || null;
  };

  // Room management handlers for InlineRoomEditor
  const handleAddRoom = async (roomData: { name: string }) => {
    if (!location?.id || !currentInventory) return;
    
    try {
      await apiClient.createRoom({
        ...roomData,
        locationId: location.id,
        inventoryId: currentInventory.id,
      } as Omit<Room, 'id' | 'dateAdded'>);
      
      // Reload rooms
      await loadRooms(location.id);
    } catch (error) {
      console.error('Error adding room:', error);
      throw error; // Let InlineRoomEditor handle the error display
    }
  };

  const handleUpdateRoom = async (roomId: string, roomData: { name: string }) => {
    if (!location?.id) return;
    
    try {
      await apiClient.updateRoom(roomId, roomData);
      
      // Reload rooms
      await loadRooms(location.id);
    } catch (error) {
      console.error('Error updating room:', error);
      throw error; // Let InlineRoomEditor handle the error display
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!location?.id || !currentInventory) return;
    
    try {
      await apiClient.deleteRoom(roomId, currentInventory.id);
      
      // Reload rooms
      await loadRooms(location.id);
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error; // Let InlineRoomEditor handle the error display
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="location-form-dialog-title"
    >
      <DialogTitle id="location-form-dialog-title">
        {location ? 'Edit Location' : 'Add Location'}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5, // Reduced from 2 to 1.5
            pt: 1,
          }}
        >
          <TextField
            fullWidth
            label="Name"
            value={formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            inputProps={{
              'aria-label': 'Location name',
              'aria-required': 'true',
            }}
          />

          <InventoryFormSelector
            value={formData.inventoryId || ''}
            onChange={(inventoryId) => handleFieldChange('inventoryId', inventoryId)}
            error={errors.inventoryId}
            required
          />

          <TextField
            fullWidth
            label="Address Line 1"
            value={formData.addressLine1 || ''}
            onChange={(e) => handleFieldChange('addressLine1', e.target.value)}
            inputProps={{
              'aria-label': 'Address line 1',
            }}
          />

          <TextField
            fullWidth
            label="Address Line 2"
            value={formData.addressLine2 || ''}
            onChange={(e) => handleFieldChange('addressLine2', e.target.value)}
            inputProps={{
              'aria-label': 'Address line 2',
            }}
          />

          <TextField
            fullWidth
            label="Town"
            value={formData.town || ''}
            onChange={(e) => handleFieldChange('town', e.target.value)}
            inputProps={{
              'aria-label': 'Town or city',
            }}
          />

          <TextField
            fullWidth
            label="County"
            value={formData.county || ''}
            onChange={(e) => handleFieldChange('county', e.target.value)}
          />

          <TextField
            fullWidth
            label="Postcode"
            value={formData.postcode || ''}
            onChange={(e) => handleFieldChange('postcode', e.target.value)}
          />

          <Autocomplete
            options={COUNTRIES}
            getOptionLabel={(option) => option.name}
            value={getCountryFromCode(formData.country)}
            onChange={(_, newValue) => {
              handleFieldChange('country', newValue?.code || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Country"
                placeholder="Search for a country"
              />
            )}
            isOptionEqualToValue={(option, value) => option.code === value.code}
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            multiline
            rows={3}
          />

          {/* Room Management Section - Only show when editing existing location */}
          {location && (
            <>
              <Divider sx={{ mt: 2 }} />
              
              <Box sx={{ mt: 2 }}>
                <InlineRoomEditor
                  rooms={rooms}
                  onAddRoom={handleAddRoom}
                  onUpdateRoom={handleUpdateRoom}
                  onDeleteRoom={handleDeleteRoom}
                  disabled={false}
                />
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {location ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
