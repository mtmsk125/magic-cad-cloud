/**
 * Laser Cutting Cost Calculator — Industry Standard
 * Combines material, machine, setup, consumables, and profit margin
 */

import type { DxfEntity } from './dxf';
import { getDxfBounds, calculateTotalPerimeter } from './dxf';

export interface MaterialPreset {
  id: string; name: string; nameAr: string;
  thickness: number; density: number; cutSpeed: number;
  pierceTime: number; kerfWidth: number;
  pricePerSheet: number; sheetWidth: number; sheetHeight: number;
  consumableCostPerHour: number;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: 'steel-1.5', name: 'Mild Steel 1.5mm', nameAr: 'فولاذ لين 1.5مم', thickness: 1.5, density: 7.85, cutSpeed: 3.5, pierceTime: 0.5, kerfWidth: 0.15, pricePerSheet: 45, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 2.5 },
  { id: 'steel-3', name: 'Mild Steel 3mm', nameAr: 'فولاذ لين 3مم', thickness: 3, density: 7.85, cutSpeed: 1.8, pierceTime: 0.8, kerfWidth: 0.2, pricePerSheet: 85, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 3.0 },
  { id: 'steel-6', name: 'Mild Steel 6mm', nameAr: 'فولاذ لين 6مم', thickness: 6, density: 7.85, cutSpeed: 0.8, pierceTime: 1.2, kerfWidth: 0.25, pricePerSheet: 160, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 4.0 },
  { id: 'aluminum-2', name: 'Aluminum 2mm', nameAr: 'ألمنيوم 2مم', thickness: 2, density: 2.7, cutSpeed: 4.0, pierceTime: 0.4, kerfWidth: 0.15, pricePerSheet: 65, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 2.8 },
  { id: 'aluminum-3', name: 'Aluminum 3mm', nameAr: 'ألمنيوم 3مم', thickness: 3, density: 2.7, cutSpeed: 2.5, pierceTime: 0.6, kerfWidth: 0.18, pricePerSheet: 95, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 3.2 },
  { id: 'wood-3', name: 'Plywood 3mm', nameAr: 'خشب رقائقي 3مم', thickness: 3, density: 0.6, cutSpeed: 8.0, pierceTime: 0.2, kerfWidth: 0.3, pricePerSheet: 12, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 0.5 },
  { id: 'wood-6', name: 'Plywood 6mm', nameAr: 'خشب رقائقي 6مم', thickness: 6, density: 0.6, cutSpeed: 4.5, pierceTime: 0.3, kerfWidth: 0.4, pricePerSheet: 20, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 0.8 },
  { id: 'wood-9', name: 'Plywood 9mm', nameAr: 'خشب رقائقي 9مم', thickness: 9, density: 0.6, cutSpeed: 2.8, pierceTime: 0.4, kerfWidth: 0.5, pricePerSheet: 28, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 1.0 },
  { id: 'acrylic-3', name: 'Acrylic 3mm', nameAr: 'أكريليك 3مم', thickness: 3, density: 1.18, cutSpeed: 6.0, pierceTime: 0.3, kerfWidth: 0.2, pricePerSheet: 35, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 1.2 },
  { id: 'acrylic-5', name: 'Acrylic 5mm', nameAr: 'أكريليك 5مم', thickness: 5, density: 1.18, cutSpeed: 3.5, pierceTime: 0.5, kerfWidth: 0.25, pricePerSheet: 55, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 1.5 },
  { id: 'acrylic-8', name: 'Acrylic 8mm', nameAr: 'أكريليك 8مم', thickness: 8, density: 1.18, cutSpeed: 2.0, pierceTime: 0.7, kerfWidth: 0.3, pricePerSheet: 85, sheetWidth: 1220, sheetHeight: 2440, consumableCostPerHour: 2.0 },
  { id: 'leather', name: 'Leather', nameAr: 'جلد', thickness: 2.5, density: 0.86, cutSpeed: 10.0, pierceTime: 0.1, kerfWidth: 0.15, pricePerSheet: 40, sheetWidth: 900, sheetHeight: 1200, consumableCostPerHour: 0.3 },
  { id: 'cardboard', name: 'Cardboard 2mm', nameAr: 'كرتون 2مم', thickness: 2, density: 0.65, cutSpeed: 15.0, pierceTime: 0.05, kerfWidth: 0.1, pricePerSheet: 3, sheetWidth: 1000, sheetHeight: 1400, consumableCostPerHour: 0.1 },
  { id: 'fabric', name: 'Fabric', nameAr: 'قماش', thickness: 1, density: 0.3, cutSpeed: 20.0, pierceTime: 0.02, kerfWidth: 0.08, pricePerSheet: 8, sheetWidth: 1500, sheetHeight: 1000, consumableCostPerHour: 0.05 },
];

