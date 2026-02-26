import type { Level } from '../types';

export interface ParseError {
  line: number;
  column?: number;
  message: string;
}

export interface ParseResult {
  level: Level | null;
  errors: ParseError[];
  warnings: ParseError[];
}

/** Internal: a legend entry parsed from "C = type:color:key=val" */
export interface LegendEntry {
  char: string;
  tileType: string;
  color?: string;
  meta?: Record<string, string>;
}

/** Internal: a raw entity parsed before resolution */
export interface RawEntity {
  line: number;
  entityType: string;
  color: string;
  x: number;
  y: number;
  targetChar?: string;
  rules: Array<{ type: string; value?: number }>;
}
