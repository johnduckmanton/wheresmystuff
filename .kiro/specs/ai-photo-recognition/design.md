# AI Photo Recognition Design Document

## Overview

This feature adds AI-powered photo analysis to automatically identify items from uploaded photos and create Thing records with suggested metadata. The system integrates with existing photo upload infrastructure and extends the Thing creation workflow.

## Architecture

### High-Level Flow
1. User uploads photo via enhanced photo upload component
2. Photo is stored in S3 and analyzed by AI service
3. AI returns structured item data (name, description, category, extracted text)
4. User reviews and edits AI suggestions in a dialog
5. System creates Thing record with AI-suggested data and attached photo

### Components

#### Backend Components
- **AIAnalysisService**: Core AI analysis logic using vision models
- **AIAnalysisHandler**: Lambda function for `/ai/analyze-photo` endpoint
- **Enhanced ThingsHandler**: Extended to support AI-assisted creation
- **Enhanced PhotoHandler**: Integration with AI analysis workflow

#### Frontend Components
- **AIPhotoUpload**: Camera capture + file upload with AI analysis
- **AIAnalysisDialog**: Review and edit AI suggestions
- **Enhanced ThingFormDialog**: Pre-populated from AI analysis

## Data Models

### AI Analysis Request
```typescript
interface AIAnalysisRequest {
  photoKey: string;
  inventoryId: string;
  existingCategories?: Category[];
  analysisOptions?: {
    includeTextExtraction: boolean;
    suggestCategory: boolean;
    confidenceThreshold: number;
  };
}
```

### AI Analysis Response
```typescript
interface AIAnalysisResponse {
  success: boolean;
  analysis?: {
    itemName: string;
    description: string;
    suggestedCategory?: {
      name: string;
      isExisting: boolean;
      existingCategoryId?: string;
    };
    extractedText?: {
      serialNumbers: string[];
      modelNumbers: string[];
      brandNames: string[];
      otherText: string[];
    };
    confidence: {
      overall: number;
      itemName: number;
      description: number;
      category: number;
    };
  };
  error?: string;
  processingTimeMs: number;
}
```

### Enhanced Thing Creation
```typescript
interface AIAssistedThingCreation {
  aiAnalysis?: AIAnalysisResponse;
  userModifications?: Partial<Thing>;
  photoKey: string;
  inventoryId: string;
}
```

## AI Analysis Service Implementation

### Vision Model Integration Options

#### Option 1: OpenAI GPT-4 Vision (Recommended)
```javascript
class OpenAIVisionAnalyzer {
  async analyzePhoto(imageUrl, existingCategories = []) {
    const prompt = this.buildAnalysisPrompt(existingCategories);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }],
      max_tokens: 500
    });
    
    return this.parseAnalysisResponse(response);
  }
  
  buildAnalysisPrompt(existingCategories) {
    return `Analyze this photo of a household item and provide:
    1. Item name (concise, specific)
    2. Description (2-3 sentences)
    3. Category suggestion from: ${existingCategories.map(c => c.name).join(', ')}
    4. Any visible text (serial numbers, model numbers, brands)
    
    Respond in JSON format: {
      "itemName": "...",
      "description": "...",
      "suggestedCategory": "...",
      "extractedText": {...},
      "confidence": {...}
    }`;
  }
}
```

#### Option 2: AWS Bedrock Claude 3
```javascript
class ClaudeVisionAnalyzer {
  async analyzePhoto(imageBase64, existingCategories = []) {
    const prompt = this.buildAnalysisPrompt(existingCategories);
    
    const response = await bedrock.invokeModel({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image", 
              source: { 
                type: "base64", 
                media_type: "image/jpeg", 
                data: imageBase64 
              } 
            }
          ]
        }]
      })
    });
    
    return this.parseAnalysisResponse(response);
  }
}
```

### Text Extraction Enhancement
```javascript
class TextExtractionService {
  async extractText(photoKey) {
    const rekognition = new AWS.Rekognition();
    
    const result = await rekognition.detectText({
      Image: {
        S3Object: {
          Bucket: process.env.PHOTOS_BUCKET,
          Name: photoKey
        }
      }
    }).promise();
    
    return this.categorizeExtractedText(result.TextDetections);
  }
  
  categorizeExtractedText(textDetections) {
    const serialNumbers = [];
    const modelNumbers = [];
    const brandNames = [];
    const otherText = [];
    
    textDetections.forEach(detection => {
      const text = detection.DetectedText;
      
      if (this.isSerialNumber(text)) {
        serialNumbers.push(text);
      } else if (this.isModelNumber(text)) {
        modelNumbers.push(text);
      } else if (this.isBrandName(text)) {
        brandNames.push(text);
      } else {
        otherText.push(text);
      }
    });
    
    return { serialNumbers, modelNumbers, brandNames, otherText };
  }
}
```

## API Endpoints

### POST /ai/analyze-photo
Analyzes an uploaded photo and returns item suggestions.

**Request:**
```json
{
  "photoKey": "photos/user123/inv456/entity789/photo.jpg",
  "inventoryId": "uuid",
  "analysisOptions": {
    "includeTextExtraction": true,
    "suggestCategory": true,
    "confidenceThreshold": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "itemName": "Wireless Bluetooth Headphones",
    "description": "Black over-ear wireless headphones with adjustable headband and cushioned ear cups. Appears to be in good condition.",
    "suggestedCategory": {
      "name": "Electronics",
      "isExisting": true,
      "existingCategoryId": "cat-123"
    },
    "extractedText": {
      "serialNumbers": ["SN123456789"],
      "modelNumbers": ["WH-1000XM4"],
      "brandNames": ["Sony"],
      "otherText": ["Wireless", "Bluetooth"]
    },
    "confidence": {
      "overall": 0.85,
      "itemName": 0.9,
      "description": 0.8,
      "category": 0.85
    }
  },
  "processingTimeMs": 2340
}
```

