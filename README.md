# WebGPU Pointer Flow Tracker

Interactive pointer/touch fluid-style heat map using WebGPU compute shaders.

## Run locally

Because browsers restrict WebGPU + module imports on `file://`, serve this folder with a local web server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Controls

- **Desktop:** click + drag
- **Mobile:** touch + drag (multi-touch supported)

Touch pointers are rendered with warmer splats to mimic a thermal-fluid heat map feel.
