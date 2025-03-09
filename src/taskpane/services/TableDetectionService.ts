import { Student, StudentMarks } from "../types";

interface GridPosition {
  row: number;
  col: number;
}

interface TableCell {
  text: string;
  position: GridPosition;
  isNumeric: boolean;
  value: number | null;
}

interface TableStructure {
  headerRow: number;
  studentIdColumn: number;
  studentNameColumn: number;
  markColumns: number[];
  rowCount: number;
  colCount: number;
  cells: TableCell[][];
}

class TableDetectionService {
  /**
   * Analyzes OCR text to detect and extract a tabular structure
   */
  detectTable(lines: string[]): TableStructure | null {
    console.log("Starting table detection...");

    try {
      // Step 1: Create a preliminary grid from the OCR text
      const preliminaryGrid = this.createPreliminaryGrid(lines);
      if (!preliminaryGrid || preliminaryGrid.length === 0) {
        console.error("Failed to create preliminary grid");
        return null;
      }

      // Step 2: Identify structural elements of the table
      const tableStructure = this.identifyTableStructure(preliminaryGrid);
      if (!tableStructure) {
        console.error("Failed to identify table structure");
        return null;
      }

      return tableStructure;
    } catch (error) {
      console.error("Error in table detection:", error);
      return null;
    }
  }

  /**
   * Creates a preliminary grid from the OCR text lines
   */
  private createPreliminaryGrid(lines: string[]): TableCell[][] {
    const grid: TableCell[][] = [];

    // First scan through lines to identify potential data rows
    // We're looking for patterns that indicate the start of student data
    let dataStartLine = -1;

    // Try to identify where the student data table starts
    for (let i = 0; i < lines.length; i++) {
      // Look for common table header indicators
      if (
        lines[i].includes("رقم") ||
        lines[i].includes("اسم") ||
        lines[i].includes("الفرض") ||
        lines[i].includes("ر.ت")
      ) {
        dataStartLine = i;
        break;
      }
    }

    if (dataStartLine === -1) {
      // If we couldn't find a clear header, look for numbered lines that might be student entries
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\d+\s/.test(lines[i])) {
          dataStartLine = Math.max(0, i - 1); // Start from one line before the first numbered line
          break;
        }
      }

