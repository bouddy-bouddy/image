import { MarkType, Student, WorksheetStructure, MarkInsertionResults } from "../types";

/* global Excel */

class ExcelService {
  private worksheetStructure: WorksheetStructure | null = null;
  private excelData: any[][] | null = null;

  async validateExcelFile(): Promise<boolean> {
    try {
      return await Excel.run(async (context) => {
        console.log("Validating Excel file...");

        // Get the active worksheet
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");

        // Get the used range to check headers
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        console.log(`Active sheet name: ${sheet.name}`);
        console.log("Range values sample:", range.values.slice(0, 3));

        // Store the Excel data for future use
        this.excelData = range.values;

        // First check if the file has any data
        if (!range.values || range.values.length < 5) {
          console.log("File has insufficient data rows");
          return false;
        }

        // Look for Arabic text patterns that would indicate this is a Massar file
        // Check for any of the expected headers or key Massar file indicators
        const massarIndicators = ["رقم التلميذ", "إسم التلميذ", "الفرض", "النقطة", "مسار", "القسم", "الدورة"];

        // Convert all cell values to strings and check for Arabic text
        let foundIndicators = 0;

        // Flatten the 2D array and check each cell
        for (let row of range.values) {
          for (let cell of row) {
            if (cell && typeof cell === "string") {
              // Check if any of our indicators is contained in this cell
              for (let indicator of massarIndicators) {
                if (cell.toString().includes(indicator)) {
                  console.log(`Found Massar indicator: ${indicator} in cell value: ${cell}`);
                  foundIndicators++;
                  // If we found at least 2 indicators, it's likely a Massar file
                  if (foundIndicators >= 2) {
                    console.log("Confirmed Massar file based on indicators");

                    // Store worksheet structure for future use
                    this.worksheetStructure = {
                      headers: this.extractHeaders(range.values),
                      studentNameColumn: this.findStudentNameColumn(range.values),
                      studentNumberColumn: this.findStudentNumberColumn(range.values),
                      totalRows: range.values.length,
                      markColumns: this.findMarkColumns(range.values),
                    };

                    console.log("Worksheet structure:", this.worksheetStructure);
                    return true;
                  }
                }
              }
            }
          }
        }

        console.log("Could not identify file as Massar export");
        return false;
      });
    } catch (error) {
      console.error("Excel validation error:", error);
      return false;
    }
  }

  // Extract headers more intelligently by scanning multiple rows
  private extractHeaders(values: any[][]): string[] {
    // Try to find the row that has headers by looking for known column headers
    const headerKeywords = ["رقم التلميذ", "إسم التلميذ", "تاريخ", "الفرض"];

    for (let i = 0; i < Math.min(10, values.length); i++) {
      const row = values[i];
      // Check if this row contains any of our header keywords
      if (
        row.some(
          (cell) =>
            cell && typeof cell === "string" && headerKeywords.some((keyword) => cell.toString().includes(keyword))
        )
      ) {
        console.log(`Found header row at index ${i}`);
        return row.map((cell) => (cell ? cell.toString() : ""));
      }
    }

    // Fallback: return the first row as headers
    return values[0].map((cell) => (cell ? cell.toString() : ""));
  }

  // Find student name column more accurately by checking more row patterns
  findStudentNameColumn(values: any[][]): number {
    const headers = this.extractHeaders(values);

    // Look for common name column headers in Massar
    const nameHeaders = ["الاسم الكامل", "اسم التلميذ", "إسم التلميذ", "الاسم", "اسم", "التلميذ"];

    // First try the headers
    const headerIndex = headers.findIndex((h) => nameHeaders.some((nh) => h && h.toString().includes(nh)));

    if (headerIndex !== -1) {
      return headerIndex;
    }

    // If not found in headers, look for columns that contain Arabic names
    const arabicNamePattern = /^[\u0600-\u06FF\s]+$/;

    // Check a few rows to find columns with Arabic text
    for (let colIndex = 0; colIndex < Math.min(headers.length, 10); colIndex++) {
      let arabicNameCount = 0;

      // Check a sample of rows
      for (let rowIndex = 1; rowIndex < Math.min(values.length, 10); rowIndex++) {
        const cell = values[rowIndex][colIndex];
        if (cell && typeof cell === "string" && arabicNamePattern.test(cell.toString())) {
          arabicNameCount++;
        }
      }

      // If most cells in this column contain Arabic text, it's likely the name column
      if (arabicNameCount > 5) {
        return colIndex;
      }
    }

    return -1; // Not found
  }

