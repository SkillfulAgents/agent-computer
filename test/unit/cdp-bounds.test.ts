import { describe, test, expect } from 'vitest';
import { getBounds, toScreenCoords } from '../../src/cdp/bounds.js';

// Mock connection
function createMockConnection(boxModel: any): any {
  return {
    send: async (method: string, params?: any) => {
      if (method === 'DOM.getBoxModel') {
        if (boxModel === null) throw new Error('Could not get box model');
        return { model: boxModel };
      }
      return {};
    },
  };
}

describe('CDP Bounds', () => {
  test('getBounds extracts CSS bounds from box model', async () => {
    const boxModel = {
      content: [10, 20, 110, 20, 110, 70, 10, 70],
      padding: [10, 20, 110, 20, 110, 70, 10, 70],
      border: [10, 20, 110, 20, 110, 70, 10, 70],
      margin: [10, 20, 110, 20, 110, 70, 10, 70],
      width: 100,
      height: 50,
    };

    const conn = createMockConnection(boxModel);
    const bounds = await getBounds(conn, 123);

    expect(bounds[0]).toBe(10);  // x
    expect(bounds[1]).toBe(20);  // y
    expect(bounds[2]).toBe(100); // width
    expect(bounds[3]).toBe(50);  // height
  });

  test('getBounds returns [0,0,0,0] on error', async () => {
    const conn = createMockConnection(null);
    const bounds = await getBounds(conn, 999);
    expect(bounds).toEqual([0, 0, 0, 0]);
  });

  test('toScreenCoords applies scale and offset', () => {
    const cssBounds: [number, number, number, number] = [50, 100, 200, 150];
    const windowBounds: [number, number, number, number] = [100, 50, 800, 600];
    const contentOffset = { x: 0, y: 0 };
    const scaleFactor = 2;

    const result = toScreenCoords(cssBounds, windowBounds, contentOffset, scaleFactor);

    expect(result[0]).toBe(100 + 50 * 2); // windowX + cssX * scale = 200
    expect(result[1]).toBe(50 + 100 * 2); // windowY + cssY * scale = 250
    expect(result[2]).toBe(200 * 2);       // width * scale = 400
    expect(result[3]).toBe(150 * 2);       // height * scale = 300
  });

  test('toScreenCoords with content offset', () => {
    const cssBounds: [number, number, number, number] = [10, 20, 100, 50];
    const windowBounds: [number, number, number, number] = [0, 0, 800, 600];
    const contentOffset = { x: 5, y: 10 };
    const scaleFactor = 1;

    const result = toScreenCoords(cssBounds, windowBounds, contentOffset, scaleFactor);

    expect(result[0]).toBe(0 + (10 + 5) * 1); // 15
    expect(result[1]).toBe(0 + (20 + 10) * 1); // 30
  });
});
