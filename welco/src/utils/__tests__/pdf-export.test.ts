import { describe, it, expect } from 'vitest'
import {
  exportOrderPdf,
  exportOrdersReportPdf,
  exportInvoicePdf,
  exportCompaniesReportPdf,
} from '../pdf-export'
import type { OrderDto } from '../../domain/models/commerce'
import type { CompanyDto } from '../../domain/models/company'

describe('pdf-export utility', () => {
  const sampleOrder: OrderDto = {
    id: 'ord-123',
    orderNumber: 'WL-ORD-9821',
    status: 'Confirmed',
    currencyCode: 'USD',
    totalAmount: 1450.5,
    createdAt: '2026-10-15T10:00:00Z',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productNameEn: 'Mayo Hegar Needle Holder 16cm',
        productNameAr: 'مايو هيغار حامل إبر 16 سم',
        quantity: 5,
        unitPrice: 200,
      },
      {
        id: 'item-2',
        productId: 'prod-2',
        productNameEn: 'Metzenbaum Scissors Curved 14cm',
        productNameAr: 'مقص متزنبوم منحني 14 سم',
        quantity: 3,
        unitPrice: 150.16,
      },
    ],
  }

  const sampleCompanies: CompanyDto[] = [
    {
      id: 'comp-1',
      name: 'Apex Surgical Distribution',
      email: 'procure@apexsurgical.com',
      phone: '+44 20 7946 0912',
      country: 'United Kingdom',
      city: 'London',
      status: 'Active',
      type: 'Distributor',
      createdAt: '2026-01-10T12:00:00Z',
    },
    {
      id: 'comp-2',
      name: 'St. Jude General Hospital Procurement',
      email: 'supplies@stjude-health.org',
      phone: '+1 312 555 0199',
      country: 'United States',
      city: 'Chicago',
      status: 'Active',
      type: 'Hospital',
      createdAt: '2026-03-14T09:30:00Z',
    },
  ]

  it('exports a single order PDF without throwing', () => {
    const doc = exportOrderPdf(sampleOrder, 'Apex Surgical Distribution', false)
    expect(doc).toBeDefined()
    expect(typeof doc.output).toBe('function')
  })

  it('exports bulk orders report PDF without throwing', () => {
    const providerMap = new Map<string, string>()
    providerMap.set('comp-1', 'Apex Surgical Distribution')
    const doc = exportOrdersReportPdf([sampleOrder], providerMap, false)
    expect(doc).toBeDefined()
    expect(typeof doc.output).toBe('function')
  })

  it('exports a commercial tax invoice PDF without throwing', () => {
    const doc = exportInvoicePdf(sampleOrder, 'Apex Surgical Distribution', false)
    expect(doc).toBeDefined()
    expect(typeof doc.output).toBe('function')
  })

  it('exports companies directory report PDF without throwing', () => {
    const doc = exportCompaniesReportPdf(sampleCompanies, false)
    expect(doc).toBeDefined()
    expect(typeof doc.output).toBe('function')
  })
})