  // Find student number column more accurately
  findStudentNumberColumn(values: any[][]): number {
    const headers = this.extractHeaders(values);

    // Look for common number column headers
    const numberHeaders = ["رقم التلميذ", "رقم", "ر.ت", "الرقم"];

    // First try the headers
    const headerIndex = headers.findIndex((h) => numberHeaders.some((nh) => h && h.toString().includes(nh)));

    if (headerIndex !== -1) {
      return headerIndex;
    }

    // If not found in headers, look for columns with student IDs or numbers
    // Typical Massar student IDs or numbers at the start of each row
    const numberPattern = /^[GgJj]?\d{7,}$|^\d{1,2}$/;

    // Check a few rows to find columns with numeric IDs
    for (let colIndex = 0; colIndex < Math.min(headers.length, 5); colIndex++) {
      let numberCount = 0;

      // Check a sample of rows
      for (let rowIndex = 1; rowIndex < Math.min(values.length, 10); rowIndex++) {
        const cell = values[rowIndex][colIndex];
        if (cell && (typeof cell === "number" || (typeof cell === "string" && numberPattern.test(cell.toString())))) {
          numberCount++;
        }
      }

      // If most cells in this column contain numbers, it's likely the ID column
      if (numberCount > 5) {
        return colIndex;
      }
    }

    return 0; // Default to first column
  }

  // Find mark columns more intelligently by checking patterns
  findMarkColumns(values: any[][]): Record<MarkType, number> {
    const headers = this.extractHeaders(values);

    const markTypes: Record<MarkType, string[]> = {
      fard1: ["الفرض 1", "الفرض الأول", "فرض 1", "الفرض1"],
      fard2: ["الفرض 2", "الفرض الثاني", "فرض 2", "الفرض2"],
      fard3: ["الفرض 3", "الفرض الثالث", "فرض 3", "الفرض3"],
      activities: ["الأنشطة", "النشاط", "أنشطة", "المراقبة المستمرة"],
    };

    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
      activities: -1,
    };

    // First try to find the columns based on headers
    for (const [type, patterns] of Object.entries(markTypes)) {
      columns[type as MarkType] = headers.findIndex((h) => patterns.some((p) => h && h.toString().includes(p)));
    }

    // If we couldn't find columns with exact header matches, try a more heuristic approach
    // Look for columns with numeric values that could be marks
    if (Object.values(columns).some((col) => col === -1)) {
      // Find columns that mostly contain numeric values in the range 0-20
      const potentialMarkColumns: number[] = [];

      // Start searching a few rows after the headers to skip metadata
      const startRow = Math.min(3, values.length - 1);

      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        let validMarkCount = 0;
        let totalChecked = 0;

        // Check a sample of rows
        for (let rowIndex = startRow; rowIndex < Math.min(values.length, startRow + 15); rowIndex++) {
          if (rowIndex < values.length && colIndex < values[rowIndex].length) {
            const cell = values[rowIndex][colIndex];

            if (cell !== null && cell !== undefined) {
              totalChecked++;
              let numValue: number;

              if (typeof cell === "number") {
                numValue = cell;
              } else if (typeof cell === "string") {
                // Clean and convert string to number
                const cleanStr = cell.toString().replace(/,/g, ".");
                numValue = parseFloat(cleanStr);
              } else {
                continue;
              }

              // Check if it's a valid mark value (0-20 for Moroccan system)
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 20) {
                validMarkCount++;
              }
            }
          }
        }

