/**
 * Car brand → model suggestions for the booking form datalists.
 * Curated list focused on the Russia market (premium-skewed because that's
 * who autolife.ru serves). Not exhaustive — both inputs stay free-text so
 * the user can always type something we missed.
 */

export const carModels: Readonly<Record<string, readonly string[]>> = {
  // ── German premium ──────────────────────────────────────────────────
  'Mercedes-Benz': [
    'A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLS',
    'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'V-Class', 'Vito',
    'AMG GT', 'EQS', 'EQE', 'EQC', 'Maybach S-Class',
  ],
  'BMW': [
    '1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series',
    '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7',
    'M2', 'M3', 'M4', 'M5', 'M8', 'XM', 'i3', 'i4', 'i5', 'i7', 'iX', 'Z4',
  ],
  'Audi': [
    'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8',
    'TT', 'R8', 'e-tron', 'e-tron GT', 'RS3', 'RS5', 'RS6', 'RS7', 'RSQ8',
  ],
  'Porsche': [
    '911', '718 Cayman', '718 Boxster', 'Panamera', 'Macan', 'Cayenne',
    'Taycan', 'Carrera GT',
  ],
  'Volkswagen': [
    'Polo', 'Golf', 'Passat', 'Jetta', 'Tiguan', 'Touareg', 'Teramont',
    'Atlas', 'Multivan', 'Caravelle', 'Arteon', 'ID.4', 'ID.6',
  ],
  'Opel': ['Astra', 'Insignia', 'Mokka', 'Grandland', 'Crossland', 'Corsa', 'Antara'],

  // ── Japanese ────────────────────────────────────────────────────────
  'Toyota': [
    'Camry', 'Corolla', 'Yaris', 'RAV4', 'Highlander', 'Land Cruiser',
    'Land Cruiser Prado', 'Fortuner', 'Hilux', 'Avensis', 'Venza',
    'Sequoia', 'Tundra', 'Alphard', 'GR Supra', 'GR Yaris',
  ],
  'Lexus': [
    'IS', 'ES', 'GS', 'LS', 'CT', 'RC', 'NX', 'RX', 'GX', 'LX', 'UX',
    'LM', 'LC', 'TX',
  ],
  'Nissan': [
    'Almera', 'Sentra', 'Tiida', 'Teana', 'Qashqai', 'Murano', 'X-Trail',
    'Pathfinder', 'Patrol', 'Terrano', 'Juke', 'Note', 'Leaf', 'GT-R',
    '370Z', '400Z',
  ],
  'Infiniti': ['Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX60', 'QX70', 'QX80', 'FX'],
  'Honda': [
    'Civic', 'Accord', 'Jazz', 'Fit', 'CR-V', 'HR-V', 'Pilot', 'Odyssey',
    'Stepwgn', 'Legend', 'NSX',
  ],
  'Mazda': [
    'Mazda 2', 'Mazda 3', 'Mazda 6', 'CX-3', 'CX-30', 'CX-5', 'CX-7',
    'CX-9', 'CX-50', 'CX-60', 'CX-90', 'MX-5',
  ],
  'Subaru': [
    'Impreza', 'Legacy', 'Outback', 'Forester', 'XV', 'Crosstrek',
    'Tribeca', 'Ascent', 'BRZ', 'WRX',
  ],
  'Mitsubishi': [
    'Lancer', 'Outlander', 'ASX', 'Pajero', 'Pajero Sport', 'Eclipse Cross',
    'L200', 'Galant', 'Colt',
  ],
  'Suzuki': ['Swift', 'SX4', 'Vitara', 'Grand Vitara', 'Jimny', 'Baleno'],

  // ── Korean ──────────────────────────────────────────────────────────
  'Kia': [
    'Rio', 'Cerato', 'K5', 'Optima', 'Stinger', 'Picanto', 'Soul',
    'Seltos', 'Sportage', 'Sorento', 'Mohave', 'Carnival', 'EV6', 'EV9',
  ],
  'Hyundai': [
    'Solaris', 'Accent', 'Elantra', 'Sonata', 'i30', 'i40', 'Creta',
    'Tucson', 'Santa Fe', 'Palisade', 'Genesis', 'Ioniq 5', 'Ioniq 6',
    'Staria', 'H-1',
  ],
  'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  'SsangYong': ['Actyon', 'Kyron', 'Rexton', 'Tivoli', 'Korando'],

  // ── American ────────────────────────────────────────────────────────
  'Chevrolet': [
    'Aveo', 'Cruze', 'Captiva', 'Lacetti', 'Niva', 'Tahoe', 'Suburban',
    'Camaro', 'Corvette', 'Malibu', 'Traverse',
  ],
  'Ford': [
    'Focus', 'Fiesta', 'Mondeo', 'Fusion', 'Kuga', 'Escape', 'Edge',
    'Explorer', 'Expedition', 'Mustang', 'F-150', 'Ranger', 'Transit',
  ],
  'Cadillac': ['ATS', 'CTS', 'CT5', 'CT6', 'XT4', 'XT5', 'XT6', 'Escalade'],
  'Chrysler': ['300', '300C', 'Pacifica', 'Voyager'],
  'Dodge': ['Charger', 'Challenger', 'Durango', 'RAM 1500'],
  'Jeep': ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade', 'Gladiator'],
  'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck', 'Roadster'],

  // ── British ─────────────────────────────────────────────────────────
  'Land Rover': [
    'Defender', 'Discovery', 'Discovery Sport', 'Range Rover',
    'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque', 'Freelander',
  ],
  'Jaguar': ['XE', 'XF', 'XJ', 'F-Type', 'F-Pace', 'E-Pace', 'I-Pace'],
  'Mini': ['Cooper', 'Cooper S', 'Countryman', 'Clubman', 'Paceman'],
  'Bentley': ['Continental GT', 'Flying Spur', 'Bentayga', 'Mulsanne'],
  'Rolls-Royce': ['Phantom', 'Ghost', 'Wraith', 'Dawn', 'Cullinan', 'Spectre'],
  'Aston Martin': ['DB11', 'DB12', 'DBX', 'Vantage', 'DBS'],

  // ── Italian ─────────────────────────────────────────────────────────
  'Ferrari': ['F8 Tributo', '296 GTB', 'Roma', 'Portofino', 'SF90', '812 Superfast', 'Purosangue'],
  'Lamborghini': ['Huracán', 'Aventador', 'Urus', 'Revuelto'],
  'Maserati': ['Ghibli', 'Quattroporte', 'Levante', 'Grecale', 'GranTurismo', 'MC20'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale', '4C'],
  'Fiat': ['500', '500X', 'Punto', 'Panda', 'Tipo'],

  // ── French ──────────────────────────────────────────────────────────
  'Peugeot': ['208', '308', '408', '508', '2008', '3008', '5008', 'Partner'],
  'Renault': [
    'Logan', 'Sandero', 'Duster', 'Arkana', 'Kaptur', 'Megane', 'Fluence',
    'Symbol', 'Koleos', 'Talisman', 'Trafic', 'Master',
  ],
  'Citroën': ['C3', 'C4', 'C5', 'C5 Aircross', 'Berlingo', 'Jumper'],
  'DS': ['DS 3', 'DS 4', 'DS 7', 'DS 9'],

  // ── Swedish / Other Euro ────────────────────────────────────────────
  'Volvo': ['S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90', 'C40'],
  'Skoda': ['Fabia', 'Rapid', 'Octavia', 'Superb', 'Karoq', 'Kodiaq', 'Yeti', 'Kamiq'],
  'SEAT': ['Ibiza', 'Leon', 'Ateca', 'Tarraco', 'Arona'],

  // ── Russian / CIS ───────────────────────────────────────────────────
  'Lada': [
    'Vesta', 'Granta', 'Largus', 'Niva', 'Niva Travel', 'XRAY', 'Priora', 'Kalina',
  ],
  'УАЗ': ['Patriot', 'Pickup', 'Hunter', 'Profi', '469', 'Buhanka'],
  'ГАЗ': ['Volga', 'Gazelle Next', 'Sobol', 'Siber'],
  'Москвич': ['3', '3е', '6', '8'],

  // ── Chinese (rapidly growing in RU market) ──────────────────────────
  'Chery': ['Tiggo 4', 'Tiggo 7', 'Tiggo 8', 'Tiggo 8 Pro', 'Arrizo 8', 'Omoda 5'],
  'Geely': ['Atlas', 'Atlas Pro', 'Coolray', 'Tugella', 'Monjaro', 'Emgrand'],
  'Haval': ['Jolion', 'F7', 'F7x', 'H6', 'H9', 'Dargo'],
  'Changan': ['CS35', 'CS55', 'CS75', 'CS85', 'UNI-T', 'UNI-K', 'Hunter'],
  'Great Wall': ['Hover', 'Wingle', 'Poer', 'Tank 300', 'Tank 500'],
  'Exeed': ['LX', 'TXL', 'VX', 'RX'],
  'Omoda': ['C5', 'S5', '5'],
  'Jaecoo': ['J7', 'J8'],
  'BYD': ['Han', 'Seal', 'Atto 3', 'Tang', 'Song Plus', 'Dolphin'],
  'Li Auto': ['L6', 'L7', 'L8', 'L9'],
  'NIO': ['ES6', 'ES7', 'ES8', 'EC6', 'ET5', 'ET7'],
  'Zeekr': ['001', '007', '009', 'X'],
  'Hongqi': ['H5', 'H7', 'H9', 'HS5', 'HS7', 'E-HS9'],

  // ── Czech / Other ───────────────────────────────────────────────────
  'Datsun': ['on-DO', 'mi-DO'],
  'Daewoo': ['Nexia', 'Matiz', 'Lanos', 'Gentra'],
};

/** Sorted brand list for the brands datalist. */
export const carBrands: readonly string[] = Object.keys(carModels).sort();

/** Look up models by brand, case- and whitespace-insensitive. Returns []
 *  if no match (so the model field still works as free-text). */
export function modelsForBrand(rawBrand: string): readonly string[] {
  const needle = rawBrand.trim().toLowerCase();
  if (!needle) return [];
  for (const brand of carBrands) {
    if (brand.toLowerCase() === needle) return carModels[brand];
  }
  return [];
}
