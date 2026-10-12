<script setup lang="ts">
import { ref } from "vue";
import Icon from "../components/Icon.vue";

defineProps<{ title: string; sub: string }>();
const emit = defineEmits<{
  back: [];
  photo: [p: { canvas: HTMLCanvasElement; url: string }];
}>();

const busy = ref(false);
const error = ref("");
const MAX = 4000;

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  busy.value = true;
  error.value = "";
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    emit("photo", { canvas, url: canvas.toDataURL("image/jpeg", 0.85) });
  } catch {
    error.value = "Bild konnte nicht gelesen werden.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="screen dark">
    <div class="bar">
      <button type="button" class="icon-btn" aria-label="Zurück" @click="emit('back')">
        <Icon name="back" :size="22" />
      </button>
      <div class="grow">
        <div class="h title">{{ title }}</div>
        <div class="sub">{{ sub }}</div>
      </div>
    </div>

    <div class="frame">
      <div class="dashed" />
      <div class="center">
        <Icon name="focus" :size="40" :width="1.5" />
        <div>Ganzes Schloss in den Rahmen</div>
      </div>
    </div>

    <div class="tips">
      <div class="tip">
        <span class="ok"><Icon name="check" :size="16" :width="2.5" /></span>
        <div><b>Dunkler Tisch, gleichmäßiges Licht.</b> Schatten vom eigenen Arm vermeiden.</div>
      </div>
      <div class="tip">
        <span class="ok"><Icon name="check" :size="16" :width="2.5" /></span>
        <div><b>Drehung ist egal.</b> Der Thronsaal legt fest, wo oben ist.</div>
      </div>
      <div v-if="error" class="err">{{ error }}</div>
    </div>

    <div class="foot">
      <label class="btn light" :class="{ busy }">
        <Icon name="camera" :size="22" />{{ busy ? "Bild wird geladen…" : "Foto aufnehmen" }}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          :disabled="busy"
          @change="onFile"
        />
      </label>
      <label class="btn secondary">
        <Icon name="photo" :size="18" />Aus Mediathek
        <input type="file" accept="image/*" :disabled="busy" @change="onFile" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.frame {
  position: relative;
  margin: 8px 16px 0;
  height: 400px;
  max-height: 45dvh;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
}
.dashed {
  position: absolute;
  inset: 28px;
  border: 2px dashed rgba(244, 241, 228, 0.75);
  border-radius: 12px;
}
.center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.tips {
  flex: 1;
  padding: 20px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tip {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 15px;
  line-height: 1.35;
}
.ok {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--green);
  color: #fff;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.err {
  color: var(--orange);
  font-weight: 600;
}
.foot {
  padding-top: 16px;
}
label.btn {
  cursor: pointer;
}
label.btn.busy {
  opacity: 0.6;
}
label input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
