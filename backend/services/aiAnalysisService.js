const { generateDownloadUrl } = require('./s3');

/**
 * AI Analysis Service - Prototype Implementation
 * Uses OpenAI GPT-4 Vision for photo analysis
 */
class AIAnalysisService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = 'https://api.openai.com/v1';
  }

  /**
   * Analyze a photo and return item suggestions
   * @param {string} photoKey - S3 key for the photo
   * @param {string} inventoryId - Inventory ID for context
   * @param {Array} existingCategories - Existing categories to suggest from
   * @returns {Promise<Object>} Analysis results
   */
  async analyzePhoto(photoKey, inventoryId, existingCategories = []) {
    const startTime = Date.now();
    
    try {
      // Generate a temporary download URL for the photo
      const photoUrl = await generateDownloadUrl(photoKey, true);
      
      // Build the analysis prompt
      const prompt = this.buildAnalysisPrompt(existingCategories);
      
      // Call OpenAI GPT-4 Vision API
      const analysis = await this.callOpenAIVision(photoUrl, prompt);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        analysis: {
          ...analysis,
          confidence: this.calculateConfidence(analysis)
        },
        processingTimeMs: processingTime
      };
    } catch (error) {
      console.error('AI Analysis failed:', error);
      
      return {
        success: false,
        error: error.message || 'AI analysis failed',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Build the analysis prompt for the AI
   * @param {Array} existingCategories - Categories to suggest from
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(existingCategories) {
    const categoryList = existingCategories.length > 0 
      ? existingCategories.map(c => c.name).join(', ')
      : 'Electronics, Furniture, Kitchen, Clothing, Books, Tools, Sports, Toys, Appliances, Decorative';

    return `You are an AI assistant that analyzes photos of household items for inventory management. Analyze this photo and return ONLY a valid JSON object with the following structure:

{
  "itemName": "A concise, specific name for the item",
  "description": "A 2-3 sentence description including color, condition, and notable features",
  "suggestedCategory": "Choose from: ${categoryList}",
  "extractedText": {
    "brandNames": ["array of brand names visible in the photo"],
    "modelNumbers": ["array of model numbers visible"],
    "serialNumbers": ["array of serial numbers visible"],
    "otherText": ["array of other relevant text visible"]
  },
  "estimatedValue": 0
}

IMPORTANT: 
- Respond ONLY with valid JSON
- Do not include markdown code blocks
- Do not include any explanatory text
- Ensure all string values are properly quoted
- Use null for missing estimatedValue

Example for wireless headphones:
{
  "itemName": "Black Wireless Headphones",
  "description": "Over-ear wireless headphones in black color with adjustable headband and cushioned ear cups. Appears to be in good condition with minimal wear.",
  "suggestedCategory": "Electronics",
  "extractedText": {
    "brandNames": ["Sony"],
    "modelNumbers": ["WH-1000XM4"],
    "serialNumbers": [],
    "otherText": ["Wireless", "Bluetooth"]
  },
  "estimatedValue": 200
}`;
  }

  /**
   * Call OpenAI GPT-4 Vision API
   * @param {string} imageUrl - URL to the image
   * @param {string} prompt - Analysis prompt
   * @returns {Promise<Object>} Parsed analysis results
   */
  async callOpenAIVision(imageUrl, prompt) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: imageUrl,
                detail: 'high'
              } 
            }
          ]
        }],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    try {
      // Clean the response content to extract JSON
      let cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to extract JSON from the response if it contains other text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      // Parse the JSON response
      const analysis = JSON.parse(cleanedContent);
      return this.validateAndCleanAnalysis(analysis);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      console.error('Parse error:', parseError.message);
      
      // Fallback: return a basic analysis if JSON parsing fails
      return this.createFallbackAnalysis(content);
    }
  }

  /**
   * Create a fallback analysis when JSON parsing fails
   * @param {string} content - Raw content from AI
   * @returns {Object} Fallback analysis
   */
  createFallbackAnalysis(content) {
    // Extract basic information from the text response
    const lines = content.split('\n').filter(line => line.trim());
    
    return {
      itemName: 'Item from Photo',
      description: lines.length > 0 ? lines[0].substring(0, 200) : 'Item identified from uploaded photo',
      suggestedCategory: 'Miscellaneous',
      extractedText: {
        brandNames: [],
        modelNumbers: [],
        serialNumbers: [],
        otherText: []
      },
      estimatedValue: null
    };
  }

  /**
   * Validate and clean the analysis response
   * @param {Object} analysis - Raw analysis from AI
   * @returns {Object} Cleaned analysis
   */
  validateAndCleanAnalysis(analysis) {
    return {
      itemName: analysis.itemName || 'Unknown Item',
      description: analysis.description || 'No description available',
      suggestedCategory: analysis.suggestedCategory || 'Miscellaneous',
      extractedText: {
        brandNames: analysis.extractedText?.brandNames || [],
        modelNumbers: analysis.extractedText?.modelNumbers || [],
        serialNumbers: analysis.extractedText?.serialNumbers || [],
        otherText: analysis.extractedText?.otherText || []
      },
      estimatedValue: analysis.estimatedValue || null
    };
  }

  /**
   * Calculate confidence scores for the analysis
   * @param {Object} analysis - Analysis results
   * @returns {Object} Confidence scores
   */
  calculateConfidence(analysis) {
    // Simple confidence calculation based on content quality
    let itemNameConfidence = 0.7;
    let descriptionConfidence = 0.7;
    let categoryConfidence = 0.7;

    // Higher confidence for more specific names
    if (analysis.itemName && analysis.itemName.length > 10) {
      itemNameConfidence = 0.85;
    }

    // Higher confidence for detailed descriptions
    if (analysis.description && analysis.description.length > 50) {
      descriptionConfidence = 0.85;
    }

    // Higher confidence if brand/model info is found
    if (analysis.extractedText?.brandNames?.length > 0) {
      itemNameConfidence = Math.min(0.95, itemNameConfidence + 0.1);
      categoryConfidence = Math.min(0.9, categoryConfidence + 0.1);
    }

    const overall = (itemNameConfidence + descriptionConfidence + categoryConfidence) / 3;

    return {
      overall: Math.round(overall * 100) / 100,
      itemName: Math.round(itemNameConfidence * 100) / 100,
      description: Math.round(descriptionConfidence * 100) / 100,
      category: Math.round(categoryConfidence * 100) / 100
    };
  }

  /**
   * Test the AI service with a mock analysis (for development)
   * @param {string} photoKey - Photo key
   * @returns {Promise<Object>} Mock analysis results
   */
  async mockAnalyze(photoKey) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate different mock results based on photo key hash
    const mockItems = [
      {
        itemName: 'Wireless Bluetooth Headphones',
        description: 'Black over-ear wireless headphones with adjustable headband and cushioned ear cups. Appears to be in excellent condition with minimal wear signs.',
        suggestedCategory: 'Electronics',
        extractedText: {
          brandNames: ['Sony'],
          modelNumbers: ['WH-1000XM4'],
          serialNumbers: ['SN123456789'],
          otherText: ['Wireless', 'Bluetooth', 'Noise Canceling']
        },
        estimatedValue: 250
      },
      {
        itemName: 'Ceramic Coffee Mug',
        description: 'White ceramic coffee mug with blue handle and rim. Features a simple, clean design and appears to be in good condition with no visible chips or cracks.',
        suggestedCategory: 'Kitchen',
        extractedText: {
          brandNames: ['IKEA'],
          modelNumbers: [],
          serialNumbers: [],
          otherText: ['Dishwasher Safe', '12oz']
        },
        estimatedValue: 8
      },
      {
        itemName: 'Hardcover Novel Book',
        description: 'Hardcover fiction book with dust jacket. The book appears to be in good condition with minimal shelf wear and clean pages.',
        suggestedCategory: 'Books',
        extractedText: {
          brandNames: ['Penguin Random House'],
          modelNumbers: [],
          serialNumbers: ['ISBN-978-0123456789'],
          otherText: ['First Edition', 'Bestseller']
        },
        estimatedValue: 15
      },
      {
        itemName: 'Stainless Steel Kitchen Knife',
        description: 'Professional chef\'s knife with stainless steel blade and black handle. The blade appears sharp and well-maintained with no visible damage.',
        suggestedCategory: 'Kitchen',
        extractedText: {
          brandNames: ['Wusthof'],
          modelNumbers: ['Classic 8-inch'],
          serialNumbers: [],
          otherText: ['Germany', 'Stainless Steel']
        },
        estimatedValue: 120
      },
      {
        itemName: 'Wooden Picture Frame',
        description: 'Natural wood picture frame with glass front. Features a simple rectangular design and appears to be in excellent condition.',
        suggestedCategory: 'Decorative',
        extractedText: {
          brandNames: [],
          modelNumbers: [],
          serialNumbers: [],
          otherText: ['8x10', 'Made in USA']
        },
        estimatedValue: 25
      },
      {
        itemName: 'LED Desk Lamp',
        description: 'Adjustable LED desk lamp with flexible neck and touch controls. Features multiple brightness settings and appears to be in working condition.',
        suggestedCategory: 'Electronics',
        extractedText: {
          brandNames: ['Philips'],
          modelNumbers: ['LED-DL200'],
          serialNumbers: ['SN987654321'],
          otherText: ['LED', 'Touch Control', 'USB Powered']
        },
        estimatedValue: 45
      }
    ];

    // Use photo key to deterministically select a mock item
    const hash = photoKey.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const itemIndex = Math.abs(hash) % mockItems.length;
    const selectedItem = mockItems[itemIndex];

    // Add some randomness to confidence scores based on photo key
    const confidenceVariation = (Math.abs(hash) % 20) / 100; // 0-0.19 variation
    const baseConfidence = 0.75 + confidenceVariation;

    return {
      success: true,
      analysis: {
        ...selectedItem,
        confidence: {
          overall: Math.round((baseConfidence + 0.1) * 100) / 100,
          itemName: Math.round((baseConfidence + 0.15) * 100) / 100,
          description: Math.round((baseConfidence + 0.05) * 100) / 100,
          category: Math.round((baseConfidence + 0.1) * 100) / 100
        }
      },
      processingTimeMs: 2000
    };
  }
}

module.exports = new AIAnalysisService();