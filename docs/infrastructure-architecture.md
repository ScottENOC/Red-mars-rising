# Infrastructure architecture (development)

## Source-of-truth boundaries

The campaign has several existing systems that already own specific mechanics. The shared infrastructure model is intended to connect them, not replace them wholesale.

| Concern | Canonical system | Boundary |
| --- | --- | --- |
| Physical infrastructure identity | `worldState.infrastructure.assets` | Shared asset registry for surface and orbital infrastructure |
| Actors | `worldState.infrastructure.actors` | Stable identities for sponsors, colonies and other organisations |
| Asset relationships | `worldState.infrastructure.relationships` | Ownership, funding, construction, operation, control, maintenance and occupancy |
| Surface routes | `worldState.infrastructure.routes` | Existing route records retained |
| Construction projects | `worldState.infrastructure.projects` | Existing project lifecycle retained |
| Commodity inventories and freight | `worldState.colonyTrade` and `settlement.economy` | Remain the only stock, trade and shipment simulation |
| Sponsor obligations | `worldState.sponsorCommitments` | Remains responsible for sponsor project approvals and recurring support |
| Orbital missions and capability progression | `worldState.asteroidOperations` | Retains missions, programme state, defence state and AI operations; its former asset array is retired |
| Physical colony stocks and chemical flows | `worldState.materials.colonies` | Existing material inventories remain authoritative for water, gases, food and industrial stocks |
| Infrastructure service operation | `src/world/infrastructure-services.js` | Operates installed assets against those existing stocks; does not create a second inventory or freight system |
| Static reference landmarks | `worldState.pointsOfInterest` | Remain map/reference points, not a second mutable infrastructure registry |

## Migration

`ensureInfrastructureModel(worldState)` is an idempotent normalisation and migration boundary.

- It preserves existing `infrastructure.routes`, `infrastructure.projects` and `infrastructure.assets` records.
- It creates actor records for existing sponsors and settlements.
- It records the existing settlement-to-sponsor affiliation as a `sponsored-by` relationship; sponsorship is not ownership.
- It migrates legacy `asteroidOperations.orbitalAssets` records into `infrastructure.assets`, tags them as orbital assets belonging to the asteroid-operations subsystem, and removes the legacy array.
- Asteroid operations now reads and mutates those canonical asset records through `getOrbitalInfrastructureAssets`.
- Existing `settlement.infrastructure` strings remain the legacy capability flags used by current simulation code. `ensureSettlementInfrastructureAssets` now creates one canonical surface asset per installed tag, preserving those flags as compatibility inputs rather than maintaining a second mutable asset registry.
- Rival colonies receive physical food, water and oxygen manifests when their settlement records enter the world. Their arrival stocks are added to the material-conservation baseline so a newly founded colony is not reported as unexplained matter creation.
- Version-one colony saves receive a one-time oxygen-reserve migration from 5,000 kg to 20,000 kg; the existing conservation baseline is adjusted with the stock migration.

Relationship IDs are deterministic, so repeated normalisation does not create duplicate ownership or operational links. Different roles remain independent: a funder, legal owner, builder, operator, controller, maintainer and occupant can all be different actors.

## Current scope

The integration now establishes shared identities and relationships, migrates orbital assets, promotes existing settlement capability tags into canonical surface assets, and makes both orbital and surface assets selectable on the map. The inspector reports ownership, funding, construction, operation, control, occupancy, location, condition, dependencies, outputs and relevant activity. Oxygen equipment also exposes reserve, production and estimated runway.

The first live service is oxygen generation. An operational electrolyser consumes colony tank water and electricity, then records hydrogen and oxygen as physical gas stocks using the existing electrolysis chemistry. Existing greenhouse photosynthesis remains the existing oxygen co-product; the new service does not duplicate it. Non-primary colonies now use the same glucose-equivalent oxygen/food metabolism as the primary colony.

When a colony's projected oxygen runway falls below 300 sols, its sponsor can independently decide to dispatch a portable oxygen generator. The shipment travels through the existing `colonyTrade.shipments` pipeline with a 240-sol lead time. On arrival, the machine is installed as a normal infrastructure asset: the sponsor can own, fund, build, provide technology/software and retain technical control, while the colony operates it and can modify its software. A colony with sufficient installed generation does not receive duplicate relief equipment.

This is not yet a general-purpose power/water/oxygen network solver. Power availability is gated by the existing colony-wide capacity/shortfall model. Oxygen generators share the remaining colony power headroom, with their kWh-per-sol demand converted to an average kW load; local grid topology and power routing are not yet modelled. Oxygen production is currently a water-electrolysis service, not a model of pressure, partial pressure, leaks, storage tanks or breathable-atmosphere quality. Those are deliberate next steps.

## Tick integration

The existing one-sol world tick and its current ordering remain authoritative. Infrastructure normalisation and surface-asset registration run during the existing world tick. Oxygen services run within that same tick, using the existing material inventory and one-sol clock. Sponsor equipment deliveries use existing colony freight timing. No second world clock, inventory or shipment system is introduced.