        // If more than 70% of the cells contain valid marks, consider this a mark column
        if (totalChecked > 0 && validMarkCount / totalChecked > 0.7) {
          potentialMarkColumns.push(colIndex);
        }
      }

      console.log("Potential mark columns found:", potentialMarkColumns);

      // Assign mark types to the potential columns we found
      // For any mark type that wasn't found in headers
      const unassignedMarkTypes = Object.entries(columns)
        .filter(([_, colIndex]) => colIndex === -1)
        .map(([type, _]) => type as MarkType);

      // Assign columns in sequence
      unassignedMarkTypes.forEach((type, index) => {
        if (index < potentialMarkColumns.length) {
          columns[type] = potentialMarkColumns[index];
        }
      });
    }

    return columns;
  }

  async insertMarks(extractedData: Student[], markType: string): Promise<MarkInsertionResults> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        const results: MarkInsertionResults = {
          success: 0,
          notFound: 0,
          notFoundStudents: [],
        };

        if (!this.worksheetStructure) {
          throw new Error("Worksheet structure not initialized");
        }

        for (const student of extractedData) {
          // First try to find by student number
          let rowIndex = await this.findStudentRowByNumber(student.number.toString(), range.values);

          // If not found by number, try name matching
          if (rowIndex === -1) {
            rowIndex = await this.findStudentRowByName(student.name, range.values);
          }

          if (rowIndex !== -1) {
            // Map the mark type from Arabic display name to internal property name
            const internalMarkType = this.getInternalMarkType(markType);

            if (!internalMarkType) {
              console.error("Invalid mark type:", markType);
              continue;
            }

            // Get the correct column for this mark type
            const columnIndex = this.worksheetStructure.markColumns[internalMarkType];
            if (columnIndex !== -1) {
              const cell = sheet.getCell(rowIndex, columnIndex);
              const markValue = student.marks[internalMarkType];

              if (markValue !== null) {
                // Format mark to match Massar requirements
                cell.values = [[this.formatMarkForMassar(markValue)]];
                results.success++;
              }
            }
          } else {
            results.notFound++;
            results.notFoundStudents.push(student.name);
          }
        }

        await context.sync();
        return results;
      });
    } catch (error) {
      console.error("Excel interaction error:", error);
      throw error;
    }
  }

  private getInternalMarkType(arabicMarkType: string): MarkType | null {
    const markTypeMap: Record<string, MarkType> = {
      "الفرض 1": "fard1",
      "الفرض الأول": "fard1",
      "الفرض 2": "fard2",
      "الفرض الثاني": "fard2",
      "الفرض 3": "fard3",
      "الفرض الثالث": "fard3",
      الأنشطة: "activities",
      النشاط: "activities",
    };

    return markTypeMap[arabicMarkType] || null;
  }

  // Find student row by ID number
  async findStudentRowByNumber(studentNum: string, values: any[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    const numColumn = this.worksheetStructure.studentNumberColumn;

    // Numbers can be in various formats (G123456789, 123456789, etc.)
    // Clean the student number for comparison
    const cleanStudentNum = studentNum.toString().replace(/[^0-9]/g, "");

    for (let i = 1; i < values.length; i++) {
      if (i < values.length && numColumn < values[i].length) {
        const cellValue = values[i][numColumn];

        if (cellValue) {
          const cellStrValue = cellValue.toString().replace(/[^0-9]/g, "");

          // Check if the end of the cell value matches the student number
          // This handles cases where the number format differs slightly
          if (cellStrValue.endsWith(cleanStudentNum) || cleanStudentNum.endsWith(cellStrValue)) {
            return i;
          }
        }
      }
    }

    return -1;
  }

  // Find student row by name
  async findStudentRowByName(studentName: string, values: any[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    const nameColumn = this.worksheetStructure.studentNameColumn;
    const nameToFind = this.normalizeArabicText(studentName);

    for (let i = 1; i < values.length; i++) {
      if (i < values.length && nameColumn < values[i].length) {
        const cellName = this.normalizeArabicText(values[i][nameColumn]);
        if (this.compareNames(nameToFind, cellName)) {
          return i;
        }
      }
    }
    return -1;
  }

  normalizeArabicText(text: string | undefined): string {
    if (!text) return "";

    // Remove diacritics and normalize Arabic characters
    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .trim()
      .toLowerCase();
  }

  compareNames(name1: string, name2: string): boolean {
    // Calculate similarity between names
    const similarity = this.calculateSimilarity(name1, name2);
    return similarity > 0.7; // 70% similarity threshold
  }

  calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    // Also check if one name contains the other
    if (longer.includes(shorter)) return 0.9;

    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  editDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  formatMarkForMassar(mark: number): string {
    // Ensure mark is formatted as required by Massar
    return parseFloat(mark.toString()).toFixed(2);
  }
}

export default new ExcelService();
