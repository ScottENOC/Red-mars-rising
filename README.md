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

## Strategic agency and industrial choices

The player manages colony-level priorities rather than assigning individual workers or micromanaging production queues. The colony reports dependencies, risks and uncertain opportunities; the player chooses which problems deserve funding and political attention.

The first strategic-priority prototype includes two contrasting programmes:

- **Investigate local component manufacturing** funds a 45-sol assessment of whether selected non-critical imported components could eventually be substituted using local feedstocks, polymer processing, metalworking and additive manufacturing. The current 60–80% substitution range is a low-confidence scenario estimate for a targeted category, not a measured result or a working factory. Processing, quality assurance and component qualification remain necessary.
- **Strengthen the sponsor cargo pipeline** funds a 25-sol effort focused on cargo handling, shipment coordination and sponsor confidence. This improves the modelled reliability score and sponsor standing, while retaining import dependence.
- **Accept dependence for now** is a valid choice: preserve funds and materials for other priorities while accepting exposure to shipment delays or interruptions.

Neither self-sufficiency nor dependence is treated as the universally correct strategy. The material simulation currently distinguishes local regolith, aggregate and metal-bearing concentrate, but does not yet manufacture qualified metal parts or finished construction components. These strategic initiatives are a first decision layer. The habitat project now has two explicit material recipes and a functional-component dependency report. Additional processing capabilities, recycling and explicit stockpile/transport constraints remain future work. The player expresses intent and accepts trade-offs while the colony handles routine execution.

## Alternative construction materials — first implementation

The regolith-shielded habitat project now offers two material recipes, selected at the strategic project level rather than by assigning individual workers:

- **Imported metal frame + local shielding:** 1,200 kg of imported construction components, plus 12,000 kg of local aggregate, 40 kg of polymers and 10 kg of spare parts. It takes 35 sols and has lower fabrication uncertainty, but relies more heavily on imported finished components.
- **Locally formed regolith shell + imported pressure liner:** 150 kg of imported pressure-liner/critical components, plus 18,000 kg of aggregate, 80 kg of polymers and 30 kg of spare parts. It takes 45 sols, uses less imported component mass, and has greater local process and quality-assurance risk. The regolith shell is explicitly non-pressure-bearing; the pressure boundary remains a qualified imported liner.

Both recipes check physical stock availability before commissioning. The workshop's illustrative 70% aggregate yield means the player may need to wait for local processing to build up enough aggregate before starting. On commissioning, local stocks are committed to construction-in-progress and imported components enter the colony matter ledger; on completion, that mass moves to installed construction stock. The inventory panel displays both quantities. These transitions are included in the colony matter accounting.

This is a first end-to-end example, not a universal construction system. The selected recipe charges the abstract funds/materials/machinery economy as well as checking and consuming kilogram stocks; those two cost systems are not reconciled. Material quality, component qualification, actual energy requirements, pressure-shell engineering, and construction waste/recycling are not yet simulated. The recipe yields, masses, durations and risk labels are prototype assumptions, not engineering design values.

The habitat component report separates the pressure boundary, primary structure, shielding, insulation/thermal control, and seals/ducts/fittings. It makes imported qualified hardware and unspecified requirements visible rather than treating a recipe as a complete engineering design. Some package masses are intentionally not allocated to individual components; the polymer and spare-parts inputs are generic allowances, not claims that they satisfy a particular component specification. The report links local-manufacturing assessment and cargo-pipeline status to the dependency picture, but the assessment does not unlock production. No material is treated as a qualified pressure liner, insulation system or seal merely because it is printable or locally available.

## Independent Martian colonies and political agency

Each settlement is modelled as a political actor distinct from its sponsor. Sponsor diplomacy provides a softened starting influence on inter-colony relations, but those relationships are stored on the colonies and can change independently. Colony state includes prototype indices for Martian identity, local autonomy, sponsor influence, political stability and cooperation, plus pairwise relationships with other colonies. These fields are migrated into older campaign saves when loaded.

The first playable diplomacy slice adds two player initiatives against an established rival colony: a joint scientific programme (20 funds; 90-sol cooldown) improves bilateral relations and cooperation, while support for Martian self-government (15 funds; 120-sol cooldown) increases local autonomy and Martian identity while reducing sponsor influence. Their effects are immediate model changes, not a scripted path to independence or pan-Martian unity. Political indices drift slowly over time, and a common Martian identity is only one possible outcome.

