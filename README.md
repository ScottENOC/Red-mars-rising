# Red Mars Rising

A browser-based Mars strategy/simulation game exploring the social, political, scientific and ecological choices of humanity's arrival on Mars.

## Prototype 002 — The first settlement

The current prototype shows Mars at the arrival of humanity's first expedition, with a starter colony and a first pass at interplanetary logistics:

- A textured 3D globe with drag-to-rotate controls.
- Pinch and wheel zoom, plus on-screen zoom/reset controls.
- Optional latitude/longitude grid and landmark markers.
- Focusable landmarks plus the Jezero Base starter-colony location.
- A stylised colony surface layer with habitats, greenhouse, laboratory, workshop, solar arrays, landing pad, rover and local tracks, revealed at close zoom.
- A compressed interplanetary view that reveals Earth, inbound cargo ships and transfer trajectories at wide zoom. These are visual placeholders, not a physical ephemeris or calibrated transfer simulation.
- Responsive layouts for phones and desktop.

## Code structure

- `index.html` is the page shell and styling; application logic lives in ES modules.
- `src/main.js` wires up the prototype interface and Three.js scene.
- `src/world/world-state.js` defines scenario-owned initial conditions, including the initial population and infrastructure of Jezero Base, illustrative supply-ship manifests, separate residual polar deposits and seasonal frost, climate metadata, celestial bodies and an event log.
- `src/world/colony-logistics.js` renders the initial colony and zoom-dependent Earth-to-Mars cargo traffic. The colony is a visual prototype; project requirements, sponsor obligations and a working road network between multiple settlements are not implemented yet.
- `src/world/terrain.js` loads NASA MOLA MEGDR global topography at 4 pixels per degree (when the source is reachable), converts measured elevations in metres to globe radius without vertical exaggeration, and retains procedural relief as a fallback. Polar ice is rendered from world state and follows the active terrain surface.

Polar ice now has two distinct render layers: persistent residual deposits (north: water ice; south: water ice plus residual CO2) and seasonal CO2 frost. Seasonal frost expands in each hemisphere's winter and retreats toward its equinox using the mission clock's calculated solar longitude. This is a first-pass sinusoidal seasonal rule, not a calibrated climate model; its maximum extents and irregular outlines remain provisional visual approximations, not scientific boundary data. The southern seasonal cap is expected to be prominent near the July 2027 arrival, which occurs during southern winter. Climate simulation and persistent geological deformation are not implemented yet. The globe starts with procedural fallback terrain, then attempts to load NASA's official MOLA MEGDR 4-pixel-per-degree global topography grid. If the data host blocks browser access or the request fails, the prototype keeps the approximate fallback; successful loading has not yet been confirmed in a browser.

## Run it

Open `index.html` through GitHub Pages or a local web server. The globe uses Three.js from jsDelivr and loads the Mars surface texture from Solar System Scope, so the first view requires an internet connection.

## Asset attribution

The Mars surface texture is from [Solar System Scope](https://www.solarsystemscope.com/textures/), based on NASA elevation and imagery data, used under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). The original asset is retained unchanged. At load time, `src/main.js` creates a derived canvas texture that suppresses bright, low-chroma pixels in the high-latitude regions where the atlas has baked-in polar ice. The baked-in polar brightness is suppressed with a pragmatic visual cleanup, not a reconstruction of the terrain hidden beneath the real caps. The generated, state-driven residual caps and seasonal frost are enabled and normal solar lighting/shadows are restored. The texture cleanup and ice outlines should be calibrated against suitable scientific reference data before being treated as accurate. The source texture's colours are artistically adjusted by its creator; it is a visual atlas texture, not a scientific elevation layer.

## Development workflow

Work on the `development` branch. Keep `main` for approved releases.
