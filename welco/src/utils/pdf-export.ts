import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OrderDto, OrderItemDto } from '../domain/models/commerce'
import type { CompanyDto } from '../domain/models/company'
import { locale } from '../i18n'
import { ensureCairoFont } from './cairo-font'

// Clinical Precision Color Palette
const BRAND_NAVY = [15, 61, 86] as const // #0F3D56
const BRAND_TEAL = [20, 125, 146] as const // #147D92
const BRAND_ICE = [237, 244, 255] as const // #EDF4FF
const TEXT_DARK = [16, 42, 67] as const // #102A43
const TEXT_MUTED = [122, 144, 168] as const // #7A90A8
const BORDER_COLOR = [217, 226, 236] as const // #D9E2EC

/**
 * Reshapes Arabic text for jsPDF using the built-in processArabic engine.
 */
function arTxt(doc: jsPDF, text: string | null | undefined, isAr: boolean): string {
  if (!text) return ''
  if (!isAr) return text
  const hasAr = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
  if (!hasAr) return text
  try {
    const fn = (doc as unknown as { processArabic?: (t: string) => string }).processArabic
    if (typeof fn === 'function') {
      return fn.call(doc, text)
    }
    return text
  } catch {
    return text
  }
}

function translateStatus(st: string | undefined | null, isAr: boolean): string {
  if (!st) return isAr ? 'قيد الانتظار' : 'Pending'
  if (!isAr) return st
  const map: Record<string, string> = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    processing: 'قيد المعالجة',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }
  return map[st.toLowerCase()] || st
}

function drawClinicalHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  refText?: string,
  isAr = false,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  if (isAr) ensureCairoFont(doc)
  const fontMain = isAr ? 'Cairo' : 'helvetica'
  const fontBold = isAr ? 'Cairo' : 'helvetica'

  // Top Accent Bar
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.rect(0, 0, pageWidth, 5, 'F')

  // Welco Brand Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('WELCO', 14, 16)

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(isAr ? 8 : 9)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const brandSub = isAr
    ? 'منظومة توريد الأدوات الجراحية والرعاية الصحية'
    : 'SURGICAL INSTRUMENTS PLATFORM'
  doc.text(arTxt(doc, brandSub, isAr), 43, 16)

  // Compliance Pill on Top-Right
  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const certStr = isAr
    ? 'معتمد ISO 13485:2016  |  شهادة CE MDR  |  DIN EN ISO 7153-1'
    : 'ISO 13485:2016  |  CE CERTIFIED  |  DIN EN ISO 7153-1'
  doc.text(arTxt(doc, certStr, isAr), pageWidth - 14, 14, { align: 'right' })

  // Document Title Banner
  doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.roundedRect(14, 22, pageWidth - 28, 16, 2, 2, 'F')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  if (isAr) {
    doc.text(arTxt(doc, title, true), pageWidth - 20, 31, { align: 'right' })
  } else {
    doc.text(title.toUpperCase(), 18, 31)
  }

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  if (isAr) {
    doc.text(arTxt(doc, subtitle, true), pageWidth - 20, 35, { align: 'right' })
  } else {
    doc.text(subtitle, 18, 35)
  }

  if (refText) {
    doc.setFont(isAr ? fontBold : 'courier', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
    if (isAr) {
      doc.text(arTxt(doc, refText, true), 20, 32, { align: 'left' })
    } else {
      doc.text(refText, pageWidth - 18, 32, { align: 'right' })
    }
  }
}

function drawClinicalFooter(doc: jsPDF, pageNumber: number, totalPages: number, isAr = false) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const fontMain = isAr ? 'Cairo' : 'helvetica'

  // Thin separator
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.5)
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])

  const footerText = isAr
    ? 'منصة ويلكو للأدوات الجراحية • عمليات رعاية صحية معتمدة وفق ISO 13485 و CE MDR'
    : 'Welco Surgical Instruments Platform • ISO 13485 & CE MDR Accredited Healthcare Operations'

  const pageStr = isAr
    ? `صفحة ${pageNumber} من ${totalPages}`
    : `Page ${pageNumber} of ${totalPages}`

  if (isAr) {
    doc.text(arTxt(doc, footerText, true), pageWidth - 14, pageHeight - 7, { align: 'right' })
    doc.text(arTxt(doc, pageStr, true), 14, pageHeight - 7, { align: 'left' })
  } else {
    doc.text(footerText, 14, pageHeight - 7)
    doc.text(pageStr, pageWidth - 14, pageHeight - 7, { align: 'right' })
  }
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
 * Resolve a professional, standardized SKU code for an order item.
 * Prioritizes explicit SKU/code properties from the model/database,
 * and formats any fallback IDs with the standard Welco catalog prefix (WL-...).
 */
