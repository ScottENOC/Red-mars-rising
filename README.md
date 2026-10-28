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
- `src/world/terrain.js` contains the current procedural terrain approximation and renders polar ice from world state.

The current polar caps are **initial scenario values**, not permanent geometry. Changing a cap's `extentDeg` in world state and calling `updatePolarCaps` rebuilds its visible footprint; setting it to zero removes it. Climate simulation and persistent geological deformation are not implemented yet. Terrain is still a procedural visual approximation, not a measured elevation model.

## Run it

Open `index.html` through GitHub Pages or a local web server. The globe uses Three.js from jsDelivr and loads the Mars surface texture from Solar System Scope, so the first view requires an internet connection.

## Asset attribution

The Mars surface texture is from [Solar System Scope](https://www.solarsystemscope.com/textures/), based on NASA elevation and imagery data, used under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). The texture's colours are artistically adjusted by its creator; it is a visual atlas texture, not a scientific elevation layer.

## Development workflow

Work on the `development` branch. Keep `main` for approved releases.
