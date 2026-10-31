import { consumeColonyWaterForReaction } from './material-inventories.js';

export const FOOD_KG_PER_ECONOMY_UNIT=0.62*(88775.244/86400)/0.018;
const GLUCOSE_MOLAR_G=6*12.011+12*1.00794+6*15.9994;
const CO2_PER_GLUC=6*(12.011+2*15.9994)/GLUCOSE_MOLAR_G;
const WATER_PER_GLUC=6*18.01528/GLUCOSE_MOLAR_G;
const O2_PER_GLUC=6*31.9988/GLUCOSE_MOLAR_G;

export function ensureReliefOutpostFoodBridge(w,settlement){
  if(settlement?.settlementType!=='relief-outpost'||!settlement.economy||settlement.economy.physicalFoodBridgeVersion===1)return;
  const colony=w.materials?.colonies?.[settlement.id];
  if(!colony)return;
  const desiredFoodKg=Math.max(0,Number(settlement.economy.inventory?.food)||0)*FOOD_KG_PER_ECONOMY_UNIT;
  const delta=desiredFoodKg-(Number(colony.foodKg)||0);
  colony.foodKg=desiredFoodKg;
  const baseline=w.materials.diagnostics.initialTrackedStocks?.colonies?.[settlement.id];
  if(baseline){
    baseline.foodKg=(Number(baseline.foodKg)||0)+delta;
    w.materials.diagnostics.initialColonyMatterMassKg=(Number(w.materials.diagnostics.initialColonyMatterMassKg)||0)+delta;
  }
  settlement.economy.physicalFoodBridgeVersion=1;
}

export function processReliefOutpostAgriculture(w,settlement,sol){
  if(settlement?.settlementType!=='relief-outpost')return null;
  const colony=w.materials?.colonies?.[settlement.id];
  if(!colony)return null;
  const population=Math.max(0,Number(settlement.population)||0);
  const maxDryBiomassKg=population*0.25;
  const byCO2=Math.max(0,Number(colony.gasesKg.carbonDioxide)||0)/CO2_PER_GLUC;
  const byWater=Math.max(0,Number(colony.waterKg.tanks)||0)/WATER_PER_GLUC;
  const dryBiomassKg=Math.min(maxDryBiomassKg,byCO2,byWater);
  if(dryBiomassKg>0){
    const co2UsedKg=dryBiomassKg*CO2_PER_GLUC,waterUsedKg=dryBiomassKg*WATER_PER_GLUC;
    consumeColonyWaterForReaction(w,{colonyId:settlement.id,massKg:waterUsedKg,sol,process:'relief-outpost-photosynthesis',note:'The outpost greenhouse uses the same glucose-equivalent photosynthesis chemistry as the primary colony.'});
    colony.gasesKg.carbonDioxide=Math.max(0,colony.gasesKg.carbonDioxide-co2UsedKg);
    colony.gasesKg.oxygen+=dryBiomassKg*O2_PER_GLUC;
    colony.foodKg+=dryBiomassKg*0.70;
    colony.biomassKg=(colony.biomassKg??0)+dryBiomassKg*0.30;
    w.materials.ledger.push({sol,process:'relief-outpost-photosynthesis',substance:'dry glucose-equivalent biomass',massKg:dryBiomassKg,co2ConsumedKg:co2UsedKg,waterConsumedKg:waterUsedKg,oxygenProducedKg:dryBiomassKg*O2_PER_GLUC,edibleFoodKg:dryBiomassKg*0.70,inedibleBiomassKg:dryBiomassKg*0.30,note:'Outpost greenhouse food production is limited by population, available CO2 and tank water.'});
  }
  settlement.economy.inventory.food=Math.round(Math.max(0,colony.foodKg/FOOD_KG_PER_ECONOMY_UNIT)*1000)/1000;
  return {dryBiomassKg,edibleFoodKg:dryBiomassKg*0.70,oxygenKg:dryBiomassKg*O2_PER_GLUC};
}