function resolveItemSku(it: OrderItemDto, idx: number): string {
  const explicit =
    it.sku ||
    it.productSku ||
    (it as unknown as { productCode?: string; skuCode?: string; code?: string }).productCode ||
    (it as unknown as { productCode?: string; skuCode?: string; code?: string }).skuCode ||
    (it as unknown as { productCode?: string; skuCode?: string; code?: string }).code

  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    const s = explicit.trim().toUpperCase()
    return s.startsWith('WL-') || s.startsWith('PRD-') || s.startsWith('SKU-') ? s : `WL-${s}`
  }

  if (it.productId) {
    const pid = String(it.productId).trim()
    if (pid.toUpperCase().startsWith('WL-') || pid.toUpperCase().startsWith('PRD-')) {
      return pid.toUpperCase()
    }
    // Clean hex slice from GUID or numeric ID with Welco catalog prefix
    const hexSlice = pid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
    if (hexSlice) {
      return `WL-${hexSlice}`
    }
  }

  return `WL-MED-${String(idx + 1).padStart(3, '0')}`
}

/**
 * 1. Export Single Order PDF (Dispatch & Consignment Sheet)
 */
export function exportOrderPdf(
  order: OrderDto,
  providerName = 'Welco Manufacturing & Direct Supply',
  autoDownload = true,
  lang?: 'en' | 'ar',
): jsPDF {
  const isAr = (lang || locale.value) === 'ar'
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  if (isAr) ensureCairoFont(doc)
  const fontMain = isAr ? 'Cairo' : 'helvetica'
  const fontBold = isAr ? 'Cairo' : 'helvetica'

  const orderNum = order.orderNumber || order.id || 'N/A'
  const dateStr = formatDateStr(order.createdAt)
  const currency = order.currencyCode || 'USD'
  const statusStr = translateStatus(order.status, isAr)

  const headerTitle = isAr ? 'وثيقة فحص وتوريد الطلب' : 'Order Consignment & Verification Sheet'
  const headerSub = isAr
    ? `تاريخ الإصدار: ${formatDateStr()} • الحالة: ${statusStr}`
    : `Generated on ${formatDateStr()} • Status: ${statusStr}`
  const headerRef = isAr ? `طلب رقم: ${orderNum}` : `ORDER #: ${orderNum}`

  drawClinicalHeader(doc, headerTitle, headerSub, headerRef, isAr)

  // Order Metadata Cards
  const pageWidth = doc.internal.pageSize.getWidth()
  const colWidth = (pageWidth - 28 - 6) / 2
  const topY = 43

  // Left Box: Consignment Info
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.roundedRect(14, topY, colWidth, 24, 2, 2, 'FD')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const consTitle = isAr ? 'تفاصيل أمر التوريد' : 'CONSIGNMENT DETAILS'
  doc.text(arTxt(doc, consTitle, isAr), isAr ? 14 + colWidth - 4 : 18, topY + 6, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  const ordLine = isAr ? `رقم الطلب: ${orderNum}` : `Order Number: ${orderNum}`
  const dateLine = isAr ? `تاريخ الطلب: ${dateStr}` : `Date Placed: ${dateStr}`
  const statLine = isAr ? `حالة التنفيذ: ${statusStr}` : `Fulfillment Status: ${order.status}`
  doc.text(arTxt(doc, ordLine, isAr), isAr ? 14 + colWidth - 4 : 18, topY + 11, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, dateLine, isAr), isAr ? 14 + colWidth - 4 : 18, topY + 16, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, statLine, isAr), isAr ? 14 + colWidth - 4 : 18, topY + 21, {
    align: isAr ? 'right' : 'left',
  })

  // Right Box: Provider & Supplier
  const rightX = 14 + colWidth + 6
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.roundedRect(rightX, topY, colWidth, 24, 2, 2, 'FD')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const provTitle = isAr ? 'المورّد الطبي المعتمد' : 'ASSIGNED MEDICAL PROVIDER'
  doc.text(arTxt(doc, provTitle, isAr), isAr ? rightX + colWidth - 4 : rightX + 4, topY + 6, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  const provLine = isAr
    ? `المورّد / المصنّع: ${providerName || 'ويلكو للتصنيع والتوريد المباشر'}`
    : `Provider / Vendor: ${providerName || 'Welco Manufacturing'}`
  const qLine = isAr ? 'اعتماد الجودة: متوافق مع ISO 13485:2016' : 'Quality Verification: ISO 13485:2016 Compliant'
  const lotLine = isAr ? 'تتبع الدفعات: مفعّل' : 'Lot Traceability: Enabled'
  doc.text(arTxt(doc, provLine, isAr), isAr ? rightX + colWidth - 4 : rightX + 4, topY + 11, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, qLine, isAr), isAr ? rightX + colWidth - 4 : rightX + 4, topY + 16, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, lotLine, isAr), isAr ? rightX + colWidth - 4 : rightX + 4, topY + 21, {
    align: isAr ? 'right' : 'left',
  })

  // Table of Items
  const items = Array.isArray(order.items) ? order.items : []
  const tableRows = items.map((it, idx) => {
    const rawName = isAr
      ? it.productNameAr || it.productNameEn || 'أداة جراحية'
      : it.productNameEn || it.productNameAr || 'Instrument'
    const name = arTxt(doc, rawName, isAr)
    const qty = it.quantity ?? 1
    const unitPrice = it.unitPrice ?? 0
    const total = qty * unitPrice
    const sku = resolveItemSku(it, idx)
    return [
      String(idx + 1).padStart(2, '0'),
      name,
      sku,
      String(qty),
      formatCurrency(unitPrice, currency),
      formatCurrency(total, currency),
    ]
  })

  const headCols = isAr
    ? [
        '#',
        arTxt(doc, 'وصف الأداة الجراحية', true),
        arTxt(doc, 'رمز الصنف', true),
        arTxt(doc, 'الكمية', true),
        arTxt(doc, 'سعر الوحدة', true),
        arTxt(doc, 'الإجمالي', true),
      ]
    : ['#', 'Instrument Description', 'SKU / Code', 'Qty', 'Unit Price', 'Total']

  const emptyText = isAr ? arTxt(doc, 'لا توجد أدوات مسجلة في هذا الطلب', true) : 'No itemized instruments recorded'

  autoTable(doc, {
    startY: 72,
    head: [headCols],
    body: tableRows.length > 0 ? tableRows : [['-', emptyText, '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: fontMain,
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 3,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
      halign: isAr ? 'right' : 'left',
    },
    headStyles: {
      font: fontBold,
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: isAr ? 'right' : 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
      2: { cellWidth: 30, halign: 'center', font: 'courier' },
      3: { cellWidth: 16, halign: 'center', font: 'courier' },
      4: { cellWidth: 28, halign: isAr ? 'left' : 'right', font: 'courier' },
      5: { cellWidth: 30, halign: isAr ? 'left' : 'right', font: 'courier', fontStyle: 'bold' },
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

  const summaryWidth = 84
  const summaryX = pageWidth - 14 - summaryWidth
  const summaryY = finalY + 8

  if (summaryY + 35 < doc.internal.pageSize.getHeight() - 15) {
    doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
    doc.roundedRect(summaryX, summaryY, summaryWidth, 32, 2, 2, 'FD')

    doc.setFont(fontMain, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
    const subLbl = isAr ? 'المجموع الفرعي:' : 'Subtotal:'
    doc.text(arTxt(doc, subLbl, isAr), summaryX + 4, summaryY + 7)
    doc.text(formatCurrency(subtotal, currency), summaryX + summaryWidth - 4, summaryY + 7, { align: 'right' })

    if (diff < -0.01) {
      doc.setTextColor(22, 163, 74)
      const discLbl = isAr ? 'خصم التعاقد:' : 'Negotiated Discount:'
      doc.text(arTxt(doc, discLbl, isAr), summaryX + 4, summaryY + 14)
      doc.text(`-${formatCurrency(Math.abs(diff), currency)}`, summaryX + summaryWidth - 4, summaryY + 14, {
        align: 'right',
      })
    } else if (diff > 0.01) {
      const shipLbl = isAr ? 'الشحن والخدمات اللوجستية:' : 'Freight & Logistics:'
      doc.text(arTxt(doc, shipLbl, isAr), summaryX + 4, summaryY + 14)
      doc.text(`+${formatCurrency(diff, currency)}`, summaryX + summaryWidth - 4, summaryY + 14, { align: 'right' })
    }

    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
    doc.line(summaryX + 4, summaryY + 19, summaryX + summaryWidth - 4, summaryY + 19)

    doc.setFont(fontBold, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
    const totLbl = isAr ? 'إجمالي أمر التوريد:' : 'Total Consignment:'
    doc.text(arTxt(doc, totLbl, isAr), summaryX + 4, summaryY + 26)
    doc.text(formatCurrency(totalAmount, currency), summaryX + summaryWidth - 4, summaryY + 26, { align: 'right' })
  }

  // Draw footers on all pages
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages, isAr)
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
  lang?: 'en' | 'ar',
): jsPDF {
  const isAr = (lang || locale.value) === 'ar'
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  if (isAr) ensureCairoFont(doc)
  const fontMain = isAr ? 'Cairo' : 'helvetica'
  const fontBold = isAr ? 'Cairo' : 'helvetica'

  const dateStr = formatDateStr()
  const totalTurnover = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)

  const repTitle = isAr ? 'تقرير سجل الطلبات والتوريدات الشامل' : 'Master Orders Registry Report'
  const repSub = isAr
    ? `تم تصدير ${orders.length} طلب توريد • تاريخ التوليد: ${dateStr}`
    : `Exported ${orders.length} consignments • Generated on ${dateStr}`
  const repRef = isAr
    ? `القيمة الإجمالية: ${formatCurrency(totalTurnover, 'USD')}`
    : `TOTAL VALUE: ${formatCurrency(totalTurnover, 'USD')}`

  drawClinicalHeader(doc, repTitle, repSub, repRef, isAr)

  const rows = orders.map((o, idx) => {
    const provId = o.companyId || (o as unknown as { providerId?: string }).providerId || ''
    const rawProv =
      (o as unknown as { providerName?: string; companyName?: string }).providerName ||
      (o as unknown as { companyName?: string }).companyName ||
      (provId && providerMap?.get(provId)) ||
      (isAr ? 'توريد مباشر' : 'Direct Supply')
    const provName = arTxt(doc, rawProv, isAr)
    const itemsCount = Array.isArray(o.items) ? o.items.length : 0

    return [
      String(idx + 1).padStart(3, '0'),
      o.orderNumber || o.id || '—',
      formatDateStr(o.createdAt),
      provName,
      String(itemsCount),
      formatCurrency(o.totalAmount, o.currencyCode || 'USD'),
      arTxt(doc, translateStatus(o.status, isAr), isAr),
    ]
  })

  const headCols = isAr
    ? [
        '#',
        arTxt(doc, 'رقم الطلب', true),
        arTxt(doc, 'تاريخ الطلب', true),
        arTxt(doc, 'المورّد / المصنّع', true),
        arTxt(doc, 'عدد الأصناف', true),
        arTxt(doc, 'القيمة', true),
        arTxt(doc, 'الحالة', true),
      ]
    : ['#', 'Order Number', 'Date Placed', 'Provider / Vendor', 'Items', 'Amount', 'Status']

  autoTable(doc, {
    startY: 44,
    head: [headCols],
    body: rows.length > 0 ? rows : [['-', isAr ? arTxt(doc, 'لا توجد طلبات مسجلة', true) : 'No orders found', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: fontMain,
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 2.5,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
      halign: isAr ? 'right' : 'left',
    },
    headStyles: {
      font: fontBold,
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: isAr ? 'right' : 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 36, font: 'courier', fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 38, halign: isAr ? 'left' : 'right', font: 'courier', fontStyle: 'bold' },
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
    drawClinicalFooter(doc, p, totalPages, isAr)
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
  lang?: 'en' | 'ar',
): jsPDF {
  const isAr = (lang || locale.value) === 'ar'
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  if (isAr) ensureCairoFont(doc)
  const fontMain = isAr ? 'Cairo' : 'helvetica'
  const fontBold = isAr ? 'Cairo' : 'helvetica'

  const orderNum = order.orderNumber || order.id || 'N/A'
  const invNumber = `INV-${orderNum.replace(/^WL-ORD-/, '')}`
  const dateStr = formatDateStr(order.createdAt)
  const currency = order.currencyCode || 'USD'
  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Sleek Top Accent Stripe
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.rect(0, 0, pageWidth - 55, 4, 'F')
  doc.setFillColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.rect(pageWidth - 55, 0, 55, 4, 'F')

  // 2. Executive Clean Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text('WELCO', 14, 17)

  // Decorative Brand Dot
  doc.setFillColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.circle(44, 14.5, 1.2, 'F')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const brandSub = isAr
    ? 'منظومة توريد الأدوات الجراحية والرعاية الصحية'
    : 'SURGICAL INSTRUMENTS PLATFORM'
  doc.text(arTxt(doc, brandSub, isAr), 48, 15)

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  const platSub = isAr
    ? 'شبكة التوريد المباشر للمستشفيات والمنشآت الطبية العالمية'
    : 'Global Healthcare Procurement & Direct Supply Network'
  doc.text(arTxt(doc, platSub, isAr), 14, 22)

  const certSub = isAr
    ? 'معتمد ISO 13485:2016  •  شهادة CE MDR الفئة I & IIa  •  DIN EN ISO 7153-1'
    : 'ISO 13485:2016 Accredited  •  CE MDR Class I & IIa  •  DIN EN ISO 7153-1'
  doc.text(arTxt(doc, certSub, isAr), 14, 26.5)

  // Top-Right: Invoice Document Title & Meta Box
  doc.setFont(fontBold, 'bold')
  doc.setFontSize(15)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const invDocTitle = isAr ? 'فاتورة ضريبية تجارية' : 'COMMERCIAL TAX INVOICE'
  doc.text(arTxt(doc, invDocTitle, isAr), pageWidth - 14, 15, { align: 'right' })

  // Meta Pill Container
  const pillW = 68
  const pillX = pageWidth - 14 - pillW
  const pillY = 19
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(pillX, pillY, pillW, 14, 1.5, 1.5, 'FD')

  doc.setFont(isAr ? fontBold : 'courier', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.text(invNumber, pageWidth - 17, pillY + 5, { align: 'right' })

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  const issDateLine = isAr ? `تاريخ الإصدار: ${dateStr}` : `Issue Date: ${dateStr}`
  const refOrdLine = isAr ? `رقم الطلب: ${orderNum}` : `Ref Order: ${orderNum}`
  doc.text(arTxt(doc, issDateLine, isAr), pageWidth - 17, pillY + 9, { align: 'right' })
  doc.text(arTxt(doc, refOrdLine, isAr), pageWidth - 17, pillY + 12.5, { align: 'right' })

  // 3. Seller & Buyer 2-Column Cards
  const colW = (pageWidth - 28 - 6) / 2
  const partyY = 37
  const cardH = 31

  // Left Card: Supplier / Seller Details
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(14, partyY, colW, cardH, 2, 2, 'FD')

  // Left Accent Bar (Teal)
  doc.setFillColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.rect(isAr ? 14 + colW - 1.5 : 14, partyY, 1.5, cardH, 'F')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const selTitle = isAr ? 'المصنّع / المورّد (البائع)' : 'MANUFACTURER / SUPPLIER (SELLER)'
  doc.text(arTxt(doc, selTitle, isAr), isAr ? 14 + colW - 4.5 : 18, partyY + 6, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  const safeProvider = providerName || (isAr ? 'شركة ويلكو لتصنيع الأدوات الجراحية' : 'Welco Surgical Instruments Manufacturing Ltd.')
  const provDisp = safeProvider.length > 40 ? `${safeProvider.slice(0, 38)}...` : safeProvider
  doc.text(arTxt(doc, provDisp, isAr), isAr ? 14 + colW - 4.5 : 18, partyY + 11.5, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  const sFac = isAr ? 'منشأة أجهزة طبية معتمدة • مسجلة ISO 13485:2016' : 'Medical Device Facility • ISO 13485:2016 Accredited'
  const sCe = isAr ? 'شهادة علامة المطابقة: CE MDR 2017/745 (فئة I & IIa)' : 'CE Mark Verification: MDR 2017/745 Class I & IIa'
  const sTax = isAr ? 'الرقم الضريبي: REG-WL-940281-EU' : 'Tax / VAT ID: REG-WL-940281-EU'
  doc.text(arTxt(doc, sFac, isAr), isAr ? 14 + colW - 4.5 : 18, partyY + 16.5, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, sCe, isAr), isAr ? 14 + colW - 4.5 : 18, partyY + 21, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, sTax, isAr), isAr ? 14 + colW - 4.5 : 18, partyY + 25.5, {
    align: isAr ? 'right' : 'left',
  })

  // Right Card: Buyer Details
  const buyerX = 14 + colW + 6
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(buyerX, partyY, colW, cardH, 2, 2, 'FD')

  // Right Accent Bar (Navy)
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  doc.rect(isAr ? buyerX + colW - 1.5 : buyerX, partyY, 1.5, cardH, 'F')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const buyTitle = isAr ? 'العميل / المشتري (المستلم)' : 'BILL TO / CONSIGNEE (BUYER)'
  doc.text(arTxt(doc, buyTitle, isAr), isAr ? buyerX + colW - 4.5 : buyerX + 4.5, partyY + 6, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  const buyClient = isAr ? `مؤسسة الرعاية الصحية / طلب ${orderNum}` : `Healthcare Client / Order ${orderNum}`
  doc.text(arTxt(doc, buyClient, isAr), isAr ? buyerX + colW - 4.5 : buyerX + 4.5, partyY + 11.5, {
    align: isAr ? 'right' : 'left',
  })

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  const bRef = isAr ? `رقم الطلب المرجعي: ${orderNum}` : `Reference Order: ${orderNum}`
  const bTerms = isAr ? 'شروط السداد: حساب تجاري • استحقاق 30 يوماً' : 'Payment Terms: Commercial Account • Net 30'
  const bInco = isAr
    ? `شروط الشحن: ${order.incotermCode || 'CIP المستودع الطبي / الميناء'}`
    : `Incoterms: ${order.incotermCode || 'CIP Named Hospital Port / Air Freight'}`
  doc.text(arTxt(doc, bRef, isAr), isAr ? buyerX + colW - 4.5 : buyerX + 4.5, partyY + 16.5, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, bTerms, isAr), isAr ? buyerX + colW - 4.5 : buyerX + 4.5, partyY + 21, {
    align: isAr ? 'right' : 'left',
  })
  doc.text(arTxt(doc, bInco, isAr), isAr ? buyerX + colW - 4.5 : buyerX + 4.5, partyY + 25.5, {
    align: isAr ? 'right' : 'left',
  })

  // 4. Itemized Invoice Table
  const items = Array.isArray(order.items) ? order.items : []
  const invoiceRows = items.map((it, idx) => {
    const rawName = isAr
      ? it.productNameAr || it.productNameEn || 'أداة جراحية'
      : it.productNameEn || it.productNameAr || 'Surgical Instrument'
    const name = arTxt(doc, rawName, isAr)
    const qty = it.quantity ?? 1
    const price = it.unitPrice ?? 0
    const total = qty * price
    const sku = resolveItemSku(it, idx)

    return [
      String(idx + 1).padStart(2, '0'),
      name,
      sku,
      String(qty),
      formatCurrency(price, currency),
      formatCurrency(total, currency),
    ]
  })

  const headCols = isAr
    ? [
        '#',
        arTxt(doc, 'الوصف والمواصفات الطبية', true),
        arTxt(doc, 'رمز الصنف', true),
        arTxt(doc, 'الكمية', true),
        arTxt(doc, 'سعر الوحدة', true),
        arTxt(doc, 'المبلغ الصافي', true),
      ]
    : ['#', 'Description of Medical Goods', 'SKU / Catalog Ref', 'Qty', 'Unit Price', 'Net Amount']

  const emptyText = isAr ? arTxt(doc, 'لا توجد أصناف في هذه الفاتورة', true) : 'No billable items recorded'

  autoTable(doc, {
    startY: 73,
    head: [headCols],
    body: invoiceRows.length > 0 ? invoiceRows : [['-', emptyText, '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: fontMain,
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 3,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.15,
      valign: 'middle',
      halign: isAr ? 'right' : 'left',
    },
    headStyles: {
      font: fontBold,
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3.5,
      halign: isAr ? 'right' : 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: isAr ? 'right' : 'left', fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center', font: 'courier' },
      3: { cellWidth: 16, halign: 'center', font: 'courier' },
      4: { cellWidth: 28, halign: isAr ? 'left' : 'right', font: 'courier' },
      5: { cellWidth: 32, halign: isAr ? 'left' : 'right', font: 'courier', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  // 5. Bottom Financial Summary Box & Quality Certification
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120
  const subtotal = items.reduce((sum, it) => sum + (it.quantity ?? 0) * (it.unitPrice ?? 0), 0)
  const totalAmount = order.totalAmount ?? subtotal
  const diff = totalAmount - subtotal

  const sumW = 86
  const sumX = pageWidth - 14 - sumW
  const sumY = finalY + 6

  // Right Financial Totals Card
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(sumX, sumY, sumW, 36, 2, 2, 'FD')

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  const subLbl = isAr ? 'إجمالي البضائع:' : 'Goods Subtotal:'
  doc.text(arTxt(doc, subLbl, isAr), sumX + 4, sumY + 7)
  doc.text(formatCurrency(subtotal, currency), sumX + sumW - 4, sumY + 7, { align: 'right' })

  if (diff < -0.01) {
    doc.setTextColor(22, 163, 74)
    const discLbl = isAr ? 'خصم الكمية / المناقصة:' : 'Volume / Tender Discount:'
    doc.text(arTxt(doc, discLbl, isAr), sumX + 4, sumY + 14)
    doc.text(`-${formatCurrency(Math.abs(diff), currency)}`, sumX + sumW - 4, sumY + 14, { align: 'right' })
  } else if (diff > 0.01) {
    const shipLbl = isAr ? 'الشحن والتغليف الطبي المعقم:' : 'Shipping & Sterile Packaging:'
    doc.text(arTxt(doc, shipLbl, isAr), sumX + 4, sumY + 14)
    doc.text(`+${formatCurrency(diff, currency)}`, sumX + sumW - 4, sumY + 14, { align: 'right' })
  } else {
    const taxLbl = isAr ? 'ضريبة القيمة المضافة (0% إعفاء طبي):' : 'Tax / VAT (0% Healthcare Export):'
    doc.text(arTxt(doc, taxLbl, isAr), sumX + 4, sumY + 14)
    doc.text(formatCurrency(0, currency), sumX + sumW - 4, sumY + 14, { align: 'right' })
  }

  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.2)
  doc.line(sumX + 4, sumY + 20, sumX + sumW - 4, sumY + 20)

  // Total Payable Highlight Pill
  doc.setFillColor(BRAND_ICE[0], BRAND_ICE[1], BRAND_ICE[2])
  doc.roundedRect(sumX + 3, sumY + 23, sumW - 6, 10, 1.5, 1.5, 'F')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const totPayLbl = isAr ? 'المبلغ الإجمالي المستحق:' : 'TOTAL PAYABLE:'
  doc.text(arTxt(doc, totPayLbl, isAr), sumX + 6, sumY + 29.5)
  doc.text(formatCurrency(totalAmount, currency), sumX + sumW - 6, sumY + 29.5, { align: 'right' })

  // Left Side: Quality Compliance Statement & Official Digital Stamp
  doc.setFont(fontBold, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const decHead = isAr ? 'إقرار الجودة والامتثال الطبي المعتمد:' : 'Authorized Quality & Compliance Declaration:'
  doc.text(arTxt(doc, decHead, isAr), 14, sumY + 6)

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  if (isAr) {
    doc.text(arTxt(doc, 'نشهد بأن كافة الأدوات الجراحية المبيّنة في هذا المستند مصنعة من أجود خامات الفولاذ الطبي', true), 14, sumY + 11)
    doc.text(arTxt(doc, '(DIN EN ISO 7153-1) ومطابقة لنظام إدارة الجودة المعتمد ISO 13485:2016 واشتراطات', true), 14, sumY + 15)
    doc.text(arTxt(doc, 'المطابقة الأوروبية للأجهزة الطبية CE MDR 2017/745 مع تتبع معقم كامل.', true), 14, sumY + 19)
  } else {
    doc.text('We hereby certify that the surgical instruments described herein are fabricated from', 14, sumY + 11)
    doc.text('premium medical-grade steel (DIN EN ISO 7153-1) and manufactured in full compliance', 14, sumY + 15)
    doc.text('with ISO 13485:2016 and CE MDR 2017/745 quality management standards.', 14, sumY + 19)
  }

  // Official Verified Badge Stamp
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(14, sumY + 23, 88, 11, 1.5, 1.5, 'FD')

  doc.setFont(fontBold, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2])
  const stampTitle = isAr ? 'شركة ويلكو للأدوات الجراحية - تم الفحص والاعتماد' : 'WELCO SURGICAL INSTRUMENTS CO. - VERIFIED'
  doc.text(arTxt(doc, stampTitle, isAr), 18, sumY + 28)

  doc.setFont(fontMain, 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(BRAND_TEAL[0], BRAND_TEAL[1], BRAND_TEAL[2])
  const stampSub = isAr
    ? 'مستند مدقق وموقع إلكترونياً • توريد رعاية صحية معتمد'
    : 'DIGITALLY AUDITED & SIGNED • SECURE HEALTHCARE DISPATCH'
  doc.text(arTxt(doc, stampSub, isAr), 18, sumY + 32)

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawClinicalFooter(doc, p, totalPages, isAr)
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
  lang?: 'en' | 'ar',
): jsPDF {
  const isAr = (lang || locale.value) === 'ar'
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  if (isAr) ensureCairoFont(doc)
  const fontMain = isAr ? 'Cairo' : 'helvetica'
  const fontBold = isAr ? 'Cairo' : 'helvetica'

  const dateStr = formatDateStr()

  const dirTitle = isAr ? 'دليل المؤسسات والموردين الطبيين المسجلين' : 'Registered Medical Companies & Providers Directory'
  const dirSub = isAr
    ? `دليل نشط • إجمالي المؤسسات المسجلة: ${companies.length} مؤسسة`
    : `Active Directory • Total Registered: ${companies.length} institutions`
  const dirRef = isAr ? `التاريخ: ${dateStr}` : `DATE: ${dateStr}`

  drawClinicalHeader(doc, dirTitle, dirSub, dirRef, isAr)

  const typeMapEn: Record<number, string> = {
    1: 'Hospital / Clinic',
    2: 'Medical Distributor',
    3: 'Surgical Clinic',
    4: 'Equipment Supplier',
  }

  const typeMapAr: Record<number, string> = {
    1: 'مستشفى / عيادة',
    2: 'موزع أجهزة طبية',
    3: 'عيادة جراحية',
    4: 'مورّد معدات طبية',
  }

  const statusMapEn: Record<number, string> = {
    1: 'Pending Review',
    2: 'Verified & Approved',
    3: 'Rejected',
  }

  const statusMapAr: Record<number, string> = {
    1: 'قيد المراجعة',
    2: 'معتمد وموثق',
    3: 'مرفوض',
  }

  const rows = companies.map((c, idx) => {
    const rawType = c.type as unknown as number | string
    const typeLabel = typeof rawType === 'number'
      ? (isAr ? typeMapAr[rawType] : typeMapEn[rawType]) || (c.isProvider ? (isAr ? 'مورّد' : 'Provider') : (isAr ? 'موزّع' : 'Distributor'))
      : String(rawType || (c.isProvider ? (isAr ? 'مورّد' : 'Provider') : (isAr ? 'موزّع' : 'Distributor')))

    const rawStatus = c.status as unknown as number | string
    const statusLabel = typeof rawStatus === 'number'
      ? (isAr ? statusMapAr[rawStatus] : statusMapEn[rawStatus]) || (isAr ? 'نشط' : 'Active')
      : String(rawStatus || (c.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')))

    const territory = isAr
      ? c.countryNameAr || c.countryNameEn || (c as unknown as { country?: string }).country || 'دولي / تصدير'
      : c.countryNameEn || c.countryNameAr || (c as unknown as { country?: string }).country || 'Global / Export'

    const phone = (c as unknown as { phone?: string; phoneNumber?: string }).phone ||
                  (c as unknown as { phone?: string; phoneNumber?: string }).phoneNumber || '—'

    return [
      String(idx + 1).padStart(3, '0'),
      arTxt(doc, c.name || (isAr ? 'مؤسسة غير مسماة' : 'Unnamed Institution'), isAr),
      arTxt(doc, typeLabel, isAr),
      arTxt(doc, statusLabel, isAr),
      arTxt(doc, territory, isAr),
      c.email || '—',
      phone,
    ]
  })

  const headCols = isAr
    ? [
        '#',
        arTxt(doc, 'اسم المؤسسة / الشركة الطبية', true),
        arTxt(doc, 'نوع الكيان', true),
        arTxt(doc, 'حالة الامتثال', true),
        arTxt(doc, 'النطاق / الدولة', true),
        'Email',
        'Phone',
      ]
    : ['#', 'Institution / Company Name', 'Entity Type', 'Compliance Status', 'Territory / Location', 'Email Address', 'Phone']

  autoTable(doc, {
    startY: 44,
    head: [headCols],
    body: rows.length > 0 ? rows : [['-', isAr ? arTxt(doc, 'لا توجد مؤسسات مسجلة', true) : 'No registered institutions found', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: fontMain,
      fontSize: 8,
      textColor: [TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]],
      cellPadding: 2.5,
      lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
      lineWidth: 0.2,
      halign: isAr ? 'right' : 'left',
    },
    headStyles: {
      font: fontBold,
      fillColor: [BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: isAr ? 'right' : 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: isAr ? 'right' : 'left', fontStyle: 'bold' },
      2: { cellWidth: 30, halign: isAr ? 'right' : 'left' },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 40, halign: isAr ? 'right' : 'left' },
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
    drawClinicalFooter(doc, p, totalPages, isAr)
  }

  if (autoDownload && typeof window !== 'undefined') {
    doc.save(`Welco-Companies-Directory-${dateStr}.pdf`)
  }

  return doc
}
