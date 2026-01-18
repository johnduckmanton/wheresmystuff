import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  IconButton,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  AutoAwesome as AIIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Category, Thing, Location, Room, Person } from '../types';
import { v4 as uuidv4 } from 'uuid';
import EnhancedTagInput from './EnhancedTagInput';

interface AIAnalysisResult {
  success: boolean;
  analysis?: {
    itemName: string;
    description: string;
    suggestedCategory: string;
    extractedText: {
      brandNames: string[];
      modelNumbers: string[];
      serialNumbers: string[];
      otherText: string[];
    };
    estimatedValue?: number;
    confidence: {
      overall: number;
      itemName: number;
      description: number;
      category: number;
    };
  };
  error?: string;
  processingTimeMs: number;
  mockMode?: boolean;
}

interface AIPhotoUploadProps {
  categories: Category[];
  onThingCreated: (thing: Thing) => void;
}

export default function AIPhotoUpload({ categories, onThingCreated }: AIPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [photoKey, setPhotoKey] = useState<string>('');
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [cameraInputKey, setCameraInputKey] = useState(0);
  
  // Data for dropdowns
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  
  // Form state for editing AI suggestions
  const [editedData, setEditedData] = useState({
    name: '',
    description: '',
    categoryId: '',
    locationId: '',
    roomId: '',
    ownerId: '',
    make: '',
    model: '',
    serialNumber: '',
    tags: [] as string[],
    notes: '',
    purchasePrice: '',
    datePurchased: '',
    purchasedFrom: '',
    warrantyDetails: '',
    estimatedValue: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useNotification();
  const { currentInventory } = useInventory();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
    // Clear the input to allow selecting the same file again
    event.target.value = '';
  };

  const handleCameraSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
    // Clear the input to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!currentInventory) {
      showError('Please select an inventory first');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Generate a temporary entity ID for the photo (proper UUID format)
      const tempEntityId = uuidv4();

      // Get upload URL
      const uploadResponse = await apiClient.generateUploadUrl(
        file.name,
        file.type,
        currentInventory.id,
        tempEntityId
      );

      setUploadProgress(50);

      // Upload the file
      const uploadResult = await fetch(uploadResponse.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload photo');
      }

      setUploadProgress(100);
      setPhotoKey(uploadResponse.key);

      // Start AI analysis
      await analyzePhoto(uploadResponse.key);

    } catch (error) {
      console.error('Upload error:', error);
      showError(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const loadInventoryData = async () => {
    if (!currentInventory) return;

    try {
      console.log('Loading inventory data for:', currentInventory.id);
      
      // Load locations, rooms, and people for the current inventory
      const [locationsData, roomsData, peopleData] = await Promise.all([
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id), // Use inventoryId parameter for rooms
        apiClient.getPeople(currentInventory.id)
      ]);

      console.log('Loaded data:', { 
        locations: locationsData.length, 
        rooms: roomsData.length, 
        people: peopleData.length 
      });

      setLocations(locationsData);
      setRooms(roomsData);
      setPeople(peopleData);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      showError('Failed to load inventory data for dropdowns');
    }
  };

  const analyzePhoto = async (photoKey: string) => {
    if (!currentInventory) return;

    try {
      setIsAnalyzing(true);

      // Load inventory data for dropdowns
      await loadInventoryData();

      const result: AIAnalysisResult = await apiClient.analyzePhoto(photoKey, currentInventory.id);
      setAnalysisResult(result);

      if (result.success && result.analysis) {
        // Pre-populate form with AI suggestions
        const suggestedCategory = categories.find(c => 
          c.name.toLowerCase() === result.analysis!.suggestedCategory.toLowerCase()
        );

        setEditedData({
          name: result.analysis.itemName,
          description: result.analysis.description,
          categoryId: suggestedCategory?.id || '',
          locationId: '',
          roomId: '',
          ownerId: '',
          make: result.analysis.extractedText.brandNames[0] || '',
          model: result.analysis.extractedText.modelNumbers[0] || '',
          serialNumber: result.analysis.extractedText.serialNumbers[0] || '',
          tags: [],
          notes: '',
          purchasePrice: '',
          datePurchased: '',
          purchasedFrom: '',
          warrantyDetails: '',
          estimatedValue: result.analysis.estimatedValue?.toString() || '',
        });

        setShowAnalysisDialog(true);
      } else {
        showError(result.error || 'AI analysis failed');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      showError('AI analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateThing = async () => {
    if (!currentInventory || !photoKey) return;

    try {
      const thingData: Omit<Thing, 'dateAdded'> = {
        id: uuidv4(), // Generate proper UUID for the Thing
        name: editedData.name || 'Unnamed Item',
        description: editedData.description || undefined,
        categoryId: editedData.categoryId || undefined,
        locationId: editedData.locationId || undefined,
        roomId: editedData.roomId || undefined,
        ownerId: editedData.ownerId || undefined,
        make: editedData.make || undefined,
        model: editedData.model || undefined,
        serialNumber: editedData.serialNumber || undefined,
        tags: editedData.tags.length > 0 ? editedData.tags : undefined,
        notes: editedData.notes || undefined,
        purchasePrice: editedData.purchasePrice ? parseFloat(editedData.purchasePrice) : undefined,
        datePurchased: editedData.datePurchased || undefined,
        purchasedFrom: editedData.purchasedFrom || undefined,
        warrantyDetails: editedData.warrantyDetails || undefined,
        disposalDate: editedData.disposalDate || undefined,
        nextReviewDate: editedData.nextReviewDate || undefined,
        disposalDate: editedData.disposalDate || undefined,
        nextReviewDate: editedData.nextReviewDate || undefined,
        inventoryId: currentInventory.id,
        photos: [photoKey]
      };

      const newThing = await apiClient.createThing(thingData);
      
      showSuccess(`Item "${newThing.name}" created successfully with AI assistance!`);
      onThingCreated(newThing);
      
      // Reset state
      setShowAnalysisDialog(false);
      setAnalysisResult(null);
      setPhotoKey('');
      setEditedData({
        name: '',
        description: '',
        categoryId: '',
        locationId: '',
        roomId: '',
        ownerId: '',
        make: '',
        model: '',
        serialNumber: '',
        tags: [],
        notes: '',
        purchasePrice: '',
        datePurchased: '',
        purchasedFrom: '',
        warrantyDetails: '',
        estimatedValue: '',
      });

    } catch (error) {
      console.error('Create thing error:', error);
      showError('Failed to create item. Please try again.');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <Box>
      {/* Upload Interface */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AIIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
              AI Photo Recognition
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a photo and let AI identify the item and suggest details automatically.
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isAnalyzing}
            >
              Upload Photo
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => {
                // Force a fresh input element for camera by updating key
                setCameraInputKey(prev => prev + 1);
                setTimeout(() => {
                  cameraInputRef.current?.click();
                }, 10);
              }}
              disabled={isUploading || isAnalyzing}
            >
              Take Photo
            </Button>
          </Stack>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <input
            key={cameraInputKey}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            onChange={handleCameraSelect}
            style={{ display: 'none' }}
            capture="environment"
          />

          {/* Progress Indicators */}
          {isUploading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Uploading photo... {uploadProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}

          {isAnalyzing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                AI is analyzing your photo...
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results Dialog */}
      <Dialog 
        open={showAnalysisDialog} 
        onClose={() => setShowAnalysisDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AIIcon sx={{ mr: 1 }} />
              AI Analysis Results
              {analysisResult?.mockMode && (
                <Chip 
                  label="Demo Mode" 
                  size="small" 
                  color="info" 
                  sx={{ ml: 1 }} 
                />
              )}
            </Box>
            <IconButton onClick={() => setShowAnalysisDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {analysisResult?.analysis && (
            <Box sx={{ pt: 1 }}>
              {/* Confidence Score */}
              <Alert 
                severity={getConfidenceColor(analysisResult.analysis.confidence.overall) as any}
                sx={{ mb: 3 }}
              >
                <Typography variant="body2">
                  <strong>AI Confidence: {getConfidenceLabel(analysisResult.analysis.confidence.overall)}</strong>
                  {' '}({Math.round(analysisResult.analysis.confidence.overall * 100)}%)
                </Typography>
                <Typography variant="caption">
                  Processing time: {analysisResult.processingTimeMs}ms
                </Typography>
              </Alert>

              {/* Editable Fields */}
              <TextField
                label="Item Name"
                value={editedData.name}
                onChange={(e) => setEditedData({...editedData, name: e.target.value})}
                fullWidth
                margin="normal"
                slotProps={{
                  input: {
                    endAdornment: (
                      <Chip 
                        label={`${Math.round(analysisResult.analysis.confidence.itemName * 100)}%`}
                        size="small"
                        color={getConfidenceColor(analysisResult.analysis.confidence.itemName) as any}
                      />
                    )
                  }
                }}
              />

              <TextField
                label="Description"
                value={editedData.description}
                onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                fullWidth
                multiline
                rows={3}
                margin="normal"
              />

              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <TextField
                  label="Make/Brand"
                  value={editedData.make}
                  onChange={(e) => setEditedData({...editedData, make: e.target.value})}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: analysisResult.analysis.extractedText.brandNames.length > 0 && (
                        <Chip 
                          label="AI Detected"
                          size="small"
                          color="info"
                        />
                      )
                    }
                  }}
                />
                <TextField
                  label="Model"
                  value={editedData.model}
                  onChange={(e) => setEditedData({...editedData, model: e.target.value})}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: analysisResult.analysis.extractedText.modelNumbers.length > 0 && (
                        <Chip 
                          label="AI Detected"
                          size="small"
                          color="info"
                        />
                      )
                    }
                  }}
                />
              </Box>

              <FormControl fullWidth margin="normal">
                <InputLabel>Category</InputLabel>
                <Select
                  value={editedData.categoryId}
                  onChange={(e) => setEditedData({...editedData, categoryId: e.target.value})}
                  label="Category"
                >
                  <MenuItem value="">
                    <em>No Category</em>
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                      {category.name.toLowerCase() === analysisResult.analysis!.suggestedCategory.toLowerCase() && (
                        <Chip label="AI Suggested" size="small" sx={{ ml: 1 }} />
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Location</InputLabel>
                <Select
                  value={editedData.locationId}
                  onChange={(e) => setEditedData({...editedData, locationId: e.target.value, roomId: ''})}
                  label="Location"
                >
                  <MenuItem value="">
                    <em>No Location</em>
                  </MenuItem>
                  {locations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Room</InputLabel>
                <Select
                  value={editedData.roomId}
                  onChange={(e) => setEditedData({...editedData, roomId: e.target.value})}
                  label="Room"
                  disabled={!editedData.locationId}
                >
                  <MenuItem value="">
                    <em>No Room</em>
                  </MenuItem>
                  {rooms
                    .filter(room => room.locationId === editedData.locationId)
                    .map((room) => (
                      <MenuItem key={room.id} value={room.id}>
                        {room.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Owner</InputLabel>
                <Select
                  value={editedData.ownerId}
                  onChange={(e) => setEditedData({...editedData, ownerId: e.target.value})}
                  label="Owner"
                >
                  <MenuItem value="">
                    <em>No Owner</em>
                  </MenuItem>
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Serial Number"
                value={editedData.serialNumber}
                onChange={(e) => setEditedData({...editedData, serialNumber: e.target.value})}
                fullWidth
                margin="normal"
              />

              <Box sx={{ mt: 2 }}>
                <EnhancedTagInput
                  tags={editedData.tags}
                  onTagsChange={(tags) => setEditedData({...editedData, tags})}
                  label="Tags"
                  placeholder="Add tags to categorize this item..."
                  enableApiSuggestions={true}
                  size="small"
                  maxTags={20}
                />
              </Box>

              <TextField
                label="Notes"
                value={editedData.notes}
                onChange={(e) => setEditedData({...editedData, notes: e.target.value})}
                fullWidth
                multiline
                rows={2}
                margin="normal"
              />

              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <TextField
                  label="Purchase Price"
                  value={editedData.purchasePrice}
                  onChange={(e) => setEditedData({...editedData, purchasePrice: e.target.value})}
                  type="number"
                  slotProps={{ 
                    htmlInput: { step: "0.01", min: "0" }
                  }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Date Purchased"
                  value={editedData.datePurchased}
                  onChange={(e) => setEditedData({...editedData, datePurchased: e.target.value})}
                  type="date"
                  slotProps={{
                    inputLabel: { shrink: true }
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>

              <TextField
                label="Purchased From"
                value={editedData.purchasedFrom}
                onChange={(e) => setEditedData({...editedData, purchasedFrom: e.target.value})}
                fullWidth
                margin="normal"
              />

              <TextField
                label="Warranty Details"
                value={editedData.warrantyDetails}
                onChange={(e) => setEditedData({...editedData, warrantyDetails: e.target.value})}
                fullWidth
                margin="normal"
                multiline
                rows={2}
              />

              {/* Extracted Text Display */}
              {(analysisResult.analysis.extractedText.brandNames.length > 0 ||
                analysisResult.analysis.extractedText.modelNumbers.length > 0) && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Extracted Information:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {analysisResult.analysis.extractedText.brandNames.map((brand, index) => (
                      <Chip key={`brand-${index}`} label={`Brand: ${brand}`} size="small" />
                    ))}
                    {analysisResult.analysis.extractedText.modelNumbers.map((model, index) => (
                      <Chip key={`model-${index}`} label={`Model: ${model}`} size="small" />
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowAnalysisDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateThing} 
            variant="contained"
            disabled={!editedData.name.trim()}
          >
            Create Item
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}