const { validateConfigData, TERRARIA_CONFIG_FIELDS } = require('../src/services/terrariaConfig');

describe('terrariaConfig - validation', () => {
  it('should validate correct data', () => {
    const result = validateConfigData({ json: { ServerName: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { ServerName: big } });
    expect(result.valid).toBe(false);
  });

  it('should have TERRARIA_CONFIG_FIELDS defined', () => {
    expect(TERRARIA_CONFIG_FIELDS).toBeDefined();
    expect(TERRARIA_CONFIG_FIELDS.length).toBeGreaterThan(0);
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('key');
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('label');
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('type');
  });
});
