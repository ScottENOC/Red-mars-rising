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
- `src/world/material-inventories.js` defines planetary and colony material inventories, a water-transfer ledger, conservation diagnostics and continuous natural meteoroid influx.
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


## Conserved material accounting — in progress

The simulation now has a dedicated `src/world/material-inventories.js` module and an expandable **Material inventories & conservation** view in the colony operations panel. Planetary water is separated into atmospheric vapour, surface ice, subsurface ice, groundwater, surface liquid water and hydrated-mineral water-equivalent stocks. Colony water is held separately in tanks, process-water storage, habitat humidity and wastewater. Stocks are measured in kilograms, and transfers are recorded in a ledger. Initial reservoir sizes are explicitly labelled scenario estimates, not precise global measurements.

### Natural meteoroids and impactors

A natural background flux runs from the first simulated sol; it does not depend on player asteroid missions. The current micrometeoroid flux uses an estimate of **29,600 tonnes per Earth year entering Mars' atmosphere** from Tomkins et al. (2019). The model distinguishes incoming mass, an assumed 90% retained fraction, and mass ablated into the atmosphere. That retention fraction is a gameplay assumption, not a measured universal value.

The dust is split into six plausible compositional classes: carbonaceous chondrite, ordinary chondrite, enstatite chondrite, achondritic basaltic material, iron/stony-iron particles, and cometary/volatile-rich dust. Each class has a visible mass fraction, simplified component fractions and representative density. The class proportions are **scenario weights**, not a claim that this exact mixture has been measured at Mars. Silicates, iron-nickel material, sulfides, carbon-bearing material, other minerals and volatile-bearing components are tracked separately where represented. Water-bearing dust contributes water to atmospheric vapour and surface ice rather than turning into an abstract water bonus.

A separate global rate of 320 craters larger than 8 metres per Earth year is used as a central estimate from a recent Mars impact-rate study. The simulation now creates reproducible natural impactors with varying sizes and the same broad compositional classes, estimates their mass from spherical volume and class density, and records each impact in the material ledger. The model assigns deterministic global coordinates to natural impacts and renders the most recent 200 as clickable surface markers at surface-map zoom; it does not deform the terrain to form actual crater geometry. Ablated material is split into simplified products: solid/organic aerosols, CO₂ from volatile ice, other gases, and water vapour. Aerosols settle gradually into a mixed mineral-deposit stock. This is a first-pass mass allocation, not a detailed high-temperature ablation chemistry model.

Sources: [Tomkins et al. (2019), micrometeoroid flux and mineralogy](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019JE006005); [2024 Mars impact-rate study](https://www.nature.com/articles/s41550-024-02301-z).

### Water cycling, recycling and chemistry

- Water use moves 95% of used water into wastewater and 5% into habitat humidity. The recycling pass recovers 85% of wastewater and 95% of habitat humidity into tanks, recording separate electricity costs for treatment and condensation. Residual water remains in brine/humidity stocks rather than disappearing. The energy ledger records these costs, but they are not yet coupled to the colony's abstract power-capacity/demand UI.
- Each starting site receives a local accessible-ice sub-reservoir carved out of the global subsurface-ice stock, so it is not double-counted. Its initial size and extraction rate depend on site prospectivity. An ice survey improves confidence and extraction throughput; the extractor transfers only the amount the local stock and technology can supply.
- A first-pass climate cycle transfers water between surface liquid, surface ice and atmospheric vapour through evaporation, freezing, sublimation and condensation/deposition. A small atmospheric escape term is recorded as an external output. These rates are intentionally exposed as rough global scenario assumptions, not a calibrated local Mars climate model; surface temperatures and cold traps are not spatially resolved yet.
- `electrolyseWater` converts water into stoichiometric H₂ and O₂ mass stocks and records electricity use. `recombineHydrogenOxygen` converts those gases back into water and records released heat. Their system-energy values are provisional engineering assumptions.
- `importWater` supports explicit external water deliveries, so directed ice-bearing bodies can later add matter to a chosen reservoir through a recorded external input.

The diagnostics now include water-derived mass and hydrogen/oxygen balance checks, including stored H₂ and O₂. Reservoir updates use compensated summation so small transfers are less likely to disappear when applied to very large global stocks. Remaining tiny nonzero elemental residuals can still occur because JavaScript uses finite-precision floating-point numbers; they are surfaced rather than rounded away. Atmospheric pressure and broad gas fractions are now derived from the atmospheric mass inventory, including suspended meteoroid aerosols and water vapour. Ablated meteoroid mass is stored as atmospheric aerosol and gradually settles into a mineral-deposit stock. This is still not a complete elemental model: the exact chemical species produced by ablation, hydrated minerals, manufactured goods and biological stocks need to be linked into a unified ledger.

### Next implementation steps

1. Add elemental inventories and conservation across industrial processing, food, biomass, human metabolism and waste.
2. Refine atmospheric ablation chemistry and connect atmospheric composition changes to climate feedbacks.
3. Add geographic impact locations, crater formation and optional player-directed ice-rich asteroid missions.

