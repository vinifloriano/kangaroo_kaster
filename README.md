# 🦘 Kangaroo Kaster

**The most powerful caster app ever built.** Professional mixer, virtual audio devices, soundboard, and broadcast tools — all in one stunning interface.

---

## ✨ Features

### 🎛️ Professional Audio Mixer
- **6+ independent channels** — Microphone, Desktop, Browser, Music, Discord, Game, and custom sources
- **Per-channel DSP** — Parametric EQ (10-band), Compressor, Noise Gate, De-Esser, and Limiter
- **Real-time peak metering** — Color-coded VU meters with peak hold, RMS, and LUFS display
- **Mute / Solo / Link** — Instantly isolate or silence channels; link stereo pairs
- **Mix-Minus support** — Prevent echo by excluding specific sources from outputs
- **VST3 plugin host** — Load third-party audio plugins directly into the chain
- **Sub-2ms latency** — ASIO and WASAPI exclusive mode for professional timing
- **Master bus processing** — Master limiter and loudness normalization

### 🔌 Virtual Audio Devices
- **Unlimited virtual cables** — Create as many virtual input/output devices as needed
- **Visual routing matrix** — Drag-and-drop node-based audio routing graph
- **Per-app audio capture** — Capture audio from specific applications
- **Automatic sample rate conversion** — 44.1kHz / 48kHz / 96kHz handled seamlessly
- **Separate monitor mix** — Different headphone mix from stream mix
- **Stream + Recording split** — Different audio mixes for stream vs. local recording
- **Loopback prevention** — Intelligent feedback detection
- **Zero-install driver** — Kernel-level driver installs silently with the app

### 🎵 Smart Soundboard
- **500+ built-in sounds** — Applause, air horn, drum rolls, transitions, stingers, and more
- **16-pad grid layout** — Color-coded pads with waveform previews
- **Hotkey bindings** — Assign any keyboard shortcut or Stream Deck button
- **Per-pad volume & routing** — Control individual pad volume and output device
- **Custom sound import** — Drag-and-drop WAV, MP3, OGG, FLAC files
- **Category browser** — Favorites, Animals, Comedy, Sci-Fi, Sports, Musical, and 15+ categories
- **Overlap & Queue modes** — Stack sounds or play them sequentially
- **Live waveform display** — Real-time animation while sounds play

### 🚀 Additional Features
- **Scene manager** — Multi-layer scenes with drag-and-drop composition
- **Multi-platform casting** — Twitch, YouTube, Kick, Facebook, and custom RTMP
- **GPU-accelerated engine** — NVENC, AMF, QSV hardware encoding up to 4K 60fps
- **Unified chat panel** — Manage chat from all platforms in one place
- **Custom titlebar** — Frameless, draggable window with native window controls

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Electron](https://www.electronjs.org/) 33 |
| **Build Tool** | [electron-vite](https://electron-vite.org/) |
| **Frontend** | [React](https://react.dev/) 19 + TypeScript 5 |
| **Styling** | [TailwindCSS](https://tailwindcss.com/) 3.4 |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Testing** | [Vitest](https://vitest.dev/) + Testing Library |
| **Linting** | ESLint + Prettier |

---

## 📦 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repo
git clone https://github.com/vinifloriano/kangaroo-kaster.git
cd kangaroo-kaster

# Install dependencies
npm install
```

### Development

```bash
# Start in dev mode with hot-reload
npm run dev
```

### Build

```bash
# Build for current platform
npm run build

# Build platform-specific packages
npm run build:mac     # macOS .dmg
npm run build:win     # Windows .exe (NSIS)
npm run build:linux   # Linux AppImage
```

### Other Commands

```bash
# Lint
npm run lint

# Format
npm run format

# Run tests
npm test

# Preview production build
npm run preview
```

---

## 📂 Project Structure

```
kangaroo_kaster/
├── src/
│   ├── main/              # Electron main process
│   │   └── index.ts       # Window creation, IPC, app lifecycle
│   ├── preload/           # Context bridge
│   │   ├── index.ts       # Exposed APIs
│   │   └── index.d.ts     # Type declarations
│   └── renderer/          # React UI
│       ├── index.html      # HTML entry point
│       └── src/
│           ├── main.tsx    # React root
│           ├── App.tsx     # Layout + routing
│           ├── index.css   # TailwindCSS + global styles
│           ├── components/
│           │   ├── Titlebar.tsx
│           │   └── Sidebar.tsx
│           └── pages/
│               ├── MixerPage.tsx
│               ├── VirtualDevicesPage.tsx
│               ├── SoundboardPage.tsx
│               └── SettingsPage.tsx
├── resources/             # App icons (icns, ico, png)
├── landing_page/          # Marketing landing page
├── tests/                 # Vitest test files
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 📄 License

ISC © Vinicius Floriano
