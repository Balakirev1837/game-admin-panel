const { validateConfigData, FACTORIO_CONFIG_FIELDS } = require('../src/services/factorioConfig');

describe('factorioConfig - validation', () => {
  it('should validate correct data', () => {
    const result = validateConfigData({ json: { name: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { name: big } });
    expect(result.valid).toBe(false);
  });

  it('should have FACTORIO_CONFIG_FIELDS defined', () => {
    expect(FACTORIO_CONFIG_FIELDS).toBeDefined();
    expect(FACTORIO_CONFIG_FIELDS.length).toBeGreaterThan(0);
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('key');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('label');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('type');
  });
});