export interface MachineConfig {
  name: string; laserPower: number; purchasePrice: number;
  expectedLifeYears: number; operatingHoursPerDay: number;
  workingDaysPerYear: number; maintenanceCostPerYear: number;
  electricityConsumption: number; electricityCostPerKwh: number;
  laborCostPerHour: number; operatorCount: number;
  accelerationFactor: number; setupTimeMinutes: number;
}

export const DEFAULT_MACHINE: MachineConfig = {
  name: 'CO2 Laser 100W', laserPower: 100, purchasePrice: 15000,
  expectedLifeYears: 10, operatingHoursPerDay: 8, workingDaysPerYear: 250,
  maintenanceCostPerYear: 2000, electricityConsumption: 1.5, electricityCostPerKwh: 0.12,
  laborCostPerHour: 15, operatorCount: 1, accelerationFactor: 1.15, setupTimeMinutes: 5,
};

export interface CostInput {
  materialId: string; machine: MachineConfig; quantity: number;
  profitMargin: number; customCutSpeed?: number;
  customPricePerSheet?: number; electricityRate?: number;
}
export interface CostBreakdown {
  totalCutLengthMm: number; totalCutLengthM: number;
  estimatedCutTimeMinutes: number; setupTimeMinutes: number;
  totalTimeMinutes: number; sheetAreaM2: number; partAreaM2: number;
  materialUtilization: number; sheetsNeeded: number;
  materialCostPerSheet: number; totalMaterialCost: number;
  machineHourlyRate: number; machineTimeCost: number;
  setupCost: number; consumableCost: number;
  costPerPart: number; totalCost: number;
  sellingPricePerPart: number; totalSellingPrice: number;
  netProfit: number; profitMargin: number;
  totalWeightKg: number; recommendedSettings: string[];
}

