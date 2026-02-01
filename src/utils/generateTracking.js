import { v4 as uuidv4 } from "uuid";

/**
 * Generates a professional tracking number
 * Format: DVX-2025-XXXXXXXX
 * Example: DVX-2025-A9F3C21D
 */
const generateTrackingNumber = () => {
  const year = new Date().getFullYear();
  const randomCode = uuidv4().split("-")[0].toUpperCase();

  return `DVX-${year}-${randomCode}`;
};

export default generateTrackingNumber;
