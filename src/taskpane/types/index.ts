import React from "react";

export interface StudentMarks {
  fard1: number | null;
  fard2: number | null;
  fard3: number | null;
  activities: number | null;
  [key: string]: number | null; // To allow dynamic access
}

/**
 * Represents a student with their marks
 */
export interface Student {
  number: number;
  name: string;
  marks: StudentMarks;
}

/**
 * Type for mark type selection
 */
export type MarkType = "fard1" | "fard2" | "fard3" | "activities";

/**
 * Represents the display name of a mark type in Arabic
 */
export const markTypeNames: Record<MarkType, string> = {
  fard1: "الفرض 1",
  fard2: "الفرض 2",
  fard3: "الفرض 3",
  activities: "الأنشطة",
};

/**
 * Excel file validation status
 */
export interface ExcelStatus {
  isValid: boolean;
  checked: boolean;
  message?: string;
}

/**
 * Excel worksheet structure
 */
export interface WorksheetStructure {
  headers: string[];
  studentNameColumn: number;
  studentNumberColumn: number; // Added for better student identification
  totalRows: number;
  markColumns: Record<MarkType, number>;
}

/**
 * Results of inserting marks into Excel
 */
export interface MarkInsertionResults {
  success: number;
  notFound: number;
  notFoundStudents: string[];
}

/**
 * Alert type for status messages
 */
export type AlertType = "error" | "warning" | "info" | "success";

/**
 * Application steps
 */
export enum AppStep {
  ImageProcessing = 1,
  FileAnalysis = 2,
  ReviewConfirm = 3,
}

/**
 * Props for the Step component
 */
export interface StepProps {
  number: number;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
}
