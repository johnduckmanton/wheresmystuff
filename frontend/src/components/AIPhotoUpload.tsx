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
  Stack,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Category, Thing } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
  onAnalysisComplete: (analysisData: Partial<Thing>, photoKey: string) => void;
}

export default function AIPhotoUpload({ categories, onAnalysisComplete }: AIPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraInputKey, setCameraInputKey] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [photoKey, setPhotoKey] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { showError } = useNotification();
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

  const analyzePhoto = async (photoKey: string) => {
    if (!currentInventory) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      // Create a timeout promise (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout')), 10000);
      });

      // Race between analysis and timeout
      const result: AIAnalysisResult = await Promise.race([
        apiClient.analyzePhoto(photoKey, currentInventory.id),
        timeoutPromise
      ]);

      if (result.success && result.analysis) {
        // Find suggested category
        const suggestedCategory = categories.find(c => 
          c.name.toLowerCase() === result.analysis!.suggestedCategory.toLowerCase()
        );

        // Prepare analysis data to pass directly to parent
        const analysisData: Partial<Thing> = {
          name: result.analysis.itemName || 'Unnamed Item',
          description: result.analysis.description || undefined,
          categoryId: suggestedCategory?.id || undefined,
          make: result.analysis.extractedText.brandNames[0] || undefined,
          model: result.analysis.extractedText.modelNumbers[0] || undefined,
          serialNumber: result.analysis.extractedText.serialNumbers[0] || undefined,
          photos: [photoKey]
        };

        // Immediately call parent with analysis data
        onAnalysisComplete(analysisData, photoKey);
        
        // Reset state
        setPhotoKey('');
      } else {
        handleAIAnalysisError(result.error || 'AI analysis failed');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error && error.message === 'Analysis timeout'
        ? 'AI analysis timed out after 10 seconds'
        : 'AI analysis failed. Please try again.';
      handleAIAnalysisError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAIAnalysisError = (errorMessage: string) => {
    setAnalysisError(errorMessage);
    setShowErrorDialog(true);
  };

  const handleRetryAnalysis = () => {
    setShowErrorDialog(false);
    setAnalysisError(null);
    if (photoKey) {
      analyzePhoto(photoKey);
    }
  };

  const handleSwitchToManualEntry = () => {
    setShowErrorDialog(false);
    setAnalysisError(null);
    // Clear the photo and reset state
    setPhotoKey('');
    showError('Switched to manual entry. Please use the manual entry option from the creation method selector.');
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

      {/* Error Dialog */}
      <Dialog
        open={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AIIcon sx={{ mr: 1, color: 'error.main' }} />
            AI Analysis Error
          </Box>
        </DialogTitle>

        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {analysisError}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            You can retry the analysis or switch to manual entry to create the item without AI assistance.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleSwitchToManualEntry} color="inherit">
            Switch to Manual Entry
          </Button>
          <Button onClick={handleRetryAnalysis} variant="contained" color="primary">
            Retry Analysis
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}