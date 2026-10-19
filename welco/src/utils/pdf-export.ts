import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OrderDto } from '../domain/models/commerce'
import type { CompanyDto } from '../domain/models/company'

// Clinical Precision Color Palette
const BRAND_NAVY = [15, 61, 86] as const // #0F3D56
const BRAND_TEAL = [20, 125, 146] as const // #147D92
const BRAND_ICE = [237, 244, 255] as const // #EDF4FF
const TEXT_DARK = [16, 42, 67] as const // #102A43
const TEXT_MUTED = [122, 144, 168] as const // #7A90A8
const BORDER_COLOR = [217, 226, 236] as const // #D9E2EC

function drawClinicalHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  refText?: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Top Accent Bar
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.rect(0, 0, pageWidth, 5, 'F')

  // Welco Brand Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('WELCO', 14, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.text('SURGICAL INSTRUMENTS PLATFORM', 43, 16)

  // Compliance Pill on Top-Right
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('ISO 13485:2016  |  CE CERTIFIED  |  DIN EN ISO 7153-1', pageWidth - 14, 14, { align: 'right' })

  // Document Title Banner
  doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.roundedRect(14, 22, pageWidth - 28, 16, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text(title.toUpperCase(), 18, 31)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  doc.text(subtitle, 18, 35)

  if (refText) {
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
    doc.text(refText, pageWidth - 18, 32, { align: 'right' })
  }
}

function drawClinicalFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Thin separator
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.5)
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  doc.text(
    `Welco Surgical Instruments Platform • ISO 13485 & CE MDR Accredited Healthcare Operations`,
    14,
    pageHeight - 7,
  )

  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 7, {
    align: 'right',
  })
}

function formatCurrency(amount: number | null | undefined, currency = 'USD'): string {
  const val = Number(amount ?? 0)
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function formatDateStr(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0] || ''
  try {
    return new Date(dateStr).toISOString().split('T')[0] || ''
  } catch {
    return String(dateStr).slice(0, 10)
  }
}

/**
 * 1. Export Single Order PDF (Dispatch & Consignment Sheet)
 */
