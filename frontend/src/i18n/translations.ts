// OverView i18n — ONLY descriptive / informative / legal / AI text is translated.
// UI base terms and proprietary names (Home, Profile, Save, Share, Publish, Search,
// Discover, Privacy, Audio, Control Center, Observe, Pulse, SenseShot, SnapSense,
// Live Sense, Pure Sense, Reality Sense, Go There, Sense Vision, OverView Guide…)
// stay in universal English in BOTH languages and are NOT in this dictionary.

export type Lang = "it" | "en";

export const translations: Record<string, { it: string; en: string }> = {
  // Control Center
  "cc.subtitle": {
    it: "Il centro di controllo di OverView — come funziona l'app.",
    en: "OverView's control center — how the app works.",
  },
  "cc.group.you": { it: "Tu", en: "You" },
  "cc.group.experience": { it: "Esperienza", en: "Experience" },
  "cc.group.system": { it: "Sistema", en: "System" },
  "cc.group.support": { it: "Supporto", en: "Support" },
  "cc.account.sub": { it: "Profilo, username, bio, immagine, livelli, statistiche.", en: "Profile, username, bio, image, levels, stats." },
  "cc.language.sub": { it: "Scegli la lingua dei contenuti descrittivi.", en: "Choose the language of descriptive content." },
  "cc.privacy.sub": { it: "Profilo, posizione, Go There, autorizzazioni, blocchi.", en: "Profile, location, Go There, permissions, blocks." },
  "cc.notifications.sub": { it: "Observe, Pulse, SenseShot, DM, Observe World.", en: "Observe, Pulse, SenseShot, DM, Observe World." },
  "cc.discover.sub": { it: "Preferenze algoritmo, interessi, categorie preferite.", en: "Algorithm preferences, interests, favorite categories." },
  "cc.audio.sub": { it: "Volume, riproduzione automatica, musica, vocali.", en: "Volume, autoplay, music, voice messages." },
  "cc.sensevision.sub": { it: "Preferenze fotocamera, qualità, layer, AI, Sense DNA.", en: "Camera preferences, quality, layers, AI, Sense DNA." },
  "cc.memory.sub": { it: "Cache, download, spazio occupato, pulizia dati.", en: "Cache, downloads, storage used, data cleanup." },
  "cc.security.sub": { it: "Face ID, Touch ID, PIN, dispositivi, sessioni.", en: "Face ID, Touch ID, PIN, devices, sessions." },
  "cc.data.sub": { it: "Consensi, permessi, raccolta dati, backup, esportazione.", en: "Consents, permissions, data collection, backup, export." },
  "cc.feedback.sub": { it: "Suggerimenti, bug, beta, contatta OverView.", en: "Suggestions, bugs, beta, contact OverView." },
  "cc.info.sub": { it: "Versione, licenze, credits, team, privacy, termini.", en: "Version, licenses, credits, team, privacy, terms." },
  "cc.console.sub": { it: "Debug, log, strumenti avanzati.", en: "Debug, logs, advanced tools." },
  "cc.comingSoon": { it: "Presto disponibile", en: "Coming soon" },

  // Language screen
  "lang.title.sub": { it: "L'interfaccia base resta in inglese universale. Cambia solo il testo descrittivo, informativo, legale e le risposte AI.", en: "The base interface stays in universal English. Only descriptive, informative, legal text and AI replies change." },
  "lang.italian": { it: "Italiano", en: "Italian" },
  "lang.english": { it: "Inglese", en: "English" },
  "lang.changed": { it: "Lingua aggiornata.", en: "Language updated." },

  // Audio settings
  "audio.autoplay": { it: "Riproduzione automatica", en: "Autoplay" },
  "audio.autoplay.sub": { it: "Avvia musica e vocali automaticamente nel feed.", en: "Start music and voice automatically in the feed." },
  "audio.muted": { it: "Avvia in muto", en: "Start muted" },
  "audio.muted.sub": { it: "I contenuti partono senza audio finché non tocchi.", en: "Content starts silent until you tap." },
  "audio.voice.sub": { it: "Riproduci i messaggi vocali degli autori.", en: "Play authors' voice messages." },

  // Memory
  "memory.cache.sub": { it: "Immagini e dati temporanei salvati sul dispositivo.", en: "Temporary images and data stored on device." },
  "memory.clear": { it: "Pulisci cache", en: "Clear cache" },
  "memory.cleared": { it: "Cache pulita.", en: "Cache cleared." },

  // Sense Vision prefs
  "sv.quality.sub": { it: "Massima qualità nativa (HDR/Deep Fusion) quando disponibile.", en: "Maximum native quality (HDR/Deep Fusion) when available." },
  "sv.autolayer.sub": { it: "Attiva automaticamente i Sense Layer consigliati per il soggetto.", en: "Auto-enable the recommended Sense Layers for the subject." },
  "sv.ai.sub": { it: "Spiegazione AI automatica dopo ogni Sense (mai dati inventati).", en: "Automatic AI explanation after each Sense (never invented data)." },

  // Contextual example from the user's brief
  "sky.hidden.title": { it: "Sky Hidden", en: "Sky Hidden" },
  "sky.hidden.desc": { it: "Il cielo non è visibile nella scena attuale. Punta lo smartphone verso l'alto.", en: "The sky is not visible in the current scene. Point your phone upward." },
};
