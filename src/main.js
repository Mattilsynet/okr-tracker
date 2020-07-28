import Vue from 'vue';
import VueSelect from 'vue-select';
import Vuelidate from 'vuelidate';
import VueResize from 'vue-resize';
import VueScrollTo from 'vue-scrollto';
import ImageUploader from 'vue-image-upload-resize';
import Toasted from 'vue-toasted';
import VTooltip from 'v-tooltip';
import VueMeta from 'vue-meta';
import { firestorePlugin } from 'vuefire';

import App from '@/App.vue';
import router from '@/router';
import store from '@/store';
import i18n from '@/locale/i18n';

// import plugin styles
import 'vue-select/dist/vue-select.css';
import 'vue-resize/dist/vue-resize.css';
import '@fortawesome/fontawesome-free/css/all.css';

const fb = require('./config/firebaseConfig');

Vue.config.productionTip = false;

// Use plugins
Vue.use(Vuelidate);
Vue.use(VueResize);
Vue.use(Toasted, {
  position: 'bottom-right',
  className: 'toast',
});
Vue.use(VueScrollTo);
Vue.use(ImageUploader);
Vue.use(VTooltip);
Vue.use(VueMeta);
Vue.use(firestorePlugin);

// Global components
Vue.component('v-select', VueSelect);

Vue.config.productionTip = false;

// handle page reloads
let app;
fb.auth.onAuthStateChanged(user => {
  store.commit('SET_USER', user);

  if (!app) {
    app = new Vue({
      el: '#app',
      router,
      store,
      i18n,
      render: h => h(App),
    });
  }
});

export default { app };
