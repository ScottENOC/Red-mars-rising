# Red Mars Rising

A browser-based Mars strategy/simulation game exploring the social, political, scientific and ecological choices of humanity's arrival on Mars.

## Prototype 001 — The untouched world

The opening prototype is a pre-arrival Mars atlas:

- A textured 3D globe with drag-to-rotate controls.
- Pinch and wheel zoom, plus on-screen zoom/reset controls.
- A flat global surface map with clickable landmark pins.
- Optional latitude/longitude grid and landmark markers.
- Six notable places to focus on: Olympus Mons, Valles Marineris, Hellas Planitia, Gale Crater, the north polar cap and Jezero Crater.
- Responsive layouts for phones and desktop.

## Code structure

- `index.html` is the page shell and styling; application logic lives in ES modules.
- `src/main.js` wires up the prototype interface and Three.js scene.
- `src/world/world-state.js` defines scenario-owned initial conditions, including polar ice extent, climate metadata, celestial bodies and an event log.
- `src/world/terrain.js` loads NASA MOLA MEGDR global topography at 4 pixels per degree (when the source is reachable), converts measured elevations in metres to globe radius without vertical exaggeration, and retains procedural relief as a fallback. Polar ice is rendered from world state and follows the active terrain surface.

The current polar caps are **initial scenario values**, not permanent geometry. Changing a cap's `extentDeg` in world state and calling `updatePolarCaps` rebuilds its visible footprint; setting it to zero removes it. Climate simulation and persistent geological deformation are not implemented yet. The globe starts with procedural fallback terrain, then attempts to load NASA's official MOLA MEGDR 4-pixel-per-degree global topography grid. If the data host blocks browser access or the request fails, the prototype keeps the approximate fallback; successful loading has not yet been confirmed in a browser.

## Run it

Open `index.html` through GitHub Pages or a local web server. The globe uses Three.js from jsDelivr and loads the Mars surface texture from Solar System Scope, so the first view requires an internet connection.

## Asset attribution

The Mars surface texture is from [Solar System Scope](https://www.solarsystemscope.com/textures/), based on NASA elevation and imagery data, used under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). The original asset is retained unchanged. At load time, `src/main.js` creates a derived canvas texture that suppresses bright, low-chroma pixels in the high-latitude regions where the atlas has baked-in polar ice. A temporary diagnostic flag, `SHOW_GENERATED_POLAR_CAPS` in `src/main.js`, is currently `false` so the generated cap meshes are hidden while the underlying texture cleanup is inspected; set it to `true` to restore them. This is a pragmatic visual cleanup, not a reconstruction of the terrain hidden beneath the real caps, and should be replaced or calibrated against a suitable ice-free reference dataset when one is selected. The source texture's colours are artistically adjusted by its creator; it is a visual atlas texture, not a scientific elevation layer.

## Development workflow

Work on the `development` branch. Keep `main` for approved releases.
