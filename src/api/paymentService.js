import api from './axios';
import { convertBrowserFileToWebP, validateReceiptImage } from '../lib/imageOptimization';

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: '💵', description: 'Physical cash at table or counter' },
  { id: 'telebirr', label: 'Telebirr', icon: '📱', description: 'Telebirr mobile transfer / USSD' },
  { id: 'cbe', label: 'CBE', fullName: 'Commercial Bank of Ethiopia', icon: '🏦', description: 'Commercial Bank of Ethiopia' },
  { id: 'other', label: 'Other', icon: '🧾', description: 'Other bank transfer or custom methods' },
];

/**
 * Maps backend error codes to user-friendly messages
 */
function mapPaymentErrorMessage(err) {
  const status = err.response?.status;
  const errorCode = err.response?.data?.errorCode || err.response?.data?.code;
  const serverMsg = err.response?.data?.message || err.response?.data?.error;

  if (status === 400) {
    if (errorCode === 'ORDER_PAYMENT_NOT_ALLOWED') {
      return 'Cannot pay for a cancelled or invalid order.';
    }
    if (errorCode === 'INVALID_PAYMENT_METHOD') {
      return 'Invalid payment method selected. Please choose Telebirr, Cash, CBE, or Other.';
    }
    if (errorCode === 'PAYMENT_PROOF_UPLOAD_FAILED') {
      return 'Please select a valid receipt image under 10MB.';
    }
  }

  if (status === 403 || errorCode === 'ORDER_PAYMENT_PERMISSION_DENIED') {
    return 'You do not have permission to process order payments.';
  }

  if (status === 409 || errorCode === 'ORDER_ALREADY_PAID') {
    return 'This order is already marked as paid.';
  }

  return serverMsg || 'Payment recording failed. Please try again.';
}

/**
 * Submits an order payment settlement.
 * Automatically compresses raw receipt images to WebP (quality 80, max 1600px)
 * and uploads via multipart/form-data.
 *
 * @param {string} orderId - ID of the order to settle
 * @param {Object} options
 * @param {string} options.method - 'telebirr' | 'cash' | 'card' | 'other' (default: 'cash')
 * @param {File|Blob} [options.file] - Raw image file from camera or file input
 * @param {string} [options.proofUrl] - Optional pre-hosted proof URL if no file
 * @param {Function} [options.onProgress] - Optional upload progress callback
 * @returns {Promise<{ success: boolean, order: Object, message: string }>}
 */
export async function submitOrderPayment(orderId, {
  method = 'cash',
  file = null,
  proofUrl = null,
  onProgress = null,
} = {}) {
  if (!orderId) {
    throw new Error('Order ID is required to process payment.');
  }

  try {
    let response;

    if (file) {
      // 1. Validate file
      const validation = validateReceiptImage(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Compress and convert to WebP before upload
      const webpFile = await convertBrowserFileToWebP(file, 1600, 0.8);

      // 3. Assemble FormData - do NOT set Content-Type manually!
      const formData = new FormData();
      formData.append('method', method);
      formData.append('proof', webpFile, 'receipt.webp');

      response = await api.post(`/api/employee/orders/${orderId}/pay`, formData, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      });
    } else if (proofUrl) {
      // JSON payload with hosted URL
      response = await api.post(`/api/employee/orders/${orderId}/pay`, {
        method,
        proofUrl,
      });
    } else {
      // Standard settlement without photo proof
      const formData = new FormData();
      formData.append('method', method);
      response = await api.post(`/api/employee/orders/${orderId}/pay`, formData);
    }

    const data = response.data;
    const updatedOrder = data?.data?.order || data?.order || data?.data;

    return {
      success: true,
      message: data?.message || 'Payment recorded successfully.',
      order: updatedOrder,
    };
  } catch (err) {
    const errorMsg = mapPaymentErrorMessage(err);
    const customError = new Error(errorMsg);
    customError.status = err.response?.status;
    customError.errorCode = err.response?.data?.errorCode;
    throw customError;
  }
}

/**
 * Dedicated Restaurant Order History API
 * GET /api/restaurants/:restaurantId/orders/history
 *
 * @param {string} restaurantId
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {'all'|'completed'|'cancelled'} [params.status='all']
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {Promise<{ orders: Array, pagination: Object }>}
 */
export async function fetchRestaurantOrderHistory(restaurantId, {
  page = 1,
  limit = 20,
  status = 'all',
  startDate = null,
  endDate = null,
} = {}) {
  const queryParams = { page, limit, status };
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;

  try {
    let res;
    if (restaurantId) {
      res = await api.get(`/api/restaurants/${restaurantId}/orders/history`, { params: queryParams });
    } else {
      // Fallback if restaurantId not yet available
      res = await api.get('/api/employee/orders', { params: { status: 'history' } });
    }

    if (res.data?.success) {
      const orders = res.data.data?.orders || [];
      const pagination = res.data.data?.pagination || {
        total: orders.length,
        page,
        limit,
        pages: Math.ceil(orders.length / limit) || 1,
      };
      return { orders, pagination };
    }
    return { orders: [], pagination: { total: 0, page: 1, limit: 20, pages: 1 } };
  } catch (err) {
    console.error('Failed to fetch restaurant order history:', err);
    throw err;
  }
}
