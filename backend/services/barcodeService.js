const { generateDownloadUrl } = require('./s3');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({});
const secretsClient = new SecretsManagerClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;
const ENVIRONMENT = process.env.NODE_ENV || 'dev';

// Cache for API key to avoid repeated Secrets Manager calls
let cachedApiKey = null;

/**
 * Barcode Lookup Service
 * Supports ISBN (books) and UPC/EAN (general products)
 */
class BarcodeService {
  constructor() {
    this.upcDatabaseApiKey = null;
  }

  /**
   * Get UPC Database API key from Secrets Manager
   * @returns {Promise<string>} API key
   */
  async getUPCApiKey() {
    // Return cached key if available
    if (cachedApiKey) {
      return cachedApiKey;
    }

    try {
      const secretName = `home-inv-upc-api-key-${ENVIRONMENT}`;
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await secretsClient.send(command);
      
      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString);
        cachedApiKey = secret.apiKey;
        return cachedApiKey;
      }
      
      throw new Error('API key not found in secret');
    } catch (error) {
      console.error('Failed to retrieve UPC API key from Secrets Manager:', error);
      // Return null to allow graceful degradation (ISBN lookups will still work)
      return null;
    }
  }

  /**
   * Determine barcode type based on format
   * @param {string} barcode - Barcode string
   * @returns {string} Barcode type: 'isbn', 'upc', 'ean', or 'unknown'
   */
  detectBarcodeType(barcode) {
    const cleaned = barcode.replace(/[-\s]/g, '');
    
    // ISBN-10 or ISBN-13
    if (/^(978|979)\d{10}$/.test(cleaned) || /^\d{9}[\dX]$/.test(cleaned)) {
      return 'isbn';
    }
    
    // UPC-A (12 digits)
    if (/^\d{12}$/.test(cleaned)) {
      return 'upc';
    }
    
    // EAN-13 (13 digits)
    if (/^\d{13}$/.test(cleaned)) {
      return 'ean';
    }
    
    return 'unknown';
  }

  /**
   * Lookup barcode and return product information
   * @param {string} barcode - Barcode to lookup
   * @returns {Promise<Object>} Product information
   */
  async lookupBarcode(barcode) {
    const barcodeType = this.detectBarcodeType(barcode);
    
    console.log('🔍 Barcode lookup:', { barcode, type: barcodeType });
    
    try {
      switch (barcodeType) {
        case 'isbn':
          return await this.lookupISBN(barcode);
        case 'upc':
        case 'ean':
          return await this.lookupUPC(barcode);
        default:
          // Try both APIs as fallback
          try {
            return await this.lookupISBN(barcode);
          } catch (isbnError) {
            return await this.lookupUPC(barcode);
          }
      }
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      throw new Error(`Failed to lookup barcode: ${error.message}`);
    }
  }

  /**
   * Lookup ISBN using Open Library API
   * @param {string} isbn - ISBN number
   * @returns {Promise<Object>} Book information
   */
  async lookupISBN(isbn) {
    const cleaned = isbn.replace(/[-\s]/g, '');
    
    // Try Open Library API first
    const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`;
    
    const response = await fetch(openLibraryUrl);
    
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }
    
    const data = await response.json();
    const bookKey = `ISBN:${cleaned}`;
    
    if (!data[bookKey]) {
      throw new Error('Book not found in Open Library database');
    }
    
    const book = data[bookKey];
    
    // Get the best available cover image
    let coverImageUrl = null;
    if (book.cover) {
      coverImageUrl = book.cover.large || book.cover.medium || book.cover.small;
    }
    
    // Download and store cover image in S3 if available
    let storedImageKey = null;
    if (coverImageUrl) {
      try {
        storedImageKey = await this.downloadAndStoreImage(coverImageUrl, cleaned);
      } catch (imageError) {
        console.error('Failed to store cover image:', imageError);
        // Continue without image
      }
    }
    
    return {
      success: true,
      source: 'openlibrary',
      barcodeType: 'isbn',
      barcode: cleaned,
      data: {
        itemName: book.title || 'Unknown Book',
        description: this.buildBookDescription(book),
        notes: this.buildBookNotes(book),
        suggestedCategory: 'Books',
        brand: book.publishers?.[0]?.name || null,
        manufacturer: book.publishers?.[0]?.name || null,
        model: null,
        imageUrl: coverImageUrl,
        storedImageKey: storedImageKey,
        metadata: {
          authors: book.authors?.map(a => a.name) || [],
          publishDate: book.publish_date || null,
          publisher: book.publishers?.[0]?.name || null,
          pages: book.number_of_pages || null,
          isbn10: book.identifiers?.isbn_10?.[0] || null,
          isbn13: book.identifiers?.isbn_13?.[0] || null,
          subjects: book.subjects?.map(s => s.name).slice(0, 5) || []
        }
      }
    };
  }

  /**
   * Build a description for a book
   * @param {Object} book - Book data from API
   * @returns {string} Formatted description
   */
  buildBookDescription(book) {
    const parts = [];
    
    if (book.authors && book.authors.length > 0) {
      const authorNames = book.authors.map(a => a.name).join(', ');
      parts.push(`by ${authorNames}`);
    }
    
    if (book.publish_date) {
      parts.push(`Published ${book.publish_date}`);
    }
    
    if (book.publishers && book.publishers.length > 0) {
      parts.push(`by ${book.publishers[0].name}`);
    }
    
    if (book.number_of_pages) {
      parts.push(`${book.number_of_pages} pages`);
    }
    
    return parts.join('. ') + '.';
  }

  /**
   * Build notes field with additional metadata for a book
   * @param {Object} book - Book data from API
   * @returns {string} Formatted notes with metadata
   */
  buildBookNotes(book) {
    const notes = [];
    
    if (book.authors && book.authors.length > 0) {
      const authorNames = book.authors.map(a => a.name).join(', ');
      notes.push(`Author(s): ${authorNames}`);
    }
    
    if (book.publishers && book.publishers.length > 0) {
      notes.push(`Publisher: ${book.publishers[0].name}`);
    }
    
    if (book.publish_date) {
      notes.push(`Published: ${book.publish_date}`);
    }
    
    if (book.number_of_pages) {
      notes.push(`Pages: ${book.number_of_pages}`);
    }
    
    if (book.identifiers?.isbn_10?.[0]) {
      notes.push(`ISBN-10: ${book.identifiers.isbn_10[0]}`);
    }
    
    if (book.identifiers?.isbn_13?.[0]) {
      notes.push(`ISBN-13: ${book.identifiers.isbn_13[0]}`);
    }
    
    if (book.subjects && book.subjects.length > 0) {
      const subjects = book.subjects.slice(0, 5).map(s => s.name).join(', ');
      notes.push(`Subjects: ${subjects}`);
    }
    
    return notes.join('\n');
  }

  /**
   * Lookup UPC/EAN using UPC Database API
   * @param {string} upc - UPC or EAN code
   * @returns {Promise<Object>} Product information
   */
  async lookupUPC(upc) {
    const cleaned = upc.replace(/[-\s]/g, '');
    
    // Get API key from Secrets Manager
    const apiKey = await this.getUPCApiKey();
    
    if (!apiKey) {
      throw new Error('UPC Database API key not configured. Please add the secret to AWS Secrets Manager.');
    }
    
    const url = `https://api.upcdatabase.org/product/${cleaned}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`UPC Database API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Product not found in UPC database');
    }
    
    const product = data;
    
    // Download and store product image if available
    let storedImageKey = null;
    if (product.image) {
      try {
        storedImageKey = await this.downloadAndStoreImage(product.image, cleaned);
      } catch (imageError) {
        console.error('Failed to store product image:', imageError);
        // Continue without image
      }
    }
    
    return {
      success: true,
      source: 'upcdatabase',
      barcodeType: this.detectBarcodeType(cleaned),
      barcode: cleaned,
      data: {
        itemName: product.title || 'Unknown Product',
        description: this.buildProductDescription(product),
        notes: this.buildProductNotes(product),
        suggestedCategory: this.mapUPCCategory(product.category),
        brand: product.brand || null,
        manufacturer: product.brand || null,
        model: product.model || null,
        imageUrl: product.image || null,
        storedImageKey: storedImageKey,
        metadata: {
          category: product.category || null,
          upc: product.upc || cleaned,
          ean: product.ean || null,
          description: product.description || null
        }
      }
    };
  }

  /**
   * Build a description for a general product
   * @param {Object} product - Product data from API
   * @returns {string} Formatted description
   */
  buildProductDescription(product) {
    const parts = [];
    
    if (product.brand) {
      parts.push(`${product.brand} product`);
    }
    
    if (product.model) {
      parts.push(`Model: ${product.model}`);
    }
    
    if (product.category) {
      parts.push(`Category: ${product.category}`);
    }
    
    if (product.description) {
      parts.push(product.description);
    }
    
    return parts.join('. ') + (parts.length > 0 ? '.' : 'Product information from barcode scan.');
  }

  /**
   * Build notes field with additional metadata for a product
   * @param {Object} product - Product data from API
   * @returns {string} Formatted notes with metadata
   */
  buildProductNotes(product) {
    const notes = [];
    
    if (product.category) {
      notes.push(`Category: ${product.category}`);
    }
    
    if (product.upc) {
      notes.push(`UPC: ${product.upc}`);
    }
    
    if (product.ean) {
      notes.push(`EAN: ${product.ean}`);
    }
    
    if (product.description) {
      notes.push(`Description: ${product.description}`);
    }
    
    if (product.brand) {
      notes.push(`Brand: ${product.brand}`);
    }
    
    if (product.model) {
      notes.push(`Model: ${product.model}`);
    }
    
    return notes.join('\n');
  }

  /**
   * Map UPC category to inventory category
   * @param {string} upcCategory - Category from UPC database
   * @returns {string} Mapped category
   */
  mapUPCCategory(upcCategory) {
    if (!upcCategory) return 'Miscellaneous';
    
    const categoryMap = {
      'Electronics': 'Electronics',
      'Books': 'Books',
      'Toys': 'Toys',
      'Tools': 'Tools',
      'Sports': 'Sports',
      'Home': 'Furniture',
      'Kitchen': 'Kitchen',
      'Appliances': 'Appliances',
      'Health': 'Miscellaneous',
      'Beauty': 'Miscellaneous',
      'Office': 'Miscellaneous'
    };
    
    // Try to find a match
    for (const [key, value] of Object.entries(categoryMap)) {
      if (upcCategory.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return 'Miscellaneous';
  }

  /**
   * Download an image from URL and store in S3
   * @param {string} imageUrl - URL of the image
   * @param {string} identifier - Barcode or identifier for naming
   * @returns {Promise<string>} S3 key of stored image
   */
  async downloadAndStoreImage(imageUrl, identifier) {
    // Download the image
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Generate S3 key
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const extension = contentType.split('/')[1] || 'jpg';
    const key = `barcode-images/${identifier}/${timestamp}-${uniqueId}.${extension}`;
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      Metadata: {
        source: 'barcode-lookup',
        barcode: identifier,
        originalUrl: imageUrl
      }
    });
    
    await s3Client.send(command);
    
    console.log('✅ Stored barcode image in S3:', key);
    
    return key;
  }

  /**
   * Validate barcode format
   * @param {string} barcode - Barcode to validate
   * @returns {Object} Validation result
   */
  validateBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') {
      return {
        valid: false,
        error: 'Barcode must be a non-empty string'
      };
    }
    
    const cleaned = barcode.replace(/[-\s]/g, '');
    
    if (!/^\d+$/.test(cleaned) && !/^\d{9}[\dX]$/.test(cleaned)) {
      return {
        valid: false,
        error: 'Barcode must contain only digits (or X for ISBN-10)'
      };
    }
    
    if (cleaned.length < 8 || cleaned.length > 13) {
      return {
        valid: false,
        error: 'Barcode must be between 8 and 13 digits'
      };
    }
    
    return {
      valid: true,
      cleaned: cleaned,
      type: this.detectBarcodeType(cleaned)
    };
  }
}

module.exports = new BarcodeService();
