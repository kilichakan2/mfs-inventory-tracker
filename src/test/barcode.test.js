import { describe, it, expect } from 'vitest'

// Copy the parsing functions from App.jsx for testing
const parseCarcassBarcode = (barcode) => {
  const cleaned = barcode.trim().toUpperCase();
  if (cleaned.length < 15) return null;
  
  try {
    const dateStr = cleaned.substring(3, 11);
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);
    const killNumber = cleaned.substring(11, 15);
    
    // Validate month and day ranges
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    
    // Validate actual date
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return null;
    
    // Check if date rolled over (e.g., Feb 30 becomes Mar 2)
    if (dateObj.getMonth() + 1 !== month || dateObj.getDate() !== day) return null;
    
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    return {
      killDate: `${year}-${monthStr}-${dayStr}`,
      killDateDisplay: `${dayStr}/${monthStr}/${year}`,
      killNumber: killNumber,
      rawBarcode: cleaned
    };
  } catch (e) {
    return null;
  }
};

const parseProductBarcode = (barcode) => {
  const cleaned = barcode.trim();
  if (cleaned.length !== 13) return null;
  
  try {
    const prefix = cleaned.substring(0, 2);
    if (prefix === '26') {
      const plu = cleaned.substring(2, 6);
      const weightStr = cleaned.substring(7, 12);
      const weight = parseInt(weightStr, 10) / 1000;
      return { plu, weight, rawBarcode: cleaned };
    }
    if (prefix === '27') {
      const plu = cleaned.substring(2, 7);
      const weightStr = cleaned.substring(7, 12);
      const weight = parseInt(weightStr, 10) / 1000;
      return { plu, weight, rawBarcode: cleaned };
    }
    return null;
  } catch (e) {
    return null;
  }
};

describe('Carcass Barcode Parsing (Code 128)', () => {
  
  it('should parse valid barcode PA2202501061234100', () => {
    const result = parseCarcassBarcode('PA2202501061234100');
    expect(result).not.toBeNull();
    expect(result.killDate).toBe('2025-01-06');
    expect(result.killDateDisplay).toBe('06/01/2025');
    expect(result.killNumber).toBe('1234');
  });

  it('should parse barcode PA2202501055678100', () => {
    const result = parseCarcassBarcode('PA2202501055678100');
    expect(result).not.toBeNull();
    expect(result.killDate).toBe('2025-01-05');
    expect(result.killNumber).toBe('5678');
  });

  it('should parse barcode PA2202412289999100', () => {
    const result = parseCarcassBarcode('PA2202412289999100');
    expect(result).not.toBeNull();
    expect(result.killDate).toBe('2024-12-28');
    expect(result.killNumber).toBe('9999');
  });

  it('should handle lowercase input', () => {
    const result = parseCarcassBarcode('pa2202501061234100');
    expect(result).not.toBeNull();
    expect(result.killNumber).toBe('1234');
  });

  it('should handle whitespace', () => {
    const result = parseCarcassBarcode('  PA2202501061234100  ');
    expect(result).not.toBeNull();
    expect(result.killNumber).toBe('1234');
  });

  it('should return null for barcode too short', () => {
    const result = parseCarcassBarcode('PA220250106');
    expect(result).toBeNull();
  });

  it('should return null for invalid month (13)', () => {
    const result = parseCarcassBarcode('PA2202513061234100');
    expect(result).toBeNull();
  });

  it('should return null for invalid day (32)', () => {
    const result = parseCarcassBarcode('PA2202501321234100');
    expect(result).toBeNull();
  });

  it('should return null for Feb 30 (invalid date)', () => {
    const result = parseCarcassBarcode('PA2202502301234100');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseCarcassBarcode('');
    expect(result).toBeNull();
  });

});

describe('Product Barcode Parsing (EAN-13 Format 14)', () => {
  // Format 14: 26 PPPP V WWWWW C
  // Weight is in positions 7-11, divide by 1000 for kg

  it('should parse barcode with PLU 1076 and weight 18.805kg', () => {
    // 26 1076 0 18805 3
    const result = parseProductBarcode('2610760188053');
    expect(result).not.toBeNull();
    expect(result.plu).toBe('1076');
    expect(result.weight).toBeCloseTo(18.805, 3);
  });

  it('should parse barcode with PLU 1234 and weight 2.500kg', () => {
    // 26 1234 0 02500 X (checksum varies)
    const result = parseProductBarcode('2612340025007');
    expect(result).not.toBeNull();
    expect(result.plu).toBe('1234');
    expect(result.weight).toBeCloseTo(2.500, 3);
  });

  it('should parse barcode with small weight 0.500kg', () => {
    // 26 1001 0 00500 X
    const result = parseProductBarcode('2610010005003');
    expect(result).not.toBeNull();
    expect(result.plu).toBe('1001');
    expect(result.weight).toBeCloseTo(0.500, 3);
  });

  it('should parse Format 15 barcode (prefix 27, 5-digit PLU)', () => {
    // 27 12345 02500 X
    const result = parseProductBarcode('2712345025001');
    expect(result).not.toBeNull();
    expect(result.plu).toBe('12345');
    expect(result.weight).toBeCloseTo(2.500, 3);
  });

  it('should return null for wrong prefix', () => {
    const result = parseProductBarcode('2510760188053');
    expect(result).toBeNull();
  });

  it('should return null for barcode too short', () => {
    const result = parseProductBarcode('261076018');
    expect(result).toBeNull();
  });

  it('should return null for barcode too long', () => {
    const result = parseProductBarcode('26107601880531');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseProductBarcode('');
    expect(result).toBeNull();
  });

  it('should handle whitespace by trimming', () => {
    // After trim, length is 13, so it should parse
    const result = parseProductBarcode('  2610760188053  '.trim());
    expect(result).not.toBeNull();
    expect(result.plu).toBe('1076');
  });

});

describe('Edge Cases', () => {

  it('should handle leap year date Feb 29', () => {
    const result = parseCarcassBarcode('PA2202402291234100');
    expect(result).not.toBeNull();
    expect(result.killDate).toBe('2024-02-29');
  });

  it('should reject Feb 29 on non-leap year', () => {
    const result = parseCarcassBarcode('PA2202302291234100');
    expect(result).toBeNull();
  });

  it('should handle zero weight in product barcode', () => {
    const result = parseProductBarcode('2610760000003');
    expect(result).not.toBeNull();
    expect(result.weight).toBe(0);
  });

  it('should handle max PLU 9999 in Format 14', () => {
    // 26 9999 0 01000 X (1.000 kg)
    const result = parseProductBarcode('2699990010007');
    expect(result).not.toBeNull();
    expect(result.plu).toBe('9999');
    expect(result.weight).toBeCloseTo(1.000, 3);
  });

  it('should handle weight 99.999kg (max)', () => {
    const result = parseProductBarcode('2610760999993');
    expect(result).not.toBeNull();
    expect(result.weight).toBeCloseTo(99.999, 3);
  });

});
