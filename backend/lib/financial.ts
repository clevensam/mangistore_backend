export function calculateProfit(revenue: number, cost: number): number {
  return revenue - cost;
}

export function calculateMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

export function calculateMarkup(cost: number, sellingPrice: number): number {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
}

export function calculateTotalRevenue(sales: { total_price: number }[]): number {
  return sales.reduce((sum, s) => sum + Number(s.total_price), 0);
}

export function calculateTotalCost(sales: { product: { buying_price: number } }[]): number {
  return sales.reduce((sum, s) => sum + Number(s.product.buying_price), 0);
}

export function calculateProfitMargin(revenue: number, profit: number): number {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
}

export function formatIndianNumber(n: number): string {
  const str = Math.floor(n).toString();
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  if (rest === '') return lastThree;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
}
