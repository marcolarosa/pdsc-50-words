"use strict";

import "core-js/stable";
import "regenerator-runtime/runtime";

import Vue from "vue";
import ElementUI from "element-ui";
import locale from "element-ui/lib/locale/lang/en";
import VueScrollTo from "vue-scrollto";
import VueAnalytics from "vue-analytics";
Vue.use(ElementUI, { locale });
Vue.use(VueScrollTo);

import App from "components/app.vue";
import { router } from "./routes";
import { store } from "store";

const isProd = process.env.NODE_ENV === "production";
Vue.use(VueAnalytics, {
    id: "UA-36256674-2",
    router,
    debug: {
        isProd: !isProd,
        sendHitTask: isProd
    }
});
App.router = router;
App.store = store;
const app = new Vue(App);
