import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiCommerceRepository } from '../api-commerce.repository'

describe('ApiCommerceRepository', () => {
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    http = { get: vi.fn(), post: vi.fn() }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const repo = () => new ApiCommerceRepository(http as never)

  it('normalizes missing currencyCode to USD in getOrders', async () => {
    http.get.mockResolvedValue({
      isSuccess: true,
      data: [
        {
          id: 'order-1',
          orderNumber: 'WO-2026-0001',
          totalAmount: 739832.20,
          currencyCode: null,
          currencySymbol: null,
          status: 'Confirmed',
          items: [],
        },
        {
          id: 'order-2',
          orderNumber: 'WO-2026-0002',
          totalAmount: 12500.00,
          currencyCode: 'EUR',
          currencySymbol: '€',
          status: 'Pending',
          items: [],
        },
      ],
      totalCount: 2,
    })

    const res = await repo().getOrders({ pageNumber: 1, pageSize: 10 })

    expect(res.data).toHaveLength(2)
    expect(res.data[0].currencyCode).toBe('USD')
    expect(res.data[0].currencySymbol).toBe('$')
    expect(res.data[1].currencyCode).toBe('EUR')
    expect(res.data[1].currencySymbol).toBe('€')
  })

  it('normalizes missing currencyCode to USD in getOrderById', async () => {
    http.get.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'WO-2026-0001',
      totalAmount: 739832.20,
      currencyCode: '',
      currencySymbol: '',
      status: 'Confirmed',
      items: [],
    })

    const order = await repo().getOrderById('order-1')

    expect(order.currencyCode).toBe('USD')
    expect(order.currencySymbol).toBe('$')
  })
})
