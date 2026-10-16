/**
 * Legacy paymentService re-export bridge for backwards-compatibility.
 * All payment operations now use the canonical DiningCheck service.
 */
export * from './diningCheckService';
import api from './axios';

/**
 * Dedicated Restaurant Order History API (Operational tickets, not payment)
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
