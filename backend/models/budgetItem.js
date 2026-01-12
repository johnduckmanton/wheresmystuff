const { v4: uuidv4 } = require('uuid');

/**
 * Budget item category enumeration
 */
const BudgetCategory = {
  MOVING_COMPANY: 'moving_company',
  TRUCK_RENTAL: 'truck_rental',
  PACKING_SUPPLIES: 'packing_supplies',
  UTILITIES: 'utilities',
  DEPOSITS: 'deposits',
  TRAVEL: 'travel',
  ACCOMMODATION: 'accommodation',
  INSURANCE: 'insurance',
  PERMITS: 'permits',
  REPAIRS: 'repairs',
  FURNITURE: 'furniture',
  MISCELLANEOUS: 'miscellaneous'
};

/**
 * Payment status enumeration
 */
const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled'
};

/**
 * BudgetItem model
 * Represents a budget item or expense in a moving project
 */
class BudgetItem {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.projectId = data.projectId;
    this.description = data.description;
    this.category = data.category || BudgetCategory.MISCELLANEOUS;
    this.estimatedCost = data.estimatedCost || 0;
    this.actualCost = data.actualCost || 0;
    this.currency = data.currency || 'USD';
    this.paymentStatus = data.paymentStatus || PaymentStatus.PENDING;
    this.dueDate = data.dueDate || null;
    this.paidDate = data.paidDate || null;
    this.amountPaid = data.amountPaid || 0;
    this.vendor = data.vendor || '';
    this.notes = data.notes || '';
    this.receipt = data.receipt || null;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate budget item data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.projectId || typeof this.projectId !== 'string') {
      errors.push('Project ID is required and must be a string');
    }

    if (!this.description || typeof this.description !== 'string' || this.description.trim().length === 0) {
      errors.push('Description is required and must be a non-empty string');
    }

    // Field length validations
    if (this.description && this.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    if (this.vendor && typeof this.vendor !== 'string') {
      errors.push('Vendor must be a string');
    }

    if (this.vendor && this.vendor.length > 200) {
      errors.push('Vendor must be 200 characters or less');
    }

    if (this.notes && typeof this.notes !== 'string') {
      errors.push('Notes must be a string');
    }

    if (this.notes && this.notes.length > 1000) {
      errors.push('Notes must be 1000 characters or less');
    }

    // Enum validations
    if (this.category && !Object.values(BudgetCategory).includes(this.category)) {
      errors.push(`Category must be one of: ${Object.values(BudgetCategory).join(', ')}`);
    }

    if (this.paymentStatus && !Object.values(PaymentStatus).includes(this.paymentStatus)) {
      errors.push(`Payment status must be one of: ${Object.values(PaymentStatus).join(', ')}`);
    }

    // Numeric validations
    if (typeof this.estimatedCost !== 'number' || this.estimatedCost < 0) {
      errors.push('Estimated cost must be a non-negative number');
    }

    if (typeof this.actualCost !== 'number' || this.actualCost < 0) {
      errors.push('Actual cost must be a non-negative number');
    }

    if (typeof this.amountPaid !== 'number' || this.amountPaid < 0) {
      errors.push('Amount paid must be a non-negative number');
    }

    // Amount paid validation
    if (this.amountPaid > this.actualCost && this.actualCost > 0) {
      errors.push('Amount paid cannot exceed actual cost');
    }

    // Date validation
    if (this.dueDate && !this._isValidISODate(this.dueDate)) {
      errors.push('Due date must be a valid ISO date string');
    }

    if (this.paidDate && !this._isValidISODate(this.paidDate)) {
      errors.push('Paid date must be a valid ISO date string');
    }

    // Payment status logic validation
    if (this.paymentStatus === PaymentStatus.PAID && this.amountPaid !== this.actualCost) {
      errors.push('Amount paid must equal actual cost when status is paid');
    }

    if (this.paymentStatus === PaymentStatus.PAID && !this.paidDate) {
      errors.push('Paid date is required when payment status is paid');
    }

    // Array validation
    if (!Array.isArray(this.tags)) {
      errors.push('Tags must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark item as paid
   * @param {number} amount - Amount paid
   * @returns {object} Update result with success and errors
   */
  markAsPaid(amount) {
    if (this.paymentStatus === PaymentStatus.PAID) {
      return { success: false, errors: ['Item is already paid'] };
    }

    if (amount < 0) {
      return { success: false, errors: ['Amount must be non-negative'] };
    }

    if (amount > this.actualCost) {
      return { success: false, errors: ['Amount cannot exceed actual cost'] };
    }

    this.amountPaid = amount;
    this.paidDate = new Date().toISOString();

    if (amount === this.actualCost) {
      this.paymentStatus = PaymentStatus.PAID;
    } else if (amount > 0) {
      this.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Mark item as unpaid
   * @returns {object} Update result with success and errors
   */
  markAsUnpaid() {
    if (this.paymentStatus === PaymentStatus.PENDING) {
      return { success: false, errors: ['Item is already pending'] };
    }

    this.amountPaid = 0;
    this.paidDate = null;
    this.paymentStatus = PaymentStatus.PENDING;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Check if item is overdue
   * @returns {boolean} True if item is overdue and not paid
   */
  isOverdue() {
    if (this.paymentStatus === PaymentStatus.PAID || !this.dueDate) {
      return false;
    }

    const dueTime = new Date(this.dueDate).getTime();
    const nowTime = new Date().getTime();

    return dueTime < nowTime;
  }

  /**
   * Get remaining balance
   * @returns {number} Remaining balance to pay
   */
  getRemainingBalance() {
    return Math.max(0, this.actualCost - this.amountPaid);
  }

  /**
   * Get payment percentage
   * @returns {number} Payment percentage (0-100)
   */
  getPaymentPercentage() {
    if (this.actualCost === 0) {
      return 0;
    }

    return Math.round((this.amountPaid / this.actualCost) * 100);
  }

  /**
   * Get variance (difference between estimated and actual)
   * @returns {number} Variance amount
   */
  getVariance() {
    return this.actualCost - this.estimatedCost;
  }

  /**
   * Check if a date string is a valid ISO date
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid ISO date
   * @private
   */
  _isValidISODate(dateString) {
    if (typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
  }

  /**
   * Convert to DynamoDB item format
   * @returns {object} DynamoDB item
   */
  toDynamoDBItem() {
    const item = {
      pk: `PROJECT#${this.projectId}#BUDGET`,
      sk: this.id,
      gsi1pk: `PROJECT#${this.projectId}`,
      gsi1sk: `BUDGET#${this.category}#${this.paymentStatus}`,
      id: this.id,
      projectId: this.projectId,
      description: this.description,
      category: this.category,
      estimatedCost: this.estimatedCost,
      actualCost: this.actualCost,
      currency: this.currency,
      paymentStatus: this.paymentStatus,
      dueDate: this.dueDate,
      paidDate: this.paidDate,
      amountPaid: this.amountPaid,
      vendor: this.vendor,
      notes: this.notes,
      receipt: this.receipt,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isOverdue: this.isOverdue(),
      remainingBalance: this.getRemainingBalance(),
      paymentPercentage: this.getPaymentPercentage(),
      variance: this.getVariance()
    };

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {BudgetItem} BudgetItem instance
   */
  static fromDynamoDBItem(item) {
    return new BudgetItem({
      id: item.id,
      projectId: item.projectId,
      description: item.description,
      category: item.category,
      estimatedCost: item.estimatedCost,
      actualCost: item.actualCost,
      currency: item.currency,
      paymentStatus: item.paymentStatus,
      dueDate: item.dueDate,
      paidDate: item.paidDate,
      amountPaid: item.amountPaid,
      vendor: item.vendor,
      notes: item.notes,
      receipt: item.receipt,
      tags: item.tags,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Update budget item data
   * @param {object} updates - Fields to update
   */
  update(updates) {
    const allowedUpdates = ['description', 'category', 'estimatedCost', 'actualCost', 'currency', 'dueDate', 'vendor', 'notes', 'receipt', 'tags'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

module.exports = {
  BudgetItem,
  BudgetCategory,
  PaymentStatus
};
