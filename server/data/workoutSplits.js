/**
 * PeakMode — Workout Splits Data
 * ────────────────────────────────
 * Static workout split templates keyed by number of gym days per week.
 * Used by the Dynamic Workout Split Generator to return a ready-made
 * plan based on however many days the student can train that week.
 *
 * Shape:
 *   {
 *     3: [ { day, name, muscleGroups, exercises: [ { name, sets, reps, notes } ] } ],
 *     4: [ ... ],
 *     5: [ ... ],
 *   }
 */

const workoutSplits = {

  // ─── 3-DAY SPLIT (Full Body x3) ──────────────────────────────────────────
  3: [
    {
      day:          1,
      name:         'Full Body A',
      muscleGroups: ['chest', 'back', 'legs'],
      exercises: [
        { name: 'Squats',            sets: 4, reps: '8-10',  notes: 'focus on depth' },
        { name: 'Bench Press',       sets: 4, reps: '8-10',  notes: 'controlled tempo' },
        { name: 'Lat Pulldown',      sets: 3, reps: '10-12', notes: 'full stretch at top' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10',    notes: 'feel the hamstring stretch' },
        { name: 'Plank',             sets: 3, reps: '45 sec', notes: 'core stability' },
      ],
    },
    {
      day:          2,
      name:         'Full Body B',
      muscleGroups: ['shoulders', 'arms', 'legs'],
      exercises: [
        { name: 'Overhead Press', sets: 4, reps: '8-10',  notes: 'keep core tight' },
        { name: 'Leg Press',      sets: 4, reps: '10-12', notes: 'controlled negative' },
        { name: 'Barbell Rows',   sets: 3, reps: '10',    notes: 'squeeze shoulder blades' },
        { name: 'Bicep Curls',    sets: 3, reps: '12',    notes: 'no swinging' },
        { name: 'Tricep Dips',    sets: 3, reps: '12',    notes: 'full range of motion' },
      ],
    },
    {
      day:          3,
      name:         'Full Body C',
      muscleGroups: ['back', 'chest', 'core'],
      exercises: [
        { name: 'Deadlifts',               sets: 4, reps: '6-8',  notes: 'maintain neutral spine' },
        { name: 'Incline Dumbbell Press',  sets: 4, reps: '10',   notes: 'squeeze at top' },
        { name: 'Pull-ups',                sets: 3, reps: 'max reps', notes: 'use assist band if needed' },
        { name: 'Leg Raises',              sets: 3, reps: '15',  notes: 'control the descent' },
        { name: 'Face Pulls',              sets: 3, reps: '15',  notes: 'rear delt focus' },
      ],
    },
  ],

  // ─── 4-DAY SPLIT (Upper/Lower x2) ────────────────────────────────────────
  4: [
    {
      day:          1,
      name:         'Upper Body A',
      muscleGroups: ['chest', 'shoulders', 'triceps'],
      exercises: [
        { name: 'Bench Press',             sets: 4, reps: '8-10',  notes: 'primary strength move' },
        { name: 'Overhead Press',          sets: 3, reps: '10',    notes: 'control the weight' },
        { name: 'Incline Dumbbell Press',  sets: 3, reps: '10-12', notes: 'upper chest focus' },
        { name: 'Tricep Pushdown',         sets: 3, reps: '12',    notes: 'full extension' },
        { name: 'Lateral Raises',          sets: 3, reps: '15',    notes: 'light weight, strict form' },
      ],
    },
    {
      day:          2,
      name:         'Lower Body A',
      muscleGroups: ['quads', 'hamstrings', 'calves'],
      exercises: [
        { name: 'Squats',            sets: 4, reps: '8-10', notes: 'primary leg movement' },
        { name: 'Romanian Deadlift', sets: 4, reps: '10',   notes: 'hamstring focus' },
        { name: 'Leg Press',         sets: 3, reps: '12',   notes: 'high volume' },
        { name: 'Leg Curls',         sets: 3, reps: '12',   notes: 'controlled tempo' },
        { name: 'Calf Raises',       sets: 4, reps: '15',   notes: 'pause at top' },
      ],
    },
    {
      day:          3,
      name:         'Upper Body B',
      muscleGroups: ['back', 'biceps', 'shoulders'],
      exercises: [
        { name: 'Pull-ups',     sets: 4, reps: 'max reps', notes: 'vertical pull focus' },
        { name: 'Barbell Rows', sets: 4, reps: '10',       notes: 'horizontal pull focus' },
        { name: 'Lat Pulldown', sets: 3, reps: '12',       notes: 'wide grip' },
        { name: 'Bicep Curls',  sets: 3, reps: '12',       notes: 'strict form' },
        { name: 'Face Pulls',   sets: 3, reps: '15',       notes: 'rear delt and posture' },
      ],
    },
    {
      day:          4,
      name:         'Lower Body B + Core',
      muscleGroups: ['glutes', 'hamstrings', 'abs'],
      exercises: [
        { name: 'Deadlifts',               sets: 4, reps: '6-8',          notes: 'heaviest lift of the week' },
        { name: 'Bulgarian Split Squats',  sets: 3, reps: '10 each leg',  notes: 'balance focus' },
        { name: 'Hip Thrusts',             sets: 3, reps: '12',           notes: 'glute focus' },
        { name: 'Hanging Leg Raises',      sets: 3, reps: '12',           notes: 'core control' },
        { name: 'Plank',                   sets: 3, reps: '60 sec',       notes: 'core endurance' },
      ],
    },
  ],

  // ─── 5-DAY SPLIT (Bro Split) ──────────────────────────────────────────────
  5: [
    {
      day:          1,
      name:         'Chest',
      muscleGroups: ['chest', 'triceps'],
      exercises: [
        { name: 'Bench Press',            sets: 4, reps: '8-10',  notes: 'main strength lift' },
        { name: 'Incline Dumbbell Press', sets: 4, reps: '10',    notes: 'upper chest' },
        { name: 'Cable Flyes',            sets: 3, reps: '12-15', notes: 'squeeze and stretch' },
        { name: 'Tricep Pushdown',        sets: 3, reps: '12',    notes: 'isolation finish' },
        { name: 'Dips',                   sets: 3, reps: 'max reps', notes: 'compound finisher' },
      ],
    },
    {
      day:          2,
      name:         'Back',
      muscleGroups: ['back', 'biceps'],
      exercises: [
        { name: 'Deadlifts',    sets: 4, reps: '6-8',      notes: 'primary back movement' },
        { name: 'Pull-ups',     sets: 4, reps: 'max reps', notes: 'width focus' },
        { name: 'Barbell Rows', sets: 4, reps: '10',       notes: 'thickness focus' },
        { name: 'Lat Pulldown', sets: 3, reps: '12',       notes: 'controlled pull' },
        { name: 'Bicep Curls',  sets: 3, reps: '12',       notes: 'strict form' },
      ],
    },
    {
      day:          3,
      name:         'Legs',
      muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'],
      exercises: [
        { name: 'Squats',            sets: 5, reps: '8-10',  notes: 'main leg movement' },
        { name: 'Romanian Deadlift', sets: 4, reps: '10',    notes: 'posterior chain' },
        { name: 'Leg Press',         sets: 3, reps: '12',    notes: 'volume work' },
        { name: 'Leg Extensions',    sets: 3, reps: '15',    notes: 'quad isolation' },
        { name: 'Calf Raises',       sets: 4, reps: '15-20', notes: 'full stretch and squeeze' },
      ],
    },
    {
      day:          4,
      name:         'Shoulders',
      muscleGroups: ['shoulders', 'traps'],
      exercises: [
        { name: 'Overhead Press', sets: 4, reps: '8-10', notes: 'main shoulder lift' },
        { name: 'Lateral Raises', sets: 4, reps: '15',   notes: 'side delt focus' },
        { name: 'Rear Delt Flyes', sets: 3, reps: '15',  notes: 'rear delt focus' },
        { name: 'Front Raises',   sets: 3, reps: '12',   notes: 'front delt focus' },
        { name: 'Shrugs',         sets: 3, reps: '15',   notes: 'trap focus' },
      ],
    },
    {
      day:          5,
      name:         'Arms + Core',
      muscleGroups: ['biceps', 'triceps', 'abs'],
      exercises: [
        { name: 'Close Grip Bench Press', sets: 4, reps: '10', notes: 'tricep focus' },
        { name: 'Barbell Curls',          sets: 4, reps: '10', notes: 'bicep mass builder' },
        { name: 'Hammer Curls',           sets: 3, reps: '12', notes: 'forearm and bicep' },
        { name: 'Skull Crushers',         sets: 3, reps: '12', notes: 'tricep isolation' },
        { name: 'Hanging Leg Raises',     sets: 3, reps: '15', notes: 'core finisher' },
      ],
    },
  ],

};

module.exports = workoutSplits;
