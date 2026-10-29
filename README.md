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


## Ground-level exploration — phase 1

The **Ground view** control opens a north-facing surface preview at Jezero Base. Use **Return to globe** to restore the orbital view. This first pass is a camera and interface prototype: the nearby terrain and rocks are procedural visual placeholders, not high-resolution MOLA data or a surveyed reconstruction of Jezero. Planned follow-on phases are camera panning, movement along designated paths, and free roaming.


## Wider Solar System and rival expeditions

The first crew arrives in July 2027 after an eight-month transfer. The transfer vehicle remains in Mars orbit as a return vehicle and emergency refuge. The scenario includes six schematic Mars communications relays, legacy orbiters, and three robotic surface missions, a weather orbiter, a robotic Phobos survey package, Earth-side deep-space network infrastructure, a modestly expanded ISS logistics/assembly facility, and a lunar communications relay. These are explicit mild alternate-history assumptions, not claims about real-world 2026 infrastructure. The game currently represents Earth–Mars one-way communications delay as an illustrative ~12.5 minutes; actual light-time varies with orbital geometry.

Thirteen additional shortlisted landing areas are points of interest, distinct from the five player-selectable starting sites. Three pre-positioned sponsor cargo drops are scheduled to land at different sites before the first year ends. These are cargo-only events, not rival crewed colonies.

Rival sponsors observe the first colony for at least 60 sols, assess whether the crew and infrastructure appear to be surviving, then wait for a represented Earth–Mars launch opportunity and an approximately 240-sol (eight-month) cruise. The transfer-window cycle is currently an approximate 780 sols, not an ephemeris-driven orbital calculation. Consequently, under normal conditions no rival crewed colony should be established during the first 365 sols. The relay/vehicle points of interest have stable IDs and status fields to support future hacking, disabling, or destruction systems.


## Material accounting — first implementation

Campaign start now creates explicit water-equivalent inventories for atmospheric vapour, surface ice, subsurface ice, groundwater, surface liquid water and hydrated minerals, plus separate colony tanks, process water, humidity and wastewater stores. All water stocks are measured in kilograms. The colony's older abstract water stock is bridged at 1,000 kg per legacy economy unit so existing UI and project costs continue to work while the model transitions.

The first material ledger supports explicit water transfers. Daily use moves water from colony tanks to wastewater; the pilot extractor transfers 35,000 kg from the planetary subsurface-ice reservoir to colony tanks only when that source contains sufficient stock. A conservation diagnostic compares the sum of planetary and colony water inventories with the initial total and recorded external imports/exports. This is a foundation, not yet a complete chemistry model: recycling, atmospheric escape, condensation/sublimation between reservoirs, and hydrogen/oxygen chemistry are not yet implemented, and the diagnostics currently balance total water mass rather than hydrogen and oxygen atoms through every compound.

The model also adds a continuous, planet-wide meteoroid mass input from the first sol. It uses an approximate published estimate of 29,600 tonnes per Earth year, converted to the campaign's Martian-sol calendar, and records that material separately from water. The estimate is uncertain and mostly represents fine material; the game does **not** assume that incoming meteoroids are water or that all incoming material becomes locally mineable regolith. A separate global counter accumulates an estimated 320 new craters larger than 8 m per Earth year (about 280–360 in a 2024 seismology-based estimate). This is a global background rate, not yet a spatial impact simulation or a player-directed asteroid event. See the [micrometeoroid influx estimate](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019JE006005) and the [Mars impact-rate study](https://www.nature.com/articles/s41550-024-02301-z).

The initial planetary water reservoir values are scenario-scale placeholders with confidence labels, not precise scientific estimates. They must not be treated as a calibrated Mars water inventory. The next steps are to model phase changes and escape as transfers, add explicit external imports (including directed ice-bearing bodies), and track hydrogen and oxygen through water electrolysis, storage and recombination before extending conservation accounting to other elements.