      if (dataStartLine === -1) {
        console.error("Could not identify start of data table");
        return grid;
      }
    }

    // Start processing from the identified data start line
    const processedLines = lines.slice(dataStartLine);

    // Identify rows that are likely part of the table based on patterns
    const tableRowIndices: number[] = [];

    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i].trim();

      // Skip empty lines
      if (line.length === 0) continue;

      // Student rows often start with a number
      if (
        /^\d+/.test(line) ||
        /^\|\s*\d+/.test(line) || // Handle lines that start with pipe then number
        /^[\u0600-\u06FF\s]+$/.test(line) || // Arabic text only lines (student names)
        /\d{1,2}[.,]\d{2}/.test(line)
      ) {
        // Lines with mark pattern (e.g., 14.50)
        tableRowIndices.push(i);
      }
    }

    console.log("Detected table row indices:", tableRowIndices);

    // If we have few rows, we may have missed some - try to include more
    if (tableRowIndices.length < 5 && processedLines.length > 10) {
      console.log("Few rows detected, trying alternate detection method");

      // Alternative: use a sliding window to look for clusters of text that might be rows
      tableRowIndices.length = 0; // Clear the array

      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i].trim();

        // Skip very long or very short lines - they're unlikely to be part of the table
        if (line.length > 100 || line.length < 2) continue;

        // Include lines with Arabic text or numbers
        if (/[\u0600-\u06FF]/.test(line) || /\d/.test(line)) {
          tableRowIndices.push(i);
        }
      }
    }

    // Now create the actual grid from these identified rows
    console.log("Processing lines for grid, table rows count:", tableRowIndices.length);

    for (let rowIndex = 0; rowIndex < tableRowIndices.length; rowIndex++) {
      const lineIndex = tableRowIndices[rowIndex];
      const line = processedLines[lineIndex];

      grid[rowIndex] = this.parseLine(line, rowIndex);
    }

    return this.refineGrid(grid);
  }

  /**
   * Parses a line of text into table cells
   */
  private parseLine(line: string, rowIndex: number): TableCell[] {
    const cells: TableCell[] = [];

    // Try to split the line into segments that might represent columns
    // This is challenging without clear delimiters, so we'll use heuristics

    // First attempt: split by multiple spaces or pipe characters
    let segments = line.split(/\s{2,}|\|/).filter((s) => s.trim().length > 0);

    // If we only got one segment, try other approaches
    if (segments.length <= 1) {
      // Try to identify numbers that might be marks
      const markPattern = /\b(\d{1,2}(?:[.,]\d{1,2})?)\b/g;
      let match;
      const marks: string[] = [];

      while ((match = markPattern.exec(line)) !== null) {
        marks.push(match[1]);
      }

      // If we found marks, separate them from the rest of the text
      if (marks.length > 0) {
        // Extract text that's not a mark
        let textContent = line;
        marks.forEach((mark) => {
          textContent = textContent.replace(mark, "|");
        });

        // Split by the pipe we inserted
        segments = textContent.split("|").filter((s) => s.trim().length > 0);

        // Add the marks back as separate segments
        segments = segments.concat(marks);
      }
    }

    // Process the segments into cells
    for (let colIndex = 0; colIndex < segments.length; colIndex++) {
      const text = segments[colIndex].trim();

      // Skip empty cells
      if (text.length === 0) continue;

      // Check if it's a numeric value (could be a mark)
      const numericValue = this.parseNumericValue(text);

      cells.push({
        text,
        position: { row: rowIndex, col: colIndex },
        isNumeric: numericValue !== null,
        value: numericValue,
      });
    }

    return cells;
  }

  /**
   * Parses a potential numeric value from text
   */
  private parseNumericValue(text: string): number | null {
    // Clean the text to handle various number formats
    const cleanedText = text.replace(/,/g, ".").trim();

    // Check if it's a simple number
    if (/^\d+(\.\d+)?$/.test(cleanedText)) {
      return parseFloat(cleanedText);
    }

    // Check for mark pattern (e.g., 14.50 or 14,50)
    const markMatch = cleanedText.match(/(\d{1,2})[.,](\d{1,2})/);
    if (markMatch) {
      return parseFloat(`${markMatch[1]}.${markMatch[2]}`);
    }

    return null;
  }

  /**
   * Refines the grid to ensure a more consistent structure
   */
  private refineGrid(grid: TableCell[][]): TableCell[][] {
    if (grid.length === 0) return grid;

    // Determine the maximum number of columns
    let maxColumns = 0;
    grid.forEach((row) => {
      maxColumns = Math.max(maxColumns, row.length);
    });

    // Normalize the grid to ensure all rows have the same number of columns
    const normalizedGrid: TableCell[][] = [];

    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      normalizedGrid[rowIndex] = [];

      // Copy existing cells
      for (let colIndex = 0; colIndex < grid[rowIndex].length; colIndex++) {
        normalizedGrid[rowIndex][colIndex] = grid[rowIndex][colIndex];

        // Update position to reflect the normalized grid
        normalizedGrid[rowIndex][colIndex].position = {
          row: rowIndex,
          col: colIndex,
        };
      }

      // Add empty cells if needed
      for (let colIndex = grid[rowIndex].length; colIndex < maxColumns; colIndex++) {
        normalizedGrid[rowIndex][colIndex] = {
          text: "",
          position: { row: rowIndex, col: colIndex },
          isNumeric: false,
          value: null,
        };
      }
    }

    return normalizedGrid;
  }

  /**
   * Identifies the structural elements of the table
   */
  private identifyTableStructure(grid: TableCell[][]): TableStructure | null {
    if (grid.length === 0) return null;

    // Determine the header row
    const headerRow = this.findHeaderRow(grid);

    // Identify the columns for student ID, name, and marks
    const { studentIdColumn, studentNameColumn, markColumns } = this.identifyColumns(grid, headerRow);

    return {
      headerRow,
      studentIdColumn,
      studentNameColumn,
      markColumns,
      rowCount: grid.length,
      colCount: grid[0].length,
      cells: grid,
    };
  }

  /**
   * Finds the header row in the grid
   */
  private findHeaderRow(grid: TableCell[][]): number {
    // The header row is likely at the beginning
    // Look for rows containing common header indicators
    for (let rowIndex = 0; rowIndex < Math.min(5, grid.length); rowIndex++) {
      const headerIndicators = ["رقم", "اسم", "التلميذ", "الفرض", "النقطة", "المادة", "الأنشطة"];

      const rowText = grid[rowIndex]
        .map((cell) => cell.text)
        .join(" ")
        .toLowerCase();

      if (headerIndicators.some((indicator) => rowText.includes(indicator.toLowerCase()))) {
        return rowIndex;
      }
    }

    // Default to the first row if no clear header is found
    return 0;
  }

  /**
   * Identifies the columns for student ID, name, and marks
   */
  private identifyColumns(
    grid: TableCell[][],
    headerRow: number
  ): {
    studentIdColumn: number;
    studentNameColumn: number;
    markColumns: number[];
  } {
    let studentIdColumn = -1;
    let studentNameColumn = -1;
    const markColumns: number[] = [];

    // First check the header row for column identifiers
    if (headerRow < grid.length) {
      for (let colIndex = 0; colIndex < grid[headerRow].length; colIndex++) {
        const cellText = grid[headerRow][colIndex].text.toLowerCase();

        // Check for student ID column
        if (cellText.includes("رقم") || cellText.includes("ر.ت")) {
          studentIdColumn = colIndex;
        }

        // Check for student name column
        if (cellText.includes("اسم") || cellText.includes("التلميذ")) {
          studentNameColumn = colIndex;
        }

        // Check for mark columns
        if (
          cellText.includes("فرض") ||
          cellText.includes("الفرض") ||
          cellText.includes("نقطة") ||
          cellText.includes("الأنشطة") ||
          cellText.includes("نشاط")
        ) {
          markColumns.push(colIndex);
        }
      }
    }

    // If we couldn't identify columns from headers, try to infer from content
    if (studentIdColumn === -1 || studentNameColumn === -1 || markColumns.length === 0) {
      console.log("Couldn't identify all columns from headers, trying to infer from content");

      // Process rows after the header to identify column types
      const contentRows = grid.slice(headerRow + 1);

      // Count numeric cells in each column
      const numericCounts: number[] = Array(grid[0].length).fill(0);

      // Count cells with Arabic text in each column
      const arabicTextCounts: number[] = Array(grid[0].length).fill(0);

      // Check for patterns indicating student IDs (e.g., G12345678)
      const idPatternCounts: number[] = Array(grid[0].length).fill(0);

      // Count cells with values in the mark range (0-20)
      const markRangeCounts: number[] = Array(grid[0].length).fill(0);

      for (const row of contentRows) {
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];

          if (cell.isNumeric) {
            numericCounts[colIndex]++;

            // Check if the value is likely to be a mark (0-20 range)
            if (cell.value !== null && cell.value >= 0 && cell.value <= 20) {
              markRangeCounts[colIndex]++;
            }
          }

          // Check for Arabic text
          if (/[\u0600-\u06FF]/.test(cell.text)) {
            arabicTextCounts[colIndex]++;
          }

          // Check for student ID patterns
          if (/[Gg]\d{7,}/.test(cell.text) || /\d{7,}/.test(cell.text)) {
            idPatternCounts[colIndex]++;
          }
        }
      }

      // Use these counts to infer column types

      // Student ID column is likely to have many ID patterns or numbers
      if (studentIdColumn === -1) {
        // First try columns with clear ID patterns
        const idColCandidates = idPatternCounts
          .map((count, index) => ({ index, count }))
          .filter((c) => c.count > 0)
          .sort((a, b) => b.count - a.count);

        if (idColCandidates.length > 0) {
          studentIdColumn = idColCandidates[0].index;
        } else {
          // Fall back to first column or column with sequential numbers
          studentIdColumn = 0;
        }
      }

      // Student name column is likely to have Arabic text
      if (studentNameColumn === -1) {
        const nameColCandidates = arabicTextCounts
          .map((count, index) => ({ index, count }))
          .filter((c) => c.count > 0 && c.index !== studentIdColumn) // Exclude ID column
          .sort((a, b) => b.count - a.count);

        if (nameColCandidates.length > 0) {
          studentNameColumn = nameColCandidates[0].index;
        }
      }

      // Mark columns are likely to have values in the 0-20 range
      if (markColumns.length === 0) {
        for (let colIndex = 0; colIndex < grid[0].length; colIndex++) {
          // Skip ID and name columns
          if (colIndex === studentIdColumn || colIndex === studentNameColumn) continue;

          // If most values are in the mark range, it's likely a mark column
          const totalRows = contentRows.length;
          if (markRangeCounts[colIndex] > totalRows * 0.3) {
            // If at least 30% of cells have mark-like values
            markColumns.push(colIndex);
          }
        }

        // If we still have no mark columns, use columns with numeric values
        if (markColumns.length === 0) {
          for (let colIndex = 0; colIndex < grid[0].length; colIndex++) {
            // Skip ID and name columns
            if (colIndex === studentIdColumn || colIndex === studentNameColumn) continue;

            if (numericCounts[colIndex] > 0) {
              markColumns.push(colIndex);
            }
          }
        }
      }
    }

    // Ensure we have valid values
    studentIdColumn = studentIdColumn === -1 ? 0 : studentIdColumn;
    studentNameColumn = studentNameColumn === -1 ? 1 : studentNameColumn;

    // Sort mark columns by column index
    markColumns.sort((a, b) => a - b);

    // If we still don't have mark columns, use the remaining columns
    if (markColumns.length === 0) {
      for (let colIndex = 0; colIndex < grid[0].length; colIndex++) {
        if (colIndex !== studentIdColumn && colIndex !== studentNameColumn) {
          markColumns.push(colIndex);
        }
      }
    }

    return { studentIdColumn, studentNameColumn, markColumns };
  }

  /**
   * Extract student data from the detected table structure
   */
  extractStudentData(tableStructure: TableStructure): Student[] {
    const students: Student[] = [];
    const { cells, headerRow, studentIdColumn, studentNameColumn, markColumns } = tableStructure;

    // Process each row after the header to extract student data
    for (let rowIndex = headerRow + 1; rowIndex < cells.length; rowIndex++) {
      // Extract student ID and name
      const idCell = cells[rowIndex][studentIdColumn];
      const nameCell = cells[rowIndex][studentNameColumn];

      // Skip rows without ID or name
      if (!idCell?.text && !nameCell?.text) continue;

      // Extract student ID
      let studentId: number = rowIndex - headerRow; // Default to row number if no ID found
      if (idCell?.isNumeric && idCell.value !== null) {
        studentId = idCell.value;
      } else if (idCell?.text) {
        // Try to extract numeric portion from ID
        const numericPart = idCell.text.replace(/\D/g, "");
        if (numericPart.length > 0) {
          studentId = parseInt(numericPart, 10);
        }
      }

      // Extract student name
      const studentName = nameCell?.text || `Student ${studentId}`;

      // Extract marks for available columns
      const marks: StudentMarks = {
        fard1: null,
        fard2: null,
        fard3: null,
        activities: null,
      };

      // Map mark columns to mark types based on position
      markColumns.forEach((colIndex, markIndex) => {
        if (colIndex < cells[rowIndex].length) {
          const markCell = cells[rowIndex][colIndex];

          if (markCell?.isNumeric && markCell.value !== null) {
            // Format the mark value
            const markValue = parseFloat(markCell.value.toFixed(2));

            // Associate with the appropriate mark type based on column order
            switch (markIndex) {
              case 0:
                marks.fard1 = markValue;
                break;
              case 1:
                marks.fard2 = markValue;
                break;
              case 2:
                marks.fard3 = markValue;
                break;
              case 3:
                marks.activities = markValue;
                break;
            }
          }
        }
      });

      // Create the student object
      students.push({
        number: studentId,
        name: studentName,
        marks,
      });
    }

    return students;
  }
}

export default new TableDetectionService();
