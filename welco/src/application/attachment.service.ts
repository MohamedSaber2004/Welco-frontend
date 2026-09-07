import { ref } from 'vue'
import type { AttachmentRepository } from '../domain/ports/attachment-repository'
import type {
  FileResponseDto,
  ReplaceFilePayload,
  UploadFilePayload,
  UploadMultiplePayload,
} from '../domain/models/attachment'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

export type AttachmentResult<T = string> = { ok: true; data: T } | { ok: false; error: string }

export class AttachmentService {
  readonly uploading = ref(false)
  readonly progress = ref(0)

  private readonly repo: AttachmentRepository

  constructor(repo: AttachmentRepository) {
    this.repo = repo
  }

  async upload(payload: UploadFilePayload): Promise<AttachmentResult> {
    this.begin()
    try {
      const data = await this.repo.uploadFile(payload, (p) => this.track(p))
      this.done()
      return { ok: true, data }
    } catch (err) {
      this.done()
      const error = err instanceof Error ? err.message : t('common.error')
      toastService.error(error)
      return { ok: false, error }
    }
  }

  /** Upload several files. Returns an array of stored names. */
  async uploadMultiple(payload: UploadMultiplePayload): Promise<AttachmentResult<string[]>> {
    this.begin()
    try {
      const data = await this.repo.uploadMultiple(payload, (p) => this.track(p))
      this.done()
      return { ok: true, data }
    } catch (err) {
      this.done()
      const error = err instanceof Error ? err.message : t('common.error')
      toastService.error(error)
      return { ok: false, error }
    }
  }

  /** Replace an existing stored file. Returns the new stored name — persist it. */
  async replace(payload: ReplaceFilePayload): Promise<AttachmentResult> {
    this.begin()
    try {
      const data = await this.repo.replaceFile(payload, (p) => this.track(p))
      this.done()
      return { ok: true, data }
    } catch (err) {
      this.done()
      const error = err instanceof Error ? err.message : t('common.error')
      toastService.error(error)
      return { ok: false, error }
    }
  }

  /** Fetch file metadata (MIME type, folder path). */
  async download(place: number, fileName: string): Promise<FileResponseDto | null> {
    try {
      return await this.repo.downloadFile(place, fileName)
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[attachment] download failed', err)
      return null
    }
  }

  private begin(): void {
    this.uploading.value = true
    this.progress.value = 0
  }

  private track(ratio: number): void {
    this.progress.value = ratio
  }

  private done(): void {
    this.uploading.value = false
    this.progress.value = 1
    setTimeout(() => {
      this.progress.value = 0
    }, 400)
  }
}
