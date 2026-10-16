import api from './axios';
import { convertBrowserFileToWebP, validateReceiptImage } from '../lib/imageOptimization';

export const PAYMENT_METHODS = [
  {
    id: 'cash',
    label: 'Cash',
    icon: '💵',
    description: 'Physical cash at table or counter',
    shortDesc: 'Cash at table',
  },
  {
    id: 'telebirr',
    label: 'Telebirr',
    icon: '📱',
    iconUrl: 'https://res.cloudinary.com/q1ci20uo/image/upload/v1791359902/telebirr.webp',
    description: 'Telebirr mobile transfer / USSD',
    shortDesc: 'Mobile / USSD',
  },
  {
    id: 'cbe',
    label: 'CBE',
    fullName: 'Commercial Bank of Ethiopia',
    icon: '🏦',
    iconUrl: 'https://res.cloudinary.com/q1ci20uo/image/upload/v1791359902/CBE.webp',
    description: 'Commercial Bank of Ethiopia',
    shortDesc: 'CBE Birr / Mobile',
  },
  {
    id: 'card',
    label: 'Card',
    icon: '💳',
    description: 'POS debit / credit card terminal',
    shortDesc: 'POS Card',
  },
  {
    id: 'other',
    label: 'Other',
    icon: '🧾',
    description: 'Other bank transfer or custom methods',
    shortDesc: 'Bank / Other',
  },
];

/**
 * Format table name safely without producing "Table Table 5"
 */
export function formatTableName(table) {
  if (!table) return 'Table';
  if (typeof table === 'string') {
    const trimmed = table.trim();
    return /^table\b/i.test(trimmed) ? trimmed : `Table ${trimmed}`;
  }
  const name = (table.name || '').trim();
  if (name) {
    return /^table\b/i.test(name) ? name : `Table ${name}`;
  }
  if (table.code) {
    const code = table.code.toString().trim();
    return /^table\b/i.test(code) ? code : `Table ${code}`;
  }
  return 'Table';
}

/**
 * Format currency amount with fallback
 */
export function formatCurrency(amount, currency = 'ETB') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

/**
 * Maps backend dining check error codes to clear, user-friendly messages
 */
export function mapDiningCheckErrorMessage(err) {
  const status = err.response?.status;
  const errorCode = err.response?.data?.errorCode || err.response?.data?.code;
  const serverMsg = err.response?.data?.message || err.response?.data?.error;

  if (status === 400) {
    if (errorCode === 'DINING_CHECK_EMPTY') {
      return 'This bill has no payable orders.';
    }
    if (errorCode === 'INVALID_PAYMENT_METHOD') {
      return 'Invalid payment method selected. Please choose Cash, Telebirr, CBE, Card, or Other.';
    }
    if (errorCode === 'PAYMENT_PROOF_UPLOAD_FAILED') {
      return 'Please select a valid receipt image under 10MB.';
    }
  }

  if (status === 403 || errorCode === 'DINING_CHECK_ACCESS_DENIED') {
    return 'You do not have access to this bill.';
  }

  if (errorCode === 'ORDER_PAYMENT_PERMISSION_DENIED') {
    return 'You do not have permission to process bill payments.';
  }

  if (status === 404 || errorCode === 'DINING_CHECK_NOT_FOUND') {
    return 'Dining check not found.';
  }

  if (status === 409 || errorCode === 'DINING_CHECK_ALREADY_PAID') {
    return 'This bill has already been paid.';
  }

  return serverMsg || 'Payment recording failed. Please try again.';
}

/**
 * Fetches dining checks with optional filters.
 * GET /api/employee/dining-checks
 * Optional params: ?payment=unpaid | ?payment=paid | ?tableId=<id>
 *
 * @param {Object} [params]
 * @param {'unpaid'|'paid'} [params.payment]
 * @param {string} [params.tableId]
 * @returns {Promise<{ checks: Array }>}
 */
export async function fetchDiningChecks({ payment, tableId } = {}) {
  const params = {};
  if (payment) params.payment = payment;
  if (tableId) params.tableId = tableId;

  try {
    const res = await api.get('/api/employee/dining-checks', { params });
    if (res.data?.success) {
      const checks = res.data.data?.checks || res.data.data || res.data.checks || [];
      return { checks: Array.isArray(checks) ? checks : [] };
    }
    const fallbackChecks = res.data?.checks || res.data?.data || [];
    return { checks: Array.isArray(fallbackChecks) ? fallbackChecks : [] };
  } catch (err) {
    console.error('Failed to fetch dining checks:', err);
    throw err;
  }
}

/**
 * Fetches a single dining check with full details.
 * GET /api/employee/dining-checks/:checkId
 *
 * @param {string} checkId
 * @returns {Promise<{ check: Object }>}
 */
export async function fetchDiningCheck(checkId) {
  if (!checkId) {
    throw new Error('DiningCheck ID is required.');
  }

  try {
    const res = await api.get(`/api/employee/dining-checks/${checkId}`);
    const check = res.data?.data?.check || res.data?.data || res.data?.check;
    return { check };
  } catch (err) {
    console.error(`Failed to fetch dining check ${checkId}:`, err);
    throw err;
  }
}

/**
 * Submits payment settlement for a dining check.
 * PATCH /api/employee/dining-checks/:checkId/payment
 *
 * @param {string} checkId
 * @param {Object} options
 * @param {'cash'|'telebirr'|'cbe'|'card'|'other'} [options.method='cash']
 * @param {File|Blob} [options.file] - Raw image file from camera or file picker
 * @param {string} [options.proofUrl] - Optional pre-hosted proof URL
 * @param {Function} [options.onProgress] - Upload progress callback (0-100)
 * @returns {Promise<{ success: boolean, check: Object, message: string }>}
 */
export async function submitDiningCheckPayment(checkId, {
  method = 'cash',
  file = null,
  proofUrl = null,
  onProgress = null,
} = {}) {
  if (!checkId) {
    throw new Error('DiningCheck ID is required to process payment.');
  }

  try {
    let response;

    if (file) {
      // 1. Validate file format and size
      const validation = validateReceiptImage(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Browser-side WebP optimization (Max 1600px, quality 0.8)
      const webpFile = await convertBrowserFileToWebP(file, 1600, 0.8);

      // 3. Assemble FormData — DO NOT manually set Content-Type header!
      const formData = new FormData();
      formData.append('method', method);
      formData.append('proof', webpFile, 'receipt.webp');

      response = await api.patch(`/api/employee/dining-checks/${checkId}/payment`, formData, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      });
    } else if (proofUrl) {
      response = await api.patch(`/api/employee/dining-checks/${checkId}/payment`, {
        method,
        proofUrl,
      });
    } else {
      // Standard settlement (Cash / Card without photo attachment)
      response = await api.patch(`/api/employee/dining-checks/${checkId}/payment`, {
        method,
      });
    }

    const data = response.data;
    const updatedCheck = data?.data?.check || data?.check || data?.data;

    return {
      success: true,
      message: data?.message || 'Payment recorded successfully.',
      check: updatedCheck,
    };
  } catch (err) {
    const errorMsg = mapDiningCheckErrorMessage(err);
    const customError = new Error(errorMsg);
    customError.status = err.response?.status;
    customError.errorCode = err.response?.data?.errorCode || err.response?.data?.code;
    throw customError;
  }
}
