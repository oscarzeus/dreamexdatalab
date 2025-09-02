/**
 * Scope 3 Emission Factors by Calculation Method and Standard
 * Contains emission factors for different calculation methods and standards
 */

export const scope3FactorsByMethod = {
    // Supplier-Specific Method factors
    'supplier_specific': {
        'ghg-protocol': { co2: 2.5, notes: 'kg CO₂e/kg (supplier data)' },
        'ipcc-2006': { co2: 0, notes: 'No default factor - use supplier data' },
        'uk-defra': { co2: 0, notes: 'No default factor - use supplier data' },
        'us-epa': { co2: 0, notes: 'No default factor - use supplier data' },
        'useeio': { co2: 0, notes: 'No default factor - use supplier data' },
        'exiobase': { co2: 0, notes: 'No default factor - use supplier data' },
        'ecoinvent': { co2: 0, notes: 'No default factor - use supplier data' },
        'gabi': { co2: 0, notes: 'No default factor - use supplier data' },
        'greet': { co2: 0, notes: 'No default factor - use supplier data' },
        'iso-14064': { co2: 0, notes: 'No default factor - use supplier data' }
    },
    
    // Activity-Based Method factors
    'activity_based': {
        'ghg-protocol': { co2: 1.0, notes: 'Depends on activity - use activity-specific factors' },
        'ipcc-2006': { co2: 1.0, notes: 'kg CO₂e/kg (landfill)' },
        'uk-defra': { co2: 1.0, notes: 'kg CO₂e/kg (waste)' },
        'us-epa': { co2: 0, notes: 'No default factor - use activity-specific factors' },
        'useeio': { co2: 0, notes: 'No default factor - use activity-specific factors' },
        'ecoinvent': { co2: 0, notes: 'No default factor - use activity-specific factors' },
        'gabi': { co2: 0, notes: 'No default factor - use activity-specific factors' },
        'greet': { co2: 0, notes: 'No default factor - use activity-specific factors' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Distance-Based Method factors
    'distance_based': {
        'ghg-protocol': { co2: 0.1, notes: 'No default factor - use transport-specific factors' },
        'ipcc-2006': { co2: 0, notes: 'No default factor - use transport-specific factors' },
        'uk-defra': { co2: 0.18052, notes: 'kg CO₂e/km' },
        'us-epa': { co2: 0.404, notes: 'kg CO₂e/mile' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 0, notes: 'No default factor' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Fuel-Based Method factors
    'fuel_based': {
        'ghg-protocol': { co2: 0, notes: 'No default factor - use fuel-specific factors' },
        'ipcc-2006': { co2: 2.68, notes: 'kg CO₂e/L (diesel)' },
        'uk-defra': { co2: 0, notes: 'No default factor - use fuel-specific factors' },
        'us-epa': { co2: 2.68, notes: 'kg CO₂e/L' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 0, notes: 'No default factor' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 3.2, notes: 'kg CO₂e/L (diesel)' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Spend-Based Method factors
    'spend_based': {
        'ghg-protocol': { co2: 0.3, notes: 'kg CO₂e/$' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0.3, notes: 'kg CO₂e/£' },
        'us-epa': { co2: 0.3, notes: 'kg CO₂e/$' },
        'useeio': { co2: 0.3, notes: 'kg CO₂e/$' },
        'exiobase': { co2: 0.45, notes: 'kg CO₂e/€' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Average-Data Method factors
    'average_data': {
        'ghg-protocol': { co2: 300, notes: 'kg CO₂e/laptop' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0, notes: 'No default factor' },
        'us-epa': { co2: 0, notes: 'No default factor' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 300, notes: 'kg CO₂e/laptop' },
        'ecoinvent': { co2: 600, notes: 'kg CO₂e/unit' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Hybrid Method factors
    'hybrid': {
        'ghg-protocol': { co2: 0, notes: 'Combination of multiple EFs' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0, notes: 'No default factor' },
        'us-epa': { co2: 0, notes: 'No default factor' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 0, notes: 'No default factor' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // LCA Method factors
    'lca': {
        'ghg-protocol': { co2: 0, notes: 'No default factor' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0, notes: 'No default factor' },
        'us-epa': { co2: 0, notes: 'No default factor' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 0, notes: 'No default factor' },
        'ecoinvent': { co2: 600, notes: 'kg CO₂e/fridge' },
        'gabi': { co2: 2.1, notes: 'kg CO₂e/kg (steel)' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    },
    
    // Screening Method factors
    'screening': {
        'ghg-protocol': { co2: 0.25, notes: 'kg CO₂e/$' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0, notes: 'No default factor' },
        'us-epa': { co2: 0, notes: 'No default factor' },
        'useeio': { co2: 0, notes: 'No default factor' },
        'exiobase': { co2: 0, notes: 'No default factor' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'No default factor' }
    },
    
    // Input-Output Method factors
    'input_output': {
        'ghg-protocol': { co2: 0.3, notes: 'kg CO₂e/$' },
        'ipcc-2006': { co2: 0, notes: 'No default factor' },
        'uk-defra': { co2: 0, notes: 'No default factor' },
        'us-epa': { co2: 0.3, notes: 'kg CO₂e/$' },
        'useeio': { co2: 0.3, notes: 'kg CO₂e/$' },
        'exiobase': { co2: 0.45, notes: 'kg CO₂e/€' },
        'ecoinvent': { co2: 0, notes: 'No default factor' },
        'gabi': { co2: 0, notes: 'No default factor' },
        'greet': { co2: 0, notes: 'No default factor' },
        'iso-14064': { co2: 0, notes: 'User-defined - must be justified' }
    }
};
