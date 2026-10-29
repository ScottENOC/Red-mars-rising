# Red Mars Rising

A browser-based Mars strategy/simulation game about the social, political, scientific and ecological choices of humanity's arrival on Mars. It is a new project, not a clone of *Surviving Mars*.

## Prototype 003 — Starting campaign and world ticks

The current development branch introduces the campaign start flow and the first sol-based simulation loop:

- Choose one of five starting sites: Elysium Planitia, Arcadia Planitia, Jezero Crater, Valles Marineris or Hellas Planitia.
- Choose a starting sponsor: NASA, ESA, Roscosmos, CNSA, a United Nations mission or one of six fictional multinational corporations.
- All sponsor blocs remain in the world. National sponsors start with different diplomatic relationships; corporate sponsors are more impatient; the UN is patient and autonomy-oriented but offers less direct support.
- Five years of expedition support are recorded in the campaign state. Starting location and sponsor affect the primary settlement, initial resources, strategic modifiers and political expectations.
- The campaign clock processes completed Martian sols. The tick updates colony operations, water use, morale, health, scientific work, project progress, sponsor patience/pressure, and the arrival of rival colonies.
- The colony operations panel lets the player commission a subsurface ice survey, regolith-shielded habitat, solar-array expansion or pilot water extractor. Costs are deducted when commissioned; construction progresses per sol and pauses during a power shortfall.
- Newly founded rival settlements are added to the map layer.
- A first-pass global energy budget accumulates human waste heat at full floating-point precision. There is no minimum-population threshold and no rounding of the energy contribution before it enters the model.

## Climate model caveat

The global heat response is an explicit **illustrative prototype**, not a calibrated Mars general-circulation model. Each colonist contributes an assumed 100 W of heat. The model divides this by Mars's surface area, integrates the energy over a sol, applies a simple radiative restoring term around the initial mean temperature, and stores the resulting temperature anomaly separately from the displayed baseline. That separate anomaly accumulator is important: a tiny but non-zero contribution is retained even when adding it directly to a temperature near −63 °C would fall below the floating-point precision of that absolute value.

For scale, one 100 W heat source spread over Mars corresponds to roughly 6.93 × 10⁻¹³ W/m², or an initial warming of about 6.15 × 10⁻¹⁵ °C per sol under the prototype's assumed effective heat capacity. This is non-zero, but extraordinarily small. Local heat concentration, atmospheric chemistry, greenhouse projects, ice stability, moisture transport and possible flooding are not yet spatially resolved or scientifically calibrated.

## Code structure

- `index.html` is the page shell and styling; application logic lives in ES modules.
- `src/main.js` wires up the Three.js scene, campaign selection, mission clock, operations panel and map interactions.
- `src/world/world-state.js` defines the scenario state, climate and energy-budget fields, initial resources, settlements, sponsor state and event log.
- `src/world/campaign-options.js` defines the five candidate landing sites, sponsor profiles and the campaign-start function.
- `src/world/world-tick.js` contains the sol-based simulation and project commissioning rules.
- `src/world/colony-logistics.js` renders settlement modules and zoom-dependent Earth-to-Mars cargo traffic. The interplanetary view compresses distance for readability; ship trajectories are illustrative, not a physical ephemeris.
- `src/world/terrain.js` loads NASA MOLA MEGDR global topography when the source is reachable and uses the terrain surface for the globe and polar ice layers.

## Run it

Open `index.html` through GitHub Pages or a local web server. The globe uses Three.js from jsDelivr and loads the Mars surface texture from Solar System Scope, so the first view requires an internet connection. The browser prototype has had JavaScript syntax and simulation smoke checks, but the full visual experience has not yet been verified in a live browser.

## Asset attribution

The Mars surface texture is from [Solar System Scope](https://www.solarsystemscope.com/textures/), based on NASA elevation and imagery data, used under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). The texture is an artistic atlas, not a scientific elevation layer.

## Development workflow

Work on the `development` branch. Keep `main` for approved releases.
