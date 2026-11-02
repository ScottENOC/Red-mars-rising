# Simulation limitations and implementation notes

This document records simplifications and unfinished mechanics that should not be presented as established capabilities or scientific measurements in the player-facing interface.

## Implemented systems and current representations

- Colony material inventories track selected physical stocks in kilograms. These are prototype inventories, not yet a complete industrial mass-flow model.
- Food is represented as a simplified dry carbohydrate-equivalent. Crop nutrition, mineral nutrient cycles, refined metal production and waste treatment are incomplete.
- Planetary water reservoirs and meteoroid class proportions are scenario estimates, not calibrated measurements.
- Meteoroid mass is tracked cumulatively at several stages: entering the atmosphere, retained at the surface, and atmospheric aerosols. A surface-retained mass is not automatically a surveyed, accessible or recoverable resource.
- Recorded impact deposits are local campaign records. Extraction, assay, grade estimation and recoverability mechanics are not implemented.
- Thermal and electricity accounting is partial. Stored thermal energy and cumulative heat flows are shown where available; a complete energy-generation, storage, conversion and demand model is not yet implemented.
- The resource interface distinguishes stored stock from construction commitments and installed construction mass where the underlying state supports that distinction. Capacity and per-sol production/consumption flows are not yet comprehensively represented.

## Units and time conventions

- The simulation time unit is the Martian sol: 88,775.244 seconds, or approximately 24 hours, 39 minutes and 35.244 seconds.
- Power is expressed in watts or kilowatts (W/kW); power is not multiplied by a day-length conversion.
- Energy is expressed in joules or watt-hours (J/Wh/kWh). A sustained 1 kW load over one Martian sol uses 24.6598 kWh.
- Where operational rates are added, use an explicit per-sol denominator (for example, kWh/sol or kg/sol). Do not label a per-sol quantity as per day.
- Electricity totals currently stored in kWh are cumulative energy, not instantaneous power or a per-sol rate.

## Known accounting limitations and future work

- Complete mass-balance diagnostics (water, hydrogen, oxygen, carbon and total colony matter residuals) are retained in simulation state for developer validation. They belong in developer diagnostics, not the normal player-facing resource view.
- Add explicit capacity and flow reporting separately from stock: tank capacity versus water stored; production/consumption per sol versus inventory; committed materials versus installed components.
- Improve meteoroid provenance and distinguish atmospheric entry, surface retention, local deposit formation, surveyed material and recoverable material.
- Implement local deposit surveying, assay, extraction and material processing.
- Complete crop nutrition, nutrient recycling, refined metal production and waste treatment.
- Calibrate planetary reservoir estimates and meteoroid composition/retention against defensible scientific assumptions.
- Complete energy accounting, including generation, conversion losses, storage, distribution, demand and per-sol reporting.

## UI policy

Keep developer caveats, prototype disclaimers, calibration assumptions and balance residuals in this document or developer-only diagnostics. The player interface should present the state the simulation actually models, use readable metric scales, and avoid exposing internal accounting diagnostics as if they were gameplay resources.