export function calculateCost(entities: DxfEntity[], input: CostInput): CostBreakdown {
  const material = MATERIAL_PRESETS.find(m => m.id === input.materialId) || MATERIAL_PRESETS[0];
  const machine = input.machine;
  const cutSpeed = input.customCutSpeed || material.cutSpeed;
  const pricePerSheet = input.customPricePerSheet || material.pricePerSheet;
  const elecRate = input.electricityRate || machine.electricityCostPerKwh;

  const totalCutLengthMM = calculateTotalPerimeter(entities);
  const totalCutLengthM = totalCutLengthMM / 1000;

  const pierceCount = estimatePierceCount(entities);
  const baseCutTimeMinutes = totalCutLengthM / cutSpeed;
  const pierceTimeMinutes = (pierceCount * material.pierceTime) / 60;
  const adjustedCutTimeMinutes = (baseCutTimeMinutes + pierceTimeMinutes) * machine.accelerationFactor;
  const setupTimeMinutes = machine.setupTimeMinutes;
  const totalTimeMinutes = adjustedCutTimeMinutes * input.quantity + setupTimeMinutes;

  const bounds = getDxfBounds(entities);
  const partAreaM2 = bounds ? (bounds.width / 1000) * (bounds.height / 1000) : 0;
  const sheetAreaM2 = (material.sheetWidth / 1000) * (material.sheetHeight / 1000);

  const partsPerSheet = estimatePartsPerSheet(bounds, material);
  const sheetsNeeded = Math.ceil(input.quantity / Math.max(1, partsPerSheet));
  const materialUtilization = Math.min(95, (partAreaM2 * input.quantity) / (sheetAreaM2 * sheetsNeeded) * 100);

  const materialCostPerSheet = pricePerSheet;
  const totalMaterialCost = materialCostPerSheet * sheetsNeeded;

  const annualHours = machine.operatingHoursPerDay * machine.workingDaysPerYear;
  const depreciationPerHour = machine.purchasePrice / (machine.expectedLifeYears * annualHours);
  const maintenancePerHour = machine.maintenanceCostPerYear / annualHours;
  const electricityPerHour = machine.electricityConsumption * elecRate;
  const laborPerHour = machine.laborCostPerHour * machine.operatorCount;
  const machineHourlyRate = depreciationPerHour + maintenancePerHour + electricityPerHour + laborPerHour;

  const machineTimeHours = (adjustedCutTimeMinutes * input.quantity) / 60;
  const setupTimeHours = setupTimeMinutes / 60;
  const machineTimeCost = machineHourlyRate * machineTimeHours;
  const setupCost = machineHourlyRate * setupTimeHours;

  const consumableCost = material.consumableCostPerHour * ((adjustedCutTimeMinutes * input.quantity + setupTimeMinutes) / 60);

  const totalCost = totalMaterialCost + machineTimeCost + setupCost + consumableCost;
  const costPerPart = totalCost / input.quantity;
  const profitMultiplier = 1 + (input.profitMargin / 100);
  const sellingPricePerPart = costPerPart * profitMultiplier;
  const totalSellingPrice = sellingPricePerPart * input.quantity;
  const netProfit = totalSellingPrice - totalCost;

  const volumeCm3 = partAreaM2 * 10000 * material.thickness / 10;
  const totalWeightKg = (volumeCm3 * material.density / 1000) * input.quantity;

  return {
    totalCutLengthMm: Math.round(totalCutLengthMM * 100) / 100,
    totalCutLengthM: Math.round(totalCutLengthM * 100) / 100,
    estimatedCutTimeMinutes: Math.round(adjustedCutTimeMinutes * 10) / 10,
    setupTimeMinutes,
    totalTimeMinutes: Math.round(totalTimeMinutes * 10) / 10,
    sheetAreaM2: Math.round(sheetAreaM2 * 100) / 100,
    partAreaM2: Math.round(partAreaM2 * 10000) / 10000,
    materialUtilization: Math.round(materialUtilization * 10) / 10,
    sheetsNeeded,
    materialCostPerSheet,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    machineHourlyRate: Math.round(machineHourlyRate * 100) / 100,
    machineTimeCost: Math.round(machineTimeCost * 100) / 100,
    setupCost: Math.round(setupCost * 100) / 100,
    consumableCost: Math.round(consumableCost * 100) / 100,
    costPerPart: Math.round(costPerPart * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    sellingPricePerPart: Math.round(sellingPricePerPart * 100) / 100,
    totalSellingPrice: Math.round(totalSellingPrice * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin: input.profitMargin,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    recommendedSettings: generateRecommendations(material, machine, entities),
  };
}

function estimatePierceCount(entities: DxfEntity[]): number {
  let count = 0;
  for (const e of entities) {
    if (e.type === 'LINE') count++;
    else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') count++;
    else if (e.type === 'ARC' || e.type === 'CIRCLE') count++;
  }
  return Math.max(1, count);
}

function estimatePartsPerSheet(bounds: { width: number; height: number } | null, material: MaterialPreset): number {
  if (!bounds || bounds.width === 0 || bounds.height === 0) return 1;
  const spacing = material.kerfWidth + 2;
  const cols = Math.floor((material.sheetWidth - 20) / (bounds.width + spacing));
  const rows = Math.floor((material.sheetHeight - 20) / (bounds.height + spacing));
  return Math.max(1, cols * rows);
}

function generateRecommendations(material: MaterialPreset, machine: MachineConfig, entities: DxfEntity[]): string[] {
  const recs: string[] = [];
  if (material.thickness > 5 && machine.laserPower < 100) recs.push('⚠ المادة سميكة لقوة الليزر');
  if (material.cutSpeed < 1.0) recs.push('💡 تأكد من تهوية غاز المساعدة');
  recs.push(`⏱ سرعة القص: ${material.cutSpeed} م/دقيقة`);
  return recs;
}

export interface ScenarioResult {
  quantity: number; costPerPart: number; totalCost: number;
  totalTime: number; sheetsNeeded: number;
}

export function compareScenarios(
  entities: DxfEntity[],
  baseInput: CostInput,
  quantities: number[] = [1, 5, 10, 50, 100]
): ScenarioResult[] {
  return quantities.map(qty => {
    const result = calculateCost(entities, { ...baseInput, quantity: qty });
    return {
      quantity: qty,
      costPerPart: result.costPerPart,
      totalCost: result.totalCost,
      totalTime: result.totalTimeMinutes,
      sheetsNeeded: result.sheetsNeeded,
    };
  });
}

export interface SensitivityResult {
  parameter: string; values: number[]; costs: number[]; times: number[];
}

export function analyzeSensitivity(
  entities: DxfEntity[],
  baseInput: CostInput,
  parameter: 'cutSpeed' | 'materialPrice' | 'quantity',
  range: number[]
): SensitivityResult {
  return {
    parameter,
    values: range,
    costs: range.map(val => {
      const input = { ...baseInput };
      if (parameter === 'cutSpeed') input.customCutSpeed = val;
      else if (parameter === 'materialPrice') input.customPricePerSheet = val;
      else if (parameter === 'quantity') input.quantity = val;
      return calculateCost(entities, input).costPerPart;
    }),
    times: range.map(val => {
      const input = { ...baseInput };
      if (parameter === 'cutSpeed') input.customCutSpeed = val;
      else if (parameter === 'quantity') input.quantity = val;
      return calculateCost(entities, input).estimatedCutTimeMinutes;
    }),
  };
}