This is a foundation, not a full political simulation. The indices and drift rates are explicit prototype assumptions, not empirically calibrated forecasts. Internal factions, elections and leadership, sponsor coercion, formal trade agreements, treaties, sanctions, military alliances, secession and war are not implemented yet. The separate operational-economy prototype now includes automatic inventory transfers and simple production specialisations, but it is not yet integrated with physical kilogram inventories. Routine colony transfers do move goods between the separate abstract operational inventories, but do not yet alter the kilogram-level physical material inventories; the current cooperation score is preparatory state for richer agreements and mutual aid.

## Colony operational economies and freight prototype

Every settlement now receives its own operational inventory, a production specialisation, stock warnings, a stability index and an Earth-dependence index. The first specialisations are agriculture, resource extraction, fabrication, engineering and electronics/science. Colonies consume basic stocks, produce according to their specialisation, and can suffer population and stability pressure when food reserves are exhausted. Low stocks can trigger sponsor cargo orders with a 240-sol interplanetary transit delay.

Inter-colony freight is simulated as actual inventory transfers: the sender's stock is deducted when cargo departs, the shipment has an origin, destination, cargo, departure/arrival sol and estimated surface distance, and the destination receives the stock only when it arrives. Routine dispatch is automatic every five sols where bilateral colony relations are at least 50, a sender has surplus above its reserve, and a recipient has a shortage. The player can set a policy for each rival colony: normal cooperation, prioritise support, or no routine exchange. These policies affect routine transfers; emergency mutual aid is a separate planned system and is not implemented yet. There is no per-shipment player micromanagement, currency, or strict barter. The current automatic inventory-balancing rules are an early stand-in for standing cooperation; explicit long-term bulk commitments are a future layer rather than a prerequisite for routine aid. Successful local transfers lower the colonies' Earth-dependence indices; sponsor imports increase them. The colony operations panel shows inventories, warnings, policy, freight in transit and a recent shipment ledger.

**Transport-system limitation:** routine surface freight now uses 360 km/sol as the flat, ordinary-terrain rover baseline, plus two sols for handling. The route samples 17 points along the great-circle path using NASA MOLA elevation where available; accumulated ascent, local grade and relief increase travel time. An established route in `w.infrastructure.routes` increases effective speed by 30%. Active navigation-beacon assets represented in `w.infrastructure.assets` add 8% each up to three beacons when within 50 km of a sampled route point. This is a coarse strategic terrain penalty, not full route finding: it can miss narrow obstacles between samples and does not route around cliffs/canyons. Beacon bonuses only apply once the exploration system registers its assets in the shared infrastructure state. A flat-terrain fallback is used if MOLA data has not loaded. The 360 km/sol baseline and terrain/road modifiers are tunable gameplay assumptions, not validated rover-performance estimates. Rover fleets, cargo capacity, energy use, breakdowns, road construction state/quality, route blockages and emergency dispatch are not yet fully modelled. Earth cargo uses a fixed 240-sol delay.

Operational inventory quantities are abstract game units, not tonnes, and this first economy is not yet reconciled with the existing kilogram-level life-support/material-conservation ledger or all construction-project costs. The existing primary-colony life-support and physical material simulations continue to run separately. Thus the trade transfers are real within the new operational economy, but they do not yet add kilograms to habitat construction stock or directly satisfy engineering recipes. That reconciliation is a deliberate next integration step, not something the current UI should imply has already happened. Trade currently runs automatically rather than through player-negotiated contracts; prices, production investment, water/energy balancing, political trade disputes and explicit specialisation choices remain future work.

## Code structure