### POST /things/create-from-ai
Creates a Thing record from AI analysis results.

**Request:**
```json
{
  "aiAnalysis": { /* AI analysis response */ },
  "userModifications": {
    "name": "Sony WH-1000XM4 Headphones",
    "serialNumber": "SN123456789"
  },
  "photoKey": "photos/user123/inv456/entity789/photo.jpg",
  "inventoryId": "uuid"
}
```

## Frontend Implementation

### AI Photo Upload Component
```typescript
interface AIPhotoUploadProps {
  inventoryId: string;
  onAnalysisComplete: (analysis: AIAnalysisResponse, photoKey: string) => void;
  onError: (error: string) => void;
}

export function AIPhotoUpload({ inventoryId, onAnalysisComplete, onError }: AIPhotoUploadProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handlePhotoCapture = async (file: File) => {
    try {
      setIsAnalyzing(true);
      
      // Upload photo
      const photoKey = await uploadPhoto(file, inventoryId);
      setUploadProgress(100);
      
      // Analyze with AI
      const analysis = await analyzePhoto(photoKey, inventoryId);
      
      onAnalysisComplete(analysis, photoKey);
    } catch (error) {
      onError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <Box>
      <CameraCapture onCapture={handlePhotoCapture} />
      <FileUpload onUpload={handlePhotoCapture} />
      {isAnalyzing && <AnalysisProgress progress={uploadProgress} />}
    </Box>
  );
}
```

### AI Analysis Review Dialog
```typescript
interface AIAnalysisDialogProps {
  open: boolean;
  analysis: AIAnalysisResponse;
  photoKey: string;
  existingCategories: Category[];
  onConfirm: (thingData: Partial<Thing>) => void;
  onCancel: () => void;
}

export function AIAnalysisDialog({ 
  open, 
  analysis, 
  photoKey, 
  existingCategories,
  onConfirm, 
  onCancel 
}: AIAnalysisDialogProps) {
  const [editedData, setEditedData] = useState({
    name: analysis.analysis?.itemName || '',
    description: analysis.analysis?.description || '',
    categoryId: analysis.analysis?.suggestedCategory?.existingCategoryId || '',
    serialNumber: analysis.analysis?.extractedText?.serialNumbers[0] || ''
  });
  
  return (
    <Dialog open={open} maxWidth="md" fullWidth>
      <DialogTitle>
        AI Analysis Results
        <ConfidenceIndicator confidence={analysis.analysis?.confidence.overall} />
      </DialogTitle>
      
      <DialogContent>
        <PhotoPreview photoKey={photoKey} />
        
        <TextField
          label="Item Name"
          value={editedData.name}
          onChange={(e) => setEditedData({...editedData, name: e.target.value})}
          fullWidth
          margin="normal"
          InputProps={{
            endAdornment: <ConfidenceChip confidence={analysis.analysis?.confidence.itemName} />
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
        
        <CategorySelector
          categories={existingCategories}
          selectedId={editedData.categoryId}
          onSelect={(id) => setEditedData({...editedData, categoryId: id})}
          suggestedCategory={analysis.analysis?.suggestedCategory}
        />
        
        <ExtractedTextSection extractedText={analysis.analysis?.extractedText} />
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(editedData)} variant="contained">
          Create Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## Error Handling

### AI Service Failures
- **Network timeouts**: Graceful fallback to manual creation
- **API rate limits**: Queue requests with user notification
- **Low confidence results**: Present as suggestions with warnings
- **Service unavailable**: Disable AI features temporarily

### Photo Processing Errors
- **Unsupported formats**: Convert or reject with clear messaging
- **File size limits**: Resize automatically or prompt user
- **Corrupted images**: Validate and provide error feedback

## Testing Strategy

### Unit Tests
- AI service response parsing
- Confidence score calculations
- Text extraction categorization
- Error handling scenarios

### Integration Tests
- End-to-end photo upload and analysis
- Thing creation from AI results
- Category matching logic
- User modification workflows

### Property-Based Tests
- **Property 1**: AI analysis round-trip consistency
- **Property 2**: Category suggestion accuracy
- **Property 3**: Text extraction completeness

## Performance Considerations

### Optimization Strategies
- **Image preprocessing**: Resize images to optimal dimensions for AI analysis
- **Caching**: Cache analysis results for identical images
- **Batch processing**: Process multiple photos in parallel
- **Progressive enhancement**: Show results as they become available

### Monitoring
- **Response times**: Track AI service performance
- **Accuracy metrics**: Monitor user acceptance rates
- **Cost tracking**: Monitor per-user and total usage costs
- **Error rates**: Track and alert on service failures

## Security Considerations

### Data Privacy
- **Image data**: Ensure images are not stored by AI providers
- **Analysis results**: Encrypt sensitive extracted text
- **User consent**: Clear disclosure of AI processing

### Access Control
- **Photo access**: Maintain existing inventory-based permissions
- **AI features**: Optional per-inventory or per-user basis
- **Cost controls**: Usage limits and monitoring

## Deployment Strategy

### Phase 1: Core AI Analysis (Week 1-2)
- Implement AIAnalysisService with GPT-4 Vision
- Add `/ai/analyze-photo` endpoint
- Basic text extraction with AWS Rekognition

### Phase 2: Frontend Integration (Week 2-3)
- AI photo upload component
- Analysis review dialog
- Enhanced thing creation workflow

### Phase 3: Advanced Features (Week 3-4)
- Category matching improvements
- Confidence-based UI enhancements
- Usage monitoring and cost controls

### Phase 4: Optimization (Week 4-5)
- Performance improvements
- Advanced text extraction
- User feedback integration