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
const PREVIEW = 1280;

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
    // preview for the next screen: small, the full canvas goes to recognition only
    const pk = Math.min(1, PREVIEW / Math.max(bmp.width, bmp.height));
    const pv = document.createElement("canvas");
    pv.width = Math.round(bmp.width * pk);
    pv.height = Math.round(bmp.height * pk);
    pv.getContext("2d")!.drawImage(bmp, 0, 0, pv.width, pv.height);
    bmp.close();
    emit("photo", { canvas, url: pv.toDataURL("image/jpeg", 0.8) });
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

    <!-- the whole viewfinder is the camera button -->
    <label class="frame" :class="{ busy }">
      <span class="shine" />
      <div class="corners"><span /><span /><span /><span /></div>
      <div class="center">
        <span class="lens"><Icon name="camera" :size="40" :width="1.75" /></span>
        <b>{{ busy ? "Bild wird geladen…" : "Foto aufnehmen" }}</b>
        <small>Das ganze Schloss ins Bild</small>
      </div>
      <input type="file" accept="image/*" capture="environment" :disabled="busy" @change="onFile" />
    </label>

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
      <label class="btn secondary">
        <Icon name="photo" :size="18" />Aus Mediathek
        <input type="file" accept="image/*" :disabled="busy" @change="onFile" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.frame {
  display: block;
  cursor: pointer;
  position: relative;
  /* hero + tips sit centred between header and footer */
  margin: auto 16px 0;
  height: 400px;
  max-height: 48dvh;
  border-radius: 24px;
  overflow: hidden;
  background: var(--head-text);
  color: var(--dark);
  box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.6);
  transition: transform 140ms var(--spring);
  animation: rise 500ms ease-out 100ms both;
}
.frame:active {
  transform: scale(0.97);
}
.frame.busy {
  opacity: 0.6;
}
.corners {
  position: absolute;
  inset: 24px;
  animation: breathe 2.6s ease-in-out infinite;
}
.corners span {
  position: absolute;
  width: 38px;
  height: 38px;
  border: 0 solid var(--dash);
}
.corners span:nth-child(1) {
  left: 0;
  top: 0;
  border-width: 3px 0 0 3px;
  border-top-left-radius: 14px;
}
.corners span:nth-child(2) {
  right: 0;
  top: 0;
  border-width: 3px 3px 0 0;
  border-top-right-radius: 14px;
}
.corners span:nth-child(3) {
  left: 0;
  bottom: 0;
  border-width: 0 0 3px 3px;
  border-bottom-left-radius: 14px;
}
.corners span:nth-child(4) {
  right: 0;
  bottom: 0;
  border-width: 0 3px 3px 0;
  border-bottom-right-radius: 14px;
}
.shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  background: rgba(255, 255, 255, 0.7);
  animation: shine 2.8s ease-in-out 1.4s infinite;
  pointer-events: none;
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
  white-space: nowrap;
}
.lens {
  width: 88px;
  height: 88px;
  margin-bottom: 10px;
  border-radius: 44px;
  background: var(--cta);
  color: var(--head-text);
  display: grid;
  place-items: center;
  animation: ring-dark 2.2s ease-out 1s infinite;
}
@keyframes ring-dark {
  0% {
    box-shadow: 0 0 0 0 rgba(36, 55, 43, 0.45);
  }
  100% {
    box-shadow: 0 0 0 18px rgba(36, 55, 43, 0);
  }
}
.center b {
  font-size: 24px;
}
.center small {
  font-size: 14px;
  color: var(--muted);
}
.tips {
  padding: 22px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tip {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 15px;
  line-height: 1.4;
  animation: rise 500ms ease-out 300ms both;
}
.tip + .tip {
  animation-delay: 450ms;
}
.ok {
  width: 30px;
  height: 30px;
  border-radius: 10px;
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
  margin-top: auto;
  padding-top: 16px;
}
label.btn {
  cursor: pointer;
  animation: rise 500ms ease-out 600ms both;
}
label input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
