import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { randomUUID } from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return randomUUID()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + "..."
}

export function now(): Date {
  return new Date()
}
