/**
 * PeakMode — Food Options Data
 * ─────────────────────────────
 * Realistic food choices for an Indian college hostel student.
 * Used by the Smart Food Decision Engine to recommend meals based on
 * the user's remaining daily budget, protein target, and gym schedule.
 *
 * Fields:
 *   name          : string   — display name
 *   source        : string   — where it comes from (Mess / Self / Blinkit / etc.)
 *   estimatedCost : number   — cost in ₹ (0 for mess meals)
 *   protein       : number   — grams of protein
 *   calories      : number   — kcal
 *   isHealthy     : boolean  — whether it's a clean / goal-aligned option
 *   notes         : string   — practical advice for a hostel student
 */

const foodOptions = [

  // ─── MESS OPTIONS (₹0) ───────────────────────────────────────────────────

  {
    name:          'Dal + 3 Rotis',
    source:        'Mess',
    estimatedCost: 0,
    protein:       12,
    calories:      380,
    isHealthy:     true,
    notes:         'decent option, avoid if dal is too watery',
  },
  {
    name:          'Rajma Chawal',
    source:        'Mess',
    estimatedCost: 0,
    protein:       15,
    calories:      480,
    isHealthy:     true,
    notes:         'one of the better mess meals for protein',
  },
  {
    name:          'Chole + Rice',
    source:        'Mess',
    estimatedCost: 0,
    protein:       13,
    calories:      460,
    isHealthy:     true,
    notes:         'good on chole days, skip if too oily',
  },
  {
    name:          'Paneer Sabzi + Roti',
    source:        'Mess',
    estimatedCost: 0,
    protein:       14,
    calories:      400,
    isHealthy:     true,
    notes:         'good protein if paneer quantity is decent',
  },
  {
    name:          'Fried Rice / Noodles',
    source:        'Mess',
    estimatedCost: 0,
    protein:       7,
    calories:      520,
    isHealthy:     false,
    notes:         'high oil, low protein, avoid on gym days',
  },
  {
    name:          'Poha / Upma (breakfast)',
    source:        'Mess',
    estimatedCost: 0,
    protein:       5,
    calories:      250,
    isHealthy:     false,
    notes:         'low protein, pair with eggs if possible',
  },
  {
    name:          'Oily Sabzi + Rice',
    source:        'Mess',
    estimatedCost: 0,
    protein:       6,
    calories:      500,
    isHealthy:     false,
    notes:         'avoid, order outside on these days',
  },

  // ─── SELF-ARRANGED / ROOM OPTIONS ────────────────────────────────────────

  {
    name:          '3 Boiled Eggs',
    source:        'Self',
    estimatedCost: 18,
    protein:       18,
    calories:      210,
    isHealthy:     true,
    notes:         'best cheap protein, always keep eggs in room',
  },
  {
    name:          '4 Boiled Eggs',
    source:        'Self',
    estimatedCost: 24,
    protein:       24,
    calories:      280,
    isHealthy:     true,
    notes:         'post workout staple',
  },
  {
    name:          'Peanut Butter + 2 Bread Slices',
    source:        'Self',
    estimatedCost: 25,
    protein:       10,
    calories:      320,
    isHealthy:     true,
    notes:         'good pre-gym snack',
  },
  {
    name:          'Sattu Drink (2 tbsp sattu + water)',
    source:        'Self',
    estimatedCost: 10,
    protein:       8,
    calories:      100,
    isHealthy:     true,
    notes:         'cheap, underrated protein source for hostel students',
  },
  {
    name:          'Milk 500ml (from canteen)',
    source:        'Self',
    estimatedCost: 25,
    protein:       16,
    calories:      300,
    isHealthy:     true,
    notes:         'easy protein boost, good before sleep',
  },
  {
    name:          'Curd 200g (from canteen)',
    source:        'Self',
    estimatedCost: 20,
    protein:       7,
    calories:      120,
    isHealthy:     true,
    notes:         'good for gut health and recovery',
  },

  // ─── BLINKIT / SWIGGY INSTAMART OPTIONS ──────────────────────────────────

  {
    name:          'Suji Pasta + 2 Eggs (cooked in room)',
    source:        'Blinkit',
    estimatedCost: 80,
    protein:       22,
    calories:      380,
    isHealthy:     true,
    notes:         'best value meal, high protein, filling',
  },
  {
    name:          'Oats 100g + Milk',
    source:        'Blinkit',
    estimatedCost: 30,
    protein:       12,
    calories:      320,
    isHealthy:     true,
    notes:         'great breakfast, slow digesting carbs',
  },
  {
    name:          'Paneer 100g (raw, eaten with roti from mess)',
    source:        'Blinkit',
    estimatedCost: 45,
    protein:       18,
    calories:      265,
    isHealthy:     true,
    notes:         'buy when mess paneer quantity is low',
  },
  {
    name:          'Whey Protein Sachet (single serve)',
    source:        'Blinkit',
    estimatedCost: 60,
    protein:       24,
    calories:      130,
    isHealthy:     true,
    notes:         'use on heavy gym days when protein is short',
  },
  {
    name:          'Banana x3',
    source:        'Blinkit',
    estimatedCost: 30,
    protein:       4,
    calories:      270,
    isHealthy:     true,
    notes:         'good pre-gym energy, pair with peanut butter',
  },
  {
    name:          'Bread + Eggs (4 eggs, 4 bread)',
    source:        'Blinkit',
    estimatedCost: 55,
    protein:       26,
    calories:      420,
    isHealthy:     true,
    notes:         'most filling budget meal',
  },

  // ─── OUTSIDE ORDER OPTIONS ────────────────────────────────────────────────

  {
    name:          'Paneer Pizza Personal (Dominos)',
    source:        'Dominos',
    estimatedCost: 199,
    protein:       18,
    calories:      580,
    isHealthy:     false,
    notes:         'order only when mess is very bad, high calories',
  },
  {
    name:          'Chicken Roll (KFC)',
    source:        'KFC',
    estimatedCost: 230,
    protein:       24,
    calories:      430,
    isHealthy:     true,
    notes:         'best outside order for protein to cost ratio',
  },
  {
    name:          'Chicken Zinger Burger (KFC)',
    source:        'KFC',
    estimatedCost: 199,
    protein:       20,
    calories:      490,
    isHealthy:     false,
    notes:         'tasty but high fat, occasional treat',
  },
  {
    name:          'Egg Roll (local dhaba)',
    source:        'Dhaba',
    estimatedCost: 50,
    protein:       14,
    calories:      320,
    isHealthy:     true,
    notes:         'cheap, decent protein, go-to budget outside meal',
  },
  {
    name:          'Chicken Biryani (Swiggy local)',
    source:        'Swiggy',
    estimatedCost: 120,
    protein:       22,
    calories:      550,
    isHealthy:     true,
    notes:         'good protein, slightly heavy, avoid pre-workout',
  },
  {
    name:          'Paneer Wrap (Swiggy local)',
    source:        'Swiggy',
    estimatedCost: 100,
    protein:       15,
    calories:      400,
    isHealthy:     true,
    notes:         'decent veg option when ordering outside',
  },
  {
    name:          'Chicken Frankie (local stall)',
    source:        'Local',
    estimatedCost: 60,
    protein:       16,
    calories:      370,
    isHealthy:     true,
    notes:         'best street food option near most colleges',
  },
  {
    name:          'Dal Makhani + 2 Naan (Swiggy)',
    source:        'Swiggy',
    estimatedCost: 150,
    protein:       16,
    calories:      620,
    isHealthy:     false,
    notes:         'high butter, occasional meal only',
  },

  // ─── CANTEEN OPTIONS ──────────────────────────────────────────────────────

  {
    name:          'Bread Omelette (2 eggs)',
    source:        'Canteen',
    estimatedCost: 40,
    protein:       14,
    calories:      300,
    isHealthy:     true,
    notes:         'solid breakfast, available in most college canteens',
  },
  {
    name:          'Maggi + Egg',
    source:        'Canteen',
    estimatedCost: 50,
    protein:       10,
    calories:      380,
    isHealthy:     false,
    notes:         'comfort food, low protein, avoid on gym days',
  },
  {
    name:          'Samosa x2',
    source:        'Canteen',
    estimatedCost: 20,
    protein:       4,
    calories:      280,
    isHealthy:     false,
    notes:         'low protein, high oil, snack only',
  },
  {
    name:          'Lassi 300ml',
    source:        'Canteen',
    estimatedCost: 30,
    protein:       8,
    calories:      220,
    isHealthy:     true,
    notes:         'good protein + probiotic, have post mess meal',
  },

];

module.exports = foodOptions;