export function exportOrderPdf(
  order: OrderDto,
  providerName = 'Welco Manufacturing & Direct Supply',
  autoDownload = true,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const orderNum = order.orderNumber || order.id || 'N/A'
  const dateStr = formatDateStr(order.createdAt)
  const currency = order.currencyCode || 'USD'
  const statusStr = order.status || 'Pending'

  drawClinicalHeader(
    doc,
    'Order Consignment & Verification Sheet',
    `Generated on ${formatDateStr()} • Status: ${statusStr}`,
    `ORDER #: ${orderNum}`,
  )

  // Order Metadata Cards
  const pageWidth = doc.internal.pageSize.getWidth()
  const colWidth = (pageWidth - 28 - 6) / 2
  const topY = 43

  // Left Box: Consignment Info
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.roundedRect(14, topY, colWidth, 24, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.text('CONSIGNMENT DETAILS', 18, topY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text(`Order Number: ${orderNum}`, 18, topY + 11)
  doc.text(`Date Placed: ${dateStr}`, 18, topY + 16)
  doc.text(`Fulfillment Status: ${order.status}`, 18, topY + 21)

  // Right Box: Provider & Supplier
  const rightX = 14 + colWidth + 6
  doc.roundedRect(rightX, topY, colWidth, 24, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.text('ASSIGNED MEDICAL PROVIDER', rightX + 4, topY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text(`Provider / Vendor: ${providerName || 'Welco Manufacturing'}`, rightX + 4, topY + 11)
  doc.text(`Quality Verification: ISO 13485:2016 Compliant`, rightX + 4, topY + 16)
  doc.text(`Lot Traceability: Enabled`, rightX + 4, topY + 21)

  // Table of Items
  const items = Array.isArray(order.items) ? order.items : []
  const tableRows = items.map((it, idx) => {
    const name = it.productNameEn || it.productNameAr || it.productId || 'Instrument'
    const qty = it.quantity ?? 1
    const unitPrice = it.unitPrice ?? 0
    const total = qty * unitPrice
    return [
      String(idx + 1).padStart(2, '0'),
      name,
      it.productId ? String(it.productId).slice(0, 8).toUpperCase() : 'SKU-STD',
      String(qty),
      formatCurrency(unitPrice, currency),
      formatCurrency(total, currency),
    ]
  })

  autoTable(doc, {
    startY: 72,
    head: [['#', 'Instrument Description', 'SKU / Code', 'Qty', 'Unit Price', 'Total']],
    body: tableRows.length > 0 ? tableRows : [['-', 'No itemized instruments recorded', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 3,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 26, font: 'courier' },
      3: { cellWidth: 16, halign: 'center', font: 'courier' },
      4: { cellWidth: 28, halign: 'right', font: 'courier' },
      5: { cellWidth: 30, halign: 'right', font: 'courier', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [247, 249, 251],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  // Financial Summary Breakdown Card
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120
  const subtotal = items.reduce((sum, it) => sum + (it.quantity ?? 0) * (it.unitPrice ?? 0), 0)
  const totalAmount = order.totalAmount ?? subtotal
  const diff = totalAmount - subtotal

  const summaryWidth = 80
  const summaryX = pageWidth - 14 - summaryWidth
  const summaryY = finalY + 8

  if (summaryY + 35 < doc.internal.pageSize.getHeight() - 15) {
    doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
    doc.roundedRect(summaryX, summaryY, summaryWidth, 32, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
    doc.text('Subtotal:', summaryX + 4, summaryY + 7)
    doc.text(formatCurrency(subtotal, currency), summaryX + summaryWidth - 4, summaryY + 7, { align: 'right' })

    if (diff < -0.01) {
      doc.setTextColor(22, 163, 74) // Emerald green
      doc.text('Negotiated Discount:', summaryX + 4, summaryY + 14)
      doc.text(`-${formatCurrency(Math.abs(diff), currency)}`, summaryX + summaryWidth - 4, summaryY + 14, {
        align: 'right',
      })
    } else if (diff > 0.01) {
      doc.text('Freight & Logistics:', summaryX + 4, summaryY + 14)
      doc.text(`+${formatCurrency(diff, currency)}`, summaryX + summaryWidth - 4, summaryY + 14, { align: 'right' })
    }

    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
    doc.line(summaryX + 4, summaryY + 19, summaryX + summaryWidth - 4, summaryY + 19)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
    doc.text('Total Consignment:', summaryX + 4, summaryY + 26)
    doc.text(formatCurrency(totalAmount, currency), summaryX + summaryWidth - 4, summaryY + 26, { align: 'right' })
  }

  // Draw footers on all pages
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages)
  }

  if (autoDownload && typeof window !== 'undefined') {
    doc.save(`Welco-Order-${orderNum}.pdf`)
  }

  return doc
}

/**
 * 2. Export All Orders List PDF (Executive Orders Registry Report)
 */
export function exportOrdersReportPdf(
  orders: OrderDto[],
  providerMap?: Map<string, string>,
  autoDownload = true,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const dateStr = formatDateStr()
  const totalTurnover = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)

  drawClinicalHeader(
    doc,
    'Master Orders Registry Report',
    `Exported ${orders.length} consignments • Generated on ${dateStr}`,
    `TOTAL VALUE: ${formatCurrency(totalTurnover, 'USD')}`,
  )

  const rows = orders.map((o, idx) => {
    const provId = o.companyId || (o as unknown as { providerId?: string }).providerId || ''
    const provName =
      (o as unknown as { providerName?: string; companyName?: string }).providerName ||
      (o as unknown as { companyName?: string }).companyName ||
      (provId && providerMap?.get(provId)) ||
      'Direct Supply'
    const itemsCount = Array.isArray(o.items) ? o.items.length : 0

    return [
      String(idx + 1).padStart(3, '0'),
      o.orderNumber || o.id || '—',
      formatDateStr(o.createdAt),
      provName,
      String(itemsCount),
      formatCurrency(o.totalAmount, o.currencyCode || 'USD'),
      o.status || 'Pending',
    ]
  })

  autoTable(doc, {
    startY: 44,
    head: [['#', 'Order Number', 'Date Placed', 'Provider / Vendor', 'Items', 'Amount', 'Status']],
    body: rows.length > 0 ? rows : [['-', 'No orders found', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 2.5,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 36, font: 'courier', fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 38, halign: 'right', font: 'courier', fontStyle: 'bold' },
      6: { cellWidth: 30, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [247, 249, 251],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages)
  }

  if (autoDownload && typeof window !== 'undefined') {
    doc.save(`Welco-Master-Orders-Report-${dateStr}.pdf`)
  }

  return doc
}

/**
 * 3. Export Order Commercial Tax Invoice PDF
 */
export function exportInvoicePdf(
  order: OrderDto,
  providerName = 'Welco Surgical Instruments Manufacturing Ltd.',
  autoDownload = true,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const orderNum = order.orderNumber || order.id || 'N/A'
  const invNumber = `INV-${orderNum.replace(/^WL-ORD-/, '')}`
  const dateStr = formatDateStr(order.createdAt)
  const currency = order.currencyCode || 'USD'
  const pageWidth = doc.internal.pageSize.getWidth()

  // Top Dark Header Banner
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('COMMERCIAL TAX INVOICE', 14, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.text('OFFICIAL SURGICAL PROCUREMENT BILLING', 14, 21)

  // Invoice Number & Meta
  doc.setFont('courier', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(invNumber, pageWidth - 14, 14, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.text(`Issue Date: ${dateStr}`, pageWidth - 14, 20, { align: 'right' })

  // Seller & Buyer 2-Column Block
  const colW = (pageWidth - 28 - 8) / 2
  const partyY = 36

  // Seller Details
  doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.roundedRect(14, partyY, colW, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('MANUFACTURER / SUPPLIER (SELLER):', 18, partyY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text(providerName || 'Welco Surgical Instruments Manufacturing Ltd.', 18, partyY + 11)
  doc.text('ISO 13485:2016 Medical Device Registered Facility', 18, partyY + 16)
  doc.text('CE Mark Verification: MDR 2017/745 Class I & IIa', 18, partyY + 21)
  doc.text('Tax / VAT ID: REG-WL-940281-EU', 18, partyY + 25)

  // Buyer Details
  const buyerX = 14 + colW + 8
  doc.roundedRect(buyerX, partyY, colW, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('BILL TO / CONSIGNEE (BUYER):', buyerX + 4, partyY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text(`Client / Organization: Consignee for Order ${orderNum}`, buyerX + 4, partyY + 11)
  doc.text(`Reference Order: ${orderNum}`, buyerX + 4, partyY + 16)
  doc.text(`Payment Terms: Due on Formal Invoice Dispatch`, buyerX + 4, partyY + 21)
  doc.text(`Incoterms: CIP / CIF Named Hospital Port`, buyerX + 4, partyY + 25)

  // Itemized Invoice Table
  const items = Array.isArray(order.items) ? order.items : []
  const invoiceRows = items.map((it, idx) => {
    const name = it.productNameEn || it.productNameAr || 'Surgical Instrument'
    const qty = it.quantity ?? 1
    const price = it.unitPrice ?? 0
    const total = qty * price
    return [
      String(idx + 1),
      name,
      '9018.90', // Harmonized System Code for Surgical Instruments
      String(qty),
      formatCurrency(price, currency),
      formatCurrency(total, currency),
    ]
  })

  autoTable(doc, {
    startY: 72,
    head: [['#', 'Description of Medical Goods', 'HS Code', 'Qty', 'Unit Price', 'Net Amount']],
    body: invoiceRows.length > 0 ? invoiceRows : [['-', 'No billable items found', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 3,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center', font: 'courier' },
      3: { cellWidth: 16, halign: 'center', font: 'courier' },
      4: { cellWidth: 30, halign: 'right', font: 'courier' },
      5: { cellWidth: 32, halign: 'right', font: 'courier', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [247, 249, 251],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  // Bottom Summary Box
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120
  const subtotal = items.reduce((sum, it) => sum + (it.quantity ?? 0) * (it.unitPrice ?? 0), 0)
  const totalAmount = order.totalAmount ?? subtotal
  const diff = totalAmount - subtotal

  const sumW = 86
  const sumX = pageWidth - 14 - sumW
  const sumY = finalY + 6

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.roundedRect(sumX, sumY, sumW, 36, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  doc.text('Goods Subtotal:', sumX + 4, sumY + 7)
  doc.text(formatCurrency(subtotal, currency), sumX + sumW - 4, sumY + 7, { align: 'right' })

  if (diff < -0.01) {
    doc.setTextColor(22, 163, 74)
    doc.text('Volume / Tender Discount:', sumX + 4, sumY + 14)
    doc.text(`-${formatCurrency(Math.abs(diff), currency)}`, sumX + sumW - 4, sumY + 14, { align: 'right' })
  } else if (diff > 0.01) {
    doc.text('Shipping & Sterile Packaging:', sumX + 4, sumY + 14)
    doc.text(`+${formatCurrency(diff, currency)}`, sumX + sumW - 4, sumY + 14, { align: 'right' })
  } else {
    doc.text('Tax / VAT (0% Export):', sumX + 4, sumY + 14)
    doc.text(formatCurrency(0, currency), sumX + sumW - 4, sumY + 14, { align: 'right' })
  }

  doc.line(sumX + 4, sumY + 20, sumX + sumW - 4, sumY + 20)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('TOTAL PAYABLE:', sumX + 4, sumY + 28)
  doc.text(formatCurrency(totalAmount, currency), sumX + sumW - 4, sumY + 28, { align: 'right' })

  // Declaration & Signature on Left
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  doc.text('Authorized Declaration:', 14, sumY + 7)
  doc.text('We hereby certify that the surgical instruments described', 14, sumY + 12)
  doc.text('herein are fabricated from premium medical-grade steel and', 14, sumY + 16)
  doc.text('fully comply with ISO 13485:2016 quality standards.', 14, sumY + 20)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('WELCO SURGICAL INSTRUMENTS CO.', 14, sumY + 28)

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages)
  }

  if (autoDownload && typeof window !== 'undefined') {
    doc.save(`Welco-Invoice-${invNumber}.pdf`)
  }

  return doc
}

/**
 * 4. Export Companies Directory PDF Report
 */
export function exportCompaniesReportPdf(
  companies: CompanyDto[],
  autoDownload = true,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const dateStr = formatDateStr()

  drawClinicalHeader(
    doc,
    'Registered Medical Companies & Providers Directory',
    `Active Directory • Total Registered: ${companies.length} institutions`,
    `DATE: ${dateStr}`,
  )

  const typeMap: Record<number, string> = {
    1: 'Hospital / Clinic',
    2: 'Medical Distributor',
    3: 'Surgical Clinic',
    4: 'Equipment Supplier',
  }

  const statusMap: Record<number, string> = {
    1: 'Pending Review',
    2: 'Verified & Approved',
    3: 'Rejected',
  }

  const rows = companies.map((c, idx) => {
    const rawType = c.type as unknown as number | string
    const typeLabel = typeof rawType === 'number'
      ? (typeMap[rawType] || (c.isProvider ? 'Provider' : 'Distributor'))
      : String(rawType || (c.isProvider ? 'Provider' : 'Distributor'))

    const rawStatus = c.status as unknown as number | string
    const statusLabel = typeof rawStatus === 'number'
      ? (statusMap[rawStatus] || 'Active')
      : String(rawStatus || (c.isActive ? 'Active' : 'Inactive'))

    const territory = c.countryNameEn || c.countryNameAr || (c as unknown as { country?: string }).country || 'Global / Export'
    const phone = (c as unknown as { phone?: string; phoneNumber?: string }).phone ||
                  (c as unknown as { phone?: string; phoneNumber?: string }).phoneNumber || '—'

    return [
      String(idx + 1).padStart(3, '0'),
      c.name || 'Unnamed Institution',
      typeLabel,
      statusLabel,
      territory,
      c.email || '—',
      phone,
    ]
  })

  autoTable(doc, {
    startY: 44,
    head: [['#', 'Institution / Company Name', 'Entity Type', 'Compliance Status', 'Territory / Location', 'Email Address', 'Phone']],
    body: rows.length > 0 ? rows : [['-', 'No registered institutions found', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 2.5,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 40 },
      5: { cellWidth: 45, font: 'courier' },
      6: { cellWidth: 34, font: 'courier' },
    },
    alternateRowStyles: {
      fillColor: [247, 249, 251],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages)
  }

  if (autoDownload && typeof window !== 'undefined') {
    doc.save(`Welco-Companies-Directory-${dateStr}.pdf`)
  }

  return doc
}
