import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface CategoryImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (csvData: string) => Promise<{
    message: string;
    imported: number;
    updated: number;
    failed: number;
    errors: string[];
    totalProcessed: number;
  }>;
}

interface ParsedCategory {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export default function CategoryImportDialog({ open, onClose, onImport }: CategoryImportDialogProps) {
  const [csvData, setCsvData] = useState<string>('');
  const [parsedCategories, setParsedCategories] = useState<ParsedCategory[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    message: string;
    imported: number;
    updated: number;
    failed: number;
    errors: string[];
    totalProcessed: number;
  } | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (!importing) {
      setCsvData('');
      setParsedCategories([]);
      setImportResults(null);
      setError('');
      onClose();
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setError('');
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
      parseCSVPreview(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const parseCSVPreview = (content: string) => {
    try {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        setError('CSV must contain at least a header row and one data row');
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['name', 'description', 'color', 'icon'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        setError(`Missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }

      // Parse first few rows for preview
      const categories: ParsedCategory[] = [];
      const previewRows = Math.min(5, lines.length - 1); // Show max 5 rows

      for (let i = 1; i <= previewRows; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parser for quoted fields
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const category: ParsedCategory = {
          name: '',
          description: '',
          color: '',
          icon: ''
        };

        headers.forEach((header, index) => {
          if (values[index] !== undefined && expectedHeaders.includes(header)) {
            category[header as keyof ParsedCategory] = values[index];
          }
        });

        if (category.name) {
          categories.push(category);
        }
      }

      setParsedCategories(categories);
      setError('');
    } catch (err) {
      setError('Failed to parse CSV file');
      console.error('CSV parsing error:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleImport = async () => {
    if (!csvData) {
      setError('No CSV data to import');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const results = await onImport(csvData);
      setImportResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const renderUploadArea = () => (
    <Paper
      sx={{
        p: 4,
        border: '2px dashed',
        borderColor: error ? 'error.main' : 'grey.300',
        backgroundColor: error ? 'error.light' : 'grey.50',
        textAlign: 'center',
        cursor: 'pointer',
        '&:hover': {
          borderColor: error ? 'error.dark' : 'primary.main',
          backgroundColor: error ? 'error.light' : 'primary.light',
        },
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
    >
      <UploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Drop CSV file here or click to browse
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Supported format: CSV with columns: name, description, color, icon
      </Typography>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </Paper>
  );

  const renderPreview = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Preview ({parsedCategories.length} categories shown)
        </Typography>
        <IconButton onClick={() => {
          setCsvData('');
          setParsedCategories([]);
        }}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Icon</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parsedCategories.map((category, index) => (
              <TableRow key={index}>
                <TableCell>{category.name}</TableCell>
                <TableCell sx={{ maxWidth: 200 }}>
                  <Typography variant="body2" noWrap>
                    {category.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: category.color,
                        border: '1px solid #ccc',
                      }}
                    />
                    <Typography variant="body2">{category.color}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{category.icon}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Import behavior:</strong> Categories with matching names will be updated with new data. 
          New categories will be created.
        </Typography>
      </Alert>
    </Box>
  );

  const renderResults = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Import Results
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {importResults!.imported > 0 && (
          <Chip
            icon={<SuccessIcon />}
            label={`${importResults!.imported} New`}
            color="success"
            variant="outlined"
          />
        )}
        {importResults!.updated > 0 && (
          <Chip
            icon={<InfoIcon />}
            label={`${importResults!.updated} Updated`}
            color="info"
            variant="outlined"
          />
        )}
        {importResults!.failed > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${importResults!.failed} Failed`}
            color="error"
            variant="outlined"
          />
        )}
      </Box>

      <Alert severity={importResults!.failed > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
        {importResults!.message}
      </Alert>

      {importResults!.errors.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Errors:
          </Typography>
          <Paper sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
            {importResults!.errors.map((error, index) => (
              <Typography key={index} variant="body2" color="error" sx={{ mb: 0.5 }}>
                {error}
              </Typography>
            ))}
          </Paper>
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 400 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Import Categories from CSV
          <IconButton onClick={handleClose} disabled={importing}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {importing && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Importing categories...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {importResults ? (
          renderResults()
        ) : parsedCategories.length > 0 ? (
          renderPreview()
        ) : (
          renderUploadArea()
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          {importResults ? 'Close' : 'Cancel'}
        </Button>
        
        {parsedCategories.length > 0 && !importResults && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing}
          >
            Import {parsedCategories.length}+ Categories
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}