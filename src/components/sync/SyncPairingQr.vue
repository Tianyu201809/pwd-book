<script setup lang="ts">
import { ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  payload: string
}>()

const dataUrl = ref('')

async function renderQr(): Promise<void> {
  if (!props.payload.trim()) {
    dataUrl.value = ''
    return
  }

  dataUrl.value = await QRCode.toDataURL(props.payload, {
    margin: 1,
    width: 176,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f1419',
      light: '#ffffff',
    },
  })
}

watch(
  () => props.payload,
  () => {
    void renderQr()
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="dataUrl"
    class="pairing-qr"
  >
    <img
      :src="dataUrl"
      alt=""
      class="pairing-qr__image"
    >
  </div>
</template>

<style scoped>
.pairing-qr {
  display: flex;
  justify-content: center;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: #fff;
  border: 1px solid var(--border-default);
}

.pairing-qr__image {
  display: block;
  width: 176px;
  height: 176px;
  image-rendering: pixelated;
}
</style>
