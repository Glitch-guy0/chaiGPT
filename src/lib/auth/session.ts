// Auth session contract as a function type returning userId or null
// Concrete Clerk wiring is Story 2.3 scope
export type Session = () => Promise<string | null>;
