import type { ExpressionOutput } from '../entities/assistance.js';

export const EXPRESSION_GENERATOR = Symbol('EXPRESSION_GENERATOR');

export interface ExpressionGenerator {
  readonly category: string;
  generate(input: {
    requestId: string;
    text: string;
    topic: string;
    cefrLevel: string;
  }): Promise<{ output: ExpressionOutput; usageUnits: number }>;
}
