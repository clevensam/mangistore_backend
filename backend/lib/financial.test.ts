import { describe, it, expect } from 'vitest';
import {
  calculateProfit,
  calculateMargin,
  calculateMarkup,
  calculateTotalRevenue,
  calculateTotalCost,
  calculateProfitMargin,
  formatIndianNumber,
} from '../lib/financial';

describe('financial helpers', () => {
  it('calculates profit', () => {
    expect(calculateProfit(100, 70)).toBe(30);
  });

  it('calculates margin percentage', () => {
    expect(calculateMargin(100, 70)).toBe(30);
    expect(calculateMargin(0, 70)).toBe(0);
  });

  it('calculates markup percentage', () => {
    expect(calculateMarkup(100, 150)).toBe(50);
    expect(calculateMarkup(0, 150)).toBe(0);
  });

  it('sums total revenue from sales', () => {
    const sales = [{ total_price: 100 }, { total_price: 50.5 }];
    expect(calculateTotalRevenue(sales)).toBeCloseTo(150.5);
  });

  it('sums total cost from nested product buying_price', () => {
    const sales = [{ product: { buying_price: 40 } }, { product: { buying_price: 30 } }];
    expect(calculateTotalCost(sales)).toBe(70);
  });

  it('calculates profit margin', () => {
    expect(calculateProfitMargin(100, 25)).toBe(25);
    expect(calculateProfitMargin(0, 5)).toBe(0);
  });

  it('formats indian number notation', () => {
    expect(formatIndianNumber(0)).toBe('0');
    expect(formatIndianNumber(999)).toBe('999');
    expect(formatIndianNumber(1000)).toBe('1,000');
    expect(formatIndianNumber(100000)).toBe('1,00,000');
    expect(formatIndianNumber(12345678)).toBe('1,23,45,678');
  });
});
