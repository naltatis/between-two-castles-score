import { createApp } from "vue";
// fonts are bundled: content blockers on phones drop fonts.googleapis.com
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import "@fontsource/figtree/latin-ext-400.css";
import "@fontsource/figtree/latin-ext-600.css";
import "@fontsource/figtree/latin-ext-700.css";
import "./style.css";
import App from "./App.vue";

createApp(App).mount("#app");

if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
