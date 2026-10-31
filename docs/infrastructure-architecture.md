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
| Static reference landmarks | `worldState.pointsOfInterest` | Remain map/reference points, not a second mutable infrastructure registry |

## Migration

`ensureInfrastructureModel(worldState)` is an idempotent normalisation and migration boundary.

- It preserves existing `infrastructure.routes`, `infrastructure.projects` and `infrastructure.assets` records.
- It creates actor records for existing sponsors and settlements.
- It records the existing settlement-to-sponsor affiliation as a `sponsored-by` relationship; sponsorship is not ownership.
- It migrates legacy `asteroidOperations.orbitalAssets` records into `infrastructure.assets`, tags them as orbital assets belonging to the asteroid-operations subsystem, and removes the legacy array.
- Asteroid operations now reads and mutates those canonical asset records through `getOrbitalInfrastructureAssets`.
- Existing `settlement.infrastructure` strings remain legacy installed-capability tags used by current colony and rendering code. They are not treated as an alternative ownership registry; migration of individual installed modules into independently modelled assets is a later, deliberate step.

Relationship IDs are deterministic, so repeated normalisation does not create duplicate ownership or operational links. Different roles remain independent: a funder, legal owner, builder, operator, controller, maintainer and occupant can all be different actors.

## Current scope

The first integration establishes shared identities, relationship records, legacy orbital-asset migration and a selectable orbital-asset inspector. The inspector reports ownership, funding, construction, operation, control, occupancy, location, condition, dependencies, outputs, current missions and detected active threats.

Generic dependency flow, service allocation, oxygen/power/water network simulation, relief-equipment delivery and autonomous sponsor intervention are not yet implemented. They must be added to the existing colony economy, freight, sponsor and project systems rather than implemented as parallel substitutes.

## Tick integration

The existing one-sol world tick and its current ordering remain authoritative. Infrastructure normalisation is invoked through the existing asteroid-operations initialisation path during an active campaign. No second world clock or infrastructure tick is introduced.
