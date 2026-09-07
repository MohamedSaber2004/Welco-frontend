import { computed, ref } from 'vue'

class RequestTracker {
  private pending = ref(0)

  readonly isLoading = computed(() => this.pending.value > 0)

  begin(): void {
    this.pending.value += 1
  }

  settle(): void {
    this.pending.value = Math.max(0, this.pending.value - 1)
  }
}

export const requestTracker = new RequestTracker()
