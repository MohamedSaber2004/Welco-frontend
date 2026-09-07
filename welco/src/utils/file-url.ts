import { API_BASE_URL } from '../config/api.config'

export const PLACEHOLDER = '/images/placeholder.svg'
export const PLACEHOLDER_PNG = '/images/placeholder.png'

export function isStoredFileName(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim().replace(/^\/+/, '')
  return (
    /^\d+_[0-9a-fA-F\-]{8,}\..+$/i.test(trimmed) ||
    /^\d+_\d+\..+$/i.test(trimmed) ||
    /^\d+_[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/i.test(trimmed)
  )
}

export function resolveFileUrl(storedName: string | null | undefined, fallback = PLACEHOLDER): string {
  if (!storedName || typeof storedName !== 'string' || !storedName.trim()) return fallback
  const trimmed = storedName.trim()
  if (trimmed === PLACEHOLDER || trimmed === PLACEHOLDER_PNG) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }

  if (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/icons/') ||
    trimmed.startsWith('/favicon') ||
    trimmed.startsWith('/locales/')
  ) {
    return trimmed
  }
  if (trimmed.startsWith('/files/')) {
    return `${API_BASE_URL}${trimmed}`
  }
  if (trimmed.startsWith('files/')) {
    return `${API_BASE_URL}/${trimmed}`
  }
  const cleanName = trimmed.replace(/^\/+/, '')
  if (isStoredFileName(cleanName) || cleanName.includes('.')) {
    return `${API_BASE_URL}/files/${cleanName}`
  }
  if (trimmed.startsWith('/')) return trimmed
  if (cleanName.length > 0) {
    return `${API_BASE_URL}/files/${cleanName}`
  }
  return fallback
}

export function withImageFallback(img: HTMLImageElement): void {
  img.onerror = () => {
    if (img.src !== PLACEHOLDER && !img.src.endsWith(PLACEHOLDER)) {
      img.src = PLACEHOLDER
    }
    img.onerror = null
  }
}

export function productMediaUrl(
  imageName: string | null | undefined,
  gradient: string | undefined,
): { url: string; background: string } {
  if (imageName && imageName.trim()) return { url: resolveFileUrl(imageName), background: gradient ?? '' }
  return { url: PLACEHOLDER, background: gradient ?? 'linear-gradient(160deg,#122C3E,#0B1D2A)' }
}

export interface ParsedVideo {
  type: 'youtube' | 'vimeo' | 'html5'
  src: string
  embedUrl: string
}

export function isVideoFile(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.trim().toLowerCase()
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.avi') ||
    lower.endsWith('.mkv') ||
    isStoredFileName(url)
  )
}

export function parseVideoSource(rawUrl: string | null | undefined): ParsedVideo {
  if (!rawUrl || !rawUrl.trim()) {
    return { type: 'html5', src: '', embedUrl: '' }
  }
  const trimmed = rawUrl.trim()

  // 1. YouTube
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
  )
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: 'youtube',
      src: trimmed,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
    }
  }

  // 2. Vimeo
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i,
  )
  if (vimeoMatch && vimeoMatch[3]) {
    const videoId = vimeoMatch[3]
    return {
      type: 'vimeo',
      src: trimmed,
      embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
    }
  }

  // 3. Stored attachment name or direct video URL
  const resolved = resolveFileUrl(trimmed, '')
  return {
    type: 'html5',
    src: resolved,
    embedUrl: resolved,
  }
}
