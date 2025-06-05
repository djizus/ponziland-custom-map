import { calculateROI } from './taxCalculations';

// Update value color to use pure green/red gradients with more grey near zero
export const getValueColor = (price: string | null, profitPerHour: number): string => {
  if (!price) return '#2a2a2a';  // No price = dark gray
  
  // Negative yield = grey to red progression
  if (profitPerHour <= -20) return '#4d1515';  // Very negative yield = darkest red
  if (profitPerHour <= -15) return '#4d1818';
  if (profitPerHour <= -10) return '#4d1b1b';
  if (profitPerHour <= -7) return '#452020';   // More grey-red
  if (profitPerHour <= -5) return '#403030';   // Very grey-red
  if (profitPerHour <= -3) return '#383232';   // Almost grey with red tint
  if (profitPerHour < 0) return '#333232';     // Barely red grey
  
  // Zero and near-zero yields = grey progression
  if (profitPerHour === 0) return '#2d2d2d';   // Pure grey
  if (profitPerHour <= 1) return '#2d2e2d';    // Barely green grey
  if (profitPerHour <= 3) return '#2d302d';    // Almost grey with green tint
  if (profitPerHour <= 5) return '#2d332d';    // Very grey-green
  if (profitPerHour <= 7) return '#2d362d';    // More grey-green
  
  // Higher positive yield = stronger green progression
  if (profitPerHour <= 10) return '#1a331a';
  if (profitPerHour <= 15) return '#1a391a';
  if (profitPerHour <= 20) return '#1a3f1a';
  if (profitPerHour <= 30) return '#1a451a';
  if (profitPerHour <= 40) return '#1a4b1a';
  if (profitPerHour <= 50) return '#1a511a';
  return '#1a571a';                            // Highest yield = brightest green
};

// Update opportunity color to highlight high ROI only for lands with significant yield
export const getOpportunityColor = (profitPerHour: number, landPriceESTRK: number): string => {
  // Only consider ROI for lands earning more than 10 tokens per hour
  if (profitPerHour <= 4) return '#333';
  const roi = calculateROI(profitPerHour, landPriceESTRK);
  if (roi <= 10) return '#333';  // MODIFIED: Require minimum 50% hourly ROI
  
  // Scale intensity based on ROI for high-yield lands
  // Max brightness at 100% ROI, starting from 0%
  const intensity = Math.min((roi) / 100, 1); // MODIFIED: (roi - 50) / (400 - 50)
  
  return `rgba(0, 255, 255, ${intensity})`; // Cyan color for high ROI + high yield borders
}; 