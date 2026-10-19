// Auto-generated Cairo Arabic TTF font loader for jsPDF vector rendering
import type jsPDF from 'jspdf'
import cairoFonts from './cairo-font.json'

export const CAIRO_REGULAR_BASE64 = cairoFonts.regular
export const CAIRO_BOLD_BASE64 = cairoFonts.bold

export function ensureCairoFont(doc: jsPDF): boolean {
  try {
    const fontList = doc.getFontList()
    if (!fontList || !fontList['Cairo']) {
      doc.addFileToVFS('Cairo-Regular.ttf', CAIRO_REGULAR_BASE64)
      doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal')
      doc.addFileToVFS('Cairo-Bold.ttf', CAIRO_BOLD_BASE64)
      doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold')
    }
    return true
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[pdf-export] Failed to register Cairo font:', e)
    return false
  }
}
