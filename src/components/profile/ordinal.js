/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", … */
export const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] || "th"}`;
