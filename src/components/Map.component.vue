<template>
    <div>
        <div id="map" class="style-map"></div>
        <div class="style-map-reset">
            <el-button type="default" @click="centerMap" size="mini" class="style-reset-button">
                <i class="fas fa-crosshairs style-reset-button-image"></i>
            </el-button>
        </div>
    </div>
</template>

<script>
import styles from "assets/variables.scss";
import Vue from "vue";
import ElementUI from "element-ui";
import locale from "element-ui/lib/locale/lang/en";
import RenderWordComponent from "components/RenderWord.component.vue";
import AudioPlayerControl from "./AudioPlayerControl.component.vue";
Vue.use(ElementUI, { locale });
import mapboxgl from "mapbox-gl";
mapboxgl.accessToken =
    "pk.eyJ1IjoibWFyY29sYXJvc2EiLCJhIjoiY2p2NGhzMzFkMnFsbzQwandhNmJ2MWI2eCJ9.qxu6U_HfPFd-4BZ85eNCvw";
import { throttle, map, orderBy } from "lodash";

export default {
    components: {
        RenderWordComponent,
        AudioPlayerControl
    },
    data() {
        return {
            watchers: {},
            map: undefined,
            popup: undefined,
            mediaElement: {
                audio: false,
                video: false,
                files: []
            }
        };
    },
    computed: {
        words: function() {
            return this.$store.state.selectedWord;
        },
        show: function() {
            return this.$store.state.show;
        },
        selectedLanguage: function() {
            return this.$store.state.selectedLanguage;
        },
        selectedWord: function() {
            return this.$store.state.selectedWord;
        },
        playAll: function() {
            return this.$store.state.playAll;
        }
    },
    mounted() {
        this.renderMap();
        this.watchers.words = this.$watch("words", d => {
            if (d) {
                this.renderWordLayer();
            } else {
                this.renderLanguageLayer();
            }
        });
        this.watchers.words = this.$watch("playAll", this.playAllWords);
    },

    beforeMount() {
        window.addEventListener("resize", throttle(this.centerMap, 300));
    },
    beforeDestroy() {
        this.watchers.words();
        window.removeEventListener("resize", this.centerMap);
    },
    methods: {
        centerMap() {
            if (this.popup) this.popup.remove();
            this.map.fitBounds([[96, -45], [168, -8]]);
        },
        renderMap() {
            this.map = new mapboxgl.Map({
                container: "map",
                style: "mapbox://styles/mapbox/dark-v10",
                center: [0, 0]
            });
            this.map.addControl(
                new mapboxgl.NavigationControl({
                    showCompass: false
                })
            );
            // this.map.addControl(new mapboxgl.FullscreenControl());
            this.centerMap();
            this.map.on("load", () => {
                this.renderLanguageLayer();
            });
            this.map.on("click", "languages", e => {
                this.$store.commit("setSelectedLanguage", {
                    ...e.features[0].properties
                });
            });
            this.map.on("click", "words", e => {
                if (this.popup) this.popup.remove();
                const RenderWordClass = Vue.extend(RenderWordComponent);
                this.popup = new mapboxgl.Popup({ maxWidth: "none" })
                    .setLngLat(e.lngLat)
                    .setHTML('<div id="vue-popup-content"></div>')
                    .addTo(this.map);
                const properties = e.features[0].properties;
                if (properties.audio)
                    properties.audio = JSON.parse(properties.audio);
                if (properties.video)
                    properties.video = JSON.parse(properties.video);
                properties.language = JSON.parse(properties.language);
                const popupInstance = new RenderWordClass({
                    propsData: {
                        layout: "popup",
                        word: { properties }
                    }
                });
                popupInstance.$mount("#vue-popup-content");
                this.popup._update();
            });
            // Change the cursor to a pointer when the mouse is over the places layer.
            this.map.on("mouseenter", "languages", () => {
                this.map.getCanvas().style.cursor = "pointer";
            });

            // Change it back to a pointer when it leaves.
            this.map.on("mouseleave", "languages", () => {
                this.map.getCanvas().style.cursor = "";
            });
        },
        renderLanguageLayer() {
            if (this.popup) this.popup.remove();
            if (this.map.getLayer("words"))
                this.map.setLayoutProperty("words", "visibility", "none");

            let languages = this.$store.state.languages.filter(l => !l.words);
            renderLanguagesWithoutData({
                languages: this.$store.state.languages,
                map: this.map
            });
            renderLanguagesWithData({
                languages: this.$store.state.languages,
                map: this.map
            });
            this.map.setLayoutProperty("languages", "visibility", "visible");
            this.map.setLayoutProperty(
                "languagesWithoutData",
                "visibility",
                "visible"
            );

            function renderLanguagesWithData({ languages, map }) {
                const features = languages.filter(l => l.properties.words);
                if (!map.getLayer("languages")) {
                    map.addLayer({
                        id: "languages",
                        type: "symbol",
                        source: {
                            type: "geojson",
                            data: {
                                type: "FeatureCollection",
                                features
                            }
                        },
                        paint: {
                            "text-color": styles.textColor
                        },
                        layout: {
                            visibility: "visible",
                            "text-field": "{name}",
                            "text-size": 15,
                            "text-max-width": 40,
                            "text-allow-overlap": true,
                            "icon-allow-overlap": true
                        }
                    });
                }
            }

            function renderLanguagesWithoutData({ languages, map }) {
                const features = languages.filter(l => !l.properties.words);
                if (!map.getLayer("languagesWithoutData")) {
                    map.addLayer({
                        id: "languagesWithoutData",
                        type: "symbol",
                        source: {
                            type: "geojson",
                            data: {
                                type: "FeatureCollection",
                                features
                            }
                        },
                        paint: {
                            "text-color": styles.primaryColor,
                            "text-opacity": 0.4
                        },
                        layout: {
                            visibility: "visible",
                            "text-field": "{name}",
                            "text-size": 15,
                            "text-max-width": 40,
                            "text-allow-overlap": true,
                            "icon-allow-overlap": true
                        }
                    });
                }
            }
        },
        renderWordLayer() {
            if (this.popup) this.popup.remove();
            this.map.setLayoutProperty("languages", "visibility", "none");
            this.map.setLayoutProperty(
                "languagesWithoutData",
                "visibility",
                "none"
            );
            if (!this.words) return;

            if (!this.map.getLayer("words")) {
                this.map.addSource("words", {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: this.words }
                });
                this.map.addLayer({
                    id: "words",
                    type: "symbol",
                    source: "words",
                    paint: {
                        "text-color": styles.textColor
                    },
                    layout: {
                        "text-field": "{indigenous}",
                        "text-size": 15,
                        "text-max-width": 40,
                        "text-allow-overlap": true,
                        "icon-allow-overlap": true,
                        "text-variable-anchor": [
                            "top",
                            "bottom",
                            "left",
                            "right"
                        ]
                    }
                });
            } else {
                this.map.getSource("words").setData({
                    type: "FeatureCollection",
                    features: this.words
                });
            }
            this.map.setLayoutProperty("words", "visibility", "visible");
        },
        async playAllWords() {
            var self = this;
            if (!self.$store.state.playAll.play) cleanup();

            // kick off
            if (
                self.$store.state.playAll.play &&
                self.$store.state.playAll.word
            ) {
                self.map.once("moveend", renderPopup);
                flyToWord({ word: self.$store.state.playAll.word });
            }

            async function flyToWord({ word }) {
                if (self.popup) self.popup.remove();
                console.log(`Flying to: ${word.properties.indigenous}`);
                self.map.flyTo({
                    center: word.geometry.coordinates,
                    zoom: window.innerwidth < 768 ? 8 : 6,
                    bearing: 0
                });
            }

            async function cleanup() {
                console.log("cleanup");
                if (self.popup) self.popup.remove();
                self.centerMap();
            }

            async function renderPopup() {
                // console.log("render popup");
                const word = self.$store.state.playAll.word;
                if (!word) return;

                const RenderWordClass = Vue.extend(RenderWordComponent);
                self.popup = new mapboxgl.Popup({ maxWidth: "none" })
                    .setLngLat(word.geometry.coordinates)
                    .setHTML('<div id="vue-popup-content"></div>')
                    .addTo(self.map);
                const popupInstance = new RenderWordClass({
                    propsData: {
                        layout: "popup",
                        word: word,
                        store: self.$store
                    }
                });
                popupInstance.$mount("#vue-popup-content");
                self.popup._update();
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.style-map {
    position: fixed;
    top: 0;
    left: 50px;
    width: calc(100vw - 50px);
    height: 100vh;
    cursor: pointer;
}

.style-map-reset {
    position: fixed;
    top: 130px;
    left: calc(100vw - 51px);
}

.style-reset-button {
    max-width: 8px;
    font-size: 12px;
}

.style-reset-button-image {
    margin-left: -6px;
}

@media (min-width: 768px) {
    .style-map-reset {
        position: fixed;
        top: 90px;
        left: calc(100vw - 41px);
    }
}

@media (min-width: 1024px) {
    .style-map-reset {
        position: fixed;
        top: 90px;
        left: calc(100vw - 51px);
    }
}
</style>

<style lang="scss">
@import "assets/variables.scss";

.mapboxgl-popup-tip {
    border-top-color: $primary-color !important;
}

.mapboxgl-popup-content {
    text-align: center;
    width: unset;
    padding: 15px 25px;
    font-size: 0.8em;
    background-color: $primary-color;
    white-space: nowrap;
}

.mapboxgl-popup-close-button {
    display: none;
}

.mapboxgl-ctrl-top-right {
    margin: 55px 10px 0 0;
}

@media (min-width: 768px) {
    .mapboxgl-ctrl-top-right {
        margin: 10px 0 0 0;
    }
    .mapboxgl-popup-content {
        text-align: center;
        font-size: 1.2em;
        background-color: $primary-color;
    }
}

@media (min-width: 1024px) {
    .mapboxgl-ctrl-top-right {
        margin: 10px 10px 0 0;
    }
    .mapboxgl-popup-content {
        text-align: center;
        font-size: 1.5em;
        background-color: $primary-color;
    }
}
</style>