- `index.html` is the page shell and styling; application logic lives in ES modules.
- `src/main.js` wires up the Three.js scene, campaign selection, mission clock, operations panel and map interactions.
- `src/world/world-state.js` defines the scenario state, climate and energy-budget fields, initial resources, settlements, sponsor state and event log.
- `src/world/material-inventories.js` defines planetary and colony material inventories, a water-transfer ledger, conservation diagnostics and continuous natural meteoroid influx.
- `src/world/campaign-options.js` defines the five candidate landing sites, sponsor profiles and the campaign-start function.
- `src/world/world-tick.js` contains the sol-based simulation and project commissioning rules.
- `src/world/colony-politics.js` stores colony-level political agency and pairwise relationships, advances identity/autonomy indices, and resolves the first player influence initiatives.
- `src/world/colony-economy.js` stores per-colony operational stocks and specialisations, processes consumption and production, orders sponsor imports, applies player exchange policies, and dispatches/settles terrain-aware inter-colony freight.
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


## Persistent terrain and campaign saves

- Natural impact craters and their local material deposits are stored as permanent geological records, separately from the capped recent-impact marker list.
- Each impact record carries location, sol, crater dimensions, impactor class/mass, a provisional ejecta/deposit composition, and a simple crater cross-section. Local deposits are recorded in kilograms by component and are a subset of the already-counted retained impactor mass, not extra mass.
- The global NASA MOLA grid remains the immutable baseline. Sparse impact deformation is applied to elevation queries, while local crater meshes provide detail between the coarse global globe vertices. The current physically scaled craters are too small to resolve at planetary zoom; a dedicated close-up surface terrain LOD is still needed for clear inspection.
- Campaign state, simulation time, inventories and geological modifications autosave to browser local storage once per completed sol, at campaign start, and when the page is backgrounded. A manual “Save now” control is also provided. This is a single local browser save slot; clearing site data or using another browser/device will not carry it across.
- Saves retain the full material stocks and geological history, but cap the detailed process ledger at its latest 1,500 entries and record how many older entries were omitted. Local storage quota, mobile-browser behaviour and long-campaign performance still need browser testing. Geological history is intentionally not capped, unlike the transient UI marker cache.

## Physical materials, metabolism and heat stocks

- Colony life-support starts with an explicit scenario manifest: a dry glucose-equivalent food reserve equal to 90 sols of gross ration demand (0.62 kg per person per Earth day) and 5,000 kg of oxygen, alongside the water already allocated from the legacy economy. These are prototype starting-load assumptions, not validated expedition mass budgets.
- Food consumption is modelled at 0.62 kg per person per Earth day, scaled to a Mars sol. A simplified glucose-oxidation reaction consumes oxygen and food and produces carbon dioxide and metabolic water; 10% of consumed food mass is retained as solid waste.
- The existing greenhouse can run a simplified photosynthesis cycle, limited by actual colony CO₂ and tank water. The dry output is split into 70% edible food proxy and 30% inedible biomass, with oxygen returned to the colony gas stock. Production pauses during a power shortfall. Crop diversity, nutritional completeness, nitrogen fixation, mineral nutrient uptake, and compost/waste processing are not modelled yet.
- A workshop mines up to 1,000 kg/sol from a provisional local accessible-regolith stock and splits feed into 70% aggregate, 10% metal-bearing concentrate, and 20% tailings. This is a mass-conserving illustrative beneficiation recipe, not a claim that pure metals are already being refined. Electricity use is tracked separately from the existing abstract power-capacity units.
- Physical colony stocks include food, biomass, solid waste, gas compartments, water compartments, regolith, aggregate, metal concentrate, tailings, nutrients, spare parts and polymers. The material ledger records reaction and processing flows. Diagnostics now include colony total-matter and simplified carbon, hydrogen and oxygen residuals; water-derived mass includes food and colony CO₂ because these stocks exchange atoms during photosynthesis and metabolism.
- Heat is an explicit energy stock in joules. The colony thermal store receives metabolic and equipment waste heat and loses heat to the surroundings; a separate global thermal-energy stock receives that leakage and loses energy through a linearised radiative-feedback approximation. Thermal capacities and process electricity/yields are prototype assumptions. Solar forcing, seasonal thermal inertia, local heat transport, HVAC, and a complete energy ledger are not yet represented.
- This is a first physical accounting layer, not a closed ecosystem. Food is glucose-equivalent rather than a balanced human diet; biomass and waste accumulate until treatment systems are implemented; nutrients are tracked but not consumed by a nutrient chemistry model; the abstract funds/materials/electronics/machinery project economy is not yet reconciled to kilogram stocks. Do not treat the present rates as engineering design values.

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

