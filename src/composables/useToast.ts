import { ref } from 'vue'

export type ToastType = 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<ToastItem[]>([])
let nextToastId = 0

export function showToast(message: string, type: ToastType = 'success', duration = 2800): void {
  const id = ++nextToastId
  toasts.value = [...toasts.value, { id, message, type }]
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }, duration)
}

export function useToast() {
  return {
    toasts,
    showToast,
  }
}
