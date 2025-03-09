import { Student } from "../types";
import TableDetectionService from "./tableDetectionService";

class OCRService {
  async processImage(imageFile: File): Promise<Student[]> {
    try {
      console.log("Starting Google Cloud Vision OCR processing...");

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      // Remove the data URL prefix
      const base64Content = base64Image.split(",")[1];

      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

      if (!apiKey) {
        throw new Error("API key not found. Please check your environment configuration.");
      }

      // Build proper URL with API key
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      console.log("Sending request to Google Cloud Vision API...");

      // Prepare request to Google Cloud Vision API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Content,
              },
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                  // Request detailed text detection for better table detection
                },
              ],
              imageContext: {
                languageHints: ["ar"], // Specify Arabic language for better accuracy
              },
            },
          ],
        }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Google Vision API error:", errorData);

        // Provide more specific error message based on response status
        if (response.status === 403) {
          throw new Error("فشل الاتصال بخدمة التعرف على النص: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
        } else {
          throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
        }
      }

      const data = await response.json();

      if (!data.responses || !data.responses[0] || !data.responses[0].fullTextAnnotation) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = data.responses[0].fullTextAnnotation.text;
      console.log("OCR completed, raw text:", extractedText);

      // Process the OCR text with multiple approaches for redundancy
      return await this.processOCRWithMultipleApproaches(extractedText);
    } catch (error) {
      console.error("Processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Process OCR text with multiple approaches to maximize data extraction success
   */
  private async processOCRWithMultipleApproaches(extractedText: string): Promise<Student[]> {
    // Split the text into lines
    const lines = extractedText
      .split("\n")
      .map((line) => this.normalizeArabicNumber(line.trim()))
      .filter((line) => line.length > 0);

    console.log("Processing OCR lines:", lines);

    // Approach 1: Try advanced table detection
    const tableStructure = TableDetectionService.detectTable(lines);

    if (tableStructure) {
      console.log("Table structure detected:", tableStructure);
      const studentsFromTable = TableDetectionService.extractStudentData(tableStructure);

      // If we got good data from table detection, use it
      if (studentsFromTable.length > 0) {
        console.log("Students extracted using table detection:", studentsFromTable.length);
        return studentsFromTable;
      }
    }

    // Approach 2: Use pattern-based extraction
    const studentsFromPatterns = this.extractStudentsByPatterns(lines);

    // If we got data from pattern matching, use it
    if (studentsFromPatterns.length > 0) {
      console.log("Students extracted using pattern matching:", studentsFromPatterns.length);
      return studentsFromPatterns;
    }

    // Approach 3: Fall back to basic extraction
    return this.extractBasicStudentData(lines);
  }

  /**
   * Extract student data using pattern matching
   */
  private extractStudentsByPatterns(lines: string[]): Student[] {
    try {
      // Find student section and mark section
      const studentSection = this.findStudentSection(lines);
      if (!studentSection) {
        console.log("Could not identify student section");
        return [];
      }

      // Extract student info (numbers and names)
      const studentInfo = this.extractStudentInfoFromSection(studentSection);
      console.log("Extracted student info:", studentInfo);

      if (Object.keys(studentInfo).length === 0) {
        console.log("No student info extracted");
        return [];
      }

      // Extract all potential marks from the text
      const markValues = this.extractMarkValues(lines);
      console.log("Extracted mark values:", markValues);

      // Assign marks to students
      return this.assignMarksToStudents(studentInfo, markValues);
    } catch (error) {
      console.error("Error in pattern-based extraction:", error);
      return [];
    }
  }

  /**
   * Find the section of lines containing student information
   */
  private findStudentSection(lines: string[]): string[] | null {
    // Look for indicators of student lists
    let studentSectionStart = -1;
    let studentSectionEnd = lines.length;

    // Look for common headers that precede student lists
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes("اسم التلميذ") || line.includes("ر.ت") || (line.includes("رقم") && line.includes("اسم"))) {
        studentSectionStart = i;
        break;
      }
    }

    // If we couldn't find a header, look for numbered lines
    if (studentSectionStart === -1) {
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\d+\s/.test(lines[i])) {
          studentSectionStart = i;
          break;
        }
      }
    }

    if (studentSectionStart === -1) {
      return null;
    }

    // Look for the end of the student section
    for (let i = studentSectionStart + 1; i < lines.length; i++) {
      // End indicators: signature line, footer, etc.
      if (
        lines[i].includes("توقيع") ||
        lines[i].includes("الأستاذ") ||
        lines[i].includes("المدير") ||
        lines[i].includes("ملاحظة") ||
        (i > studentSectionStart + 5 && lines[i].trim().length === 0 && lines[i + 1]?.trim().length === 0)
      ) {
        studentSectionEnd = i;
        break;
      }
    }

    return lines.slice(studentSectionStart, studentSectionEnd);
  }

  /**
   * Extract student information (numbers and names) from a section of text
   */
  private extractStudentInfoFromSection(section: string[]): Record<string, string> {
    const studentInfo: Record<string, string> = {};

    // Different patterns to match student info
    const patterns = [
      /^\s*(\d+)\s*[\|\s]*([\u0600-\u06FF\s]+)/, // Number followed by Arabic name
      /^\s*(\d+)\s*$/, // Just a number (name might be on next line)
    ];

    for (let i = 0; i < section.length; i++) {
      const line = section[i].trim();

      // Skip header line
      if (line.includes("اسم التلميذ") || line.includes("ر.ت") || (line.includes("رقم") && line.includes("اسم"))) {
        continue;
      }

      // Try to match with our patterns
      let matched = false;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const id = match[1];

          // If it's just a number, look for name in next line
          if (match.length < 3) {
            // Check if next line exists and is Arabic text
            if (i + 1 < section.length && /^[\u0600-\u06FF\s]+$/.test(section[i + 1])) {
              studentInfo[id] = section[i + 1].trim();
              i++; // Skip the next line since we've used it
            } else {
              studentInfo[id] = `طالب ${id}`; // Default name if not found
            }
          } else {
            studentInfo[id] = match[2].trim();
          }

          matched = true;
          break;
        }
      }

      // If not matched with main patterns, check for Arabic text with numbers
      if (!matched && /[\u0600-\u06FF]/.test(line)) {
        // Extract numbers from the line
        const numbers = line.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          // Use the first number as ID
          const id = numbers[0];

          // Remove the number from the text to get the name
          let name = line.replace(/\d+/g, "").trim();

          // Check if it looks like a valid name
          if (name.length > 2) {
            studentInfo[id] = name;
          }
        }
      }
    }

    return studentInfo;
  }

  /**
   * Extract all potential mark values from the text
   */
  private extractMarkValues(lines: string[]): number[] {
    const markValues: number[] = [];

    // Look for patterns of marks (Arabic grade system uses 0-20 scale)
    const markPattern = /\b(\d{1,2}(?:[.,]\d{1,2})?)\b/g;

    for (const line of lines) {
      // Skip lines that are clearly not mark data
      if (
        line.includes("تاريخ") ||
        line.includes("الموسم") ||
        line.includes("الدراسي") ||
        line.includes("المملكة") ||
        line.includes("وزارة")
      ) {
        continue;
      }

      // Extract mark-like values
      let match;
      while ((match = markPattern.exec(line)) !== null) {
        const markStr = match[1].replace(",", ".");
        const markValue = parseFloat(markStr);

        // Valid marks are in the 0-20 range
        if (!isNaN(markValue) && markValue >= 0 && markValue <= 20) {
          markValues.push(markValue);
        }
      }
    }

    return markValues;
  }

  /**
   * Assign marks to students based on extracted information
   */
  private assignMarksToStudents(studentInfo: Record<string, string>, markValues: number[]): Student[] {
    const students: Student[] = [];

    // Convert student info to an array and sort by ID
    const studentEntries = Object.entries(studentInfo)
      .map(([id, name]) => ({ id: parseInt(id, 10), name }))
      .sort((a, b) => a.id - b.id);

    // Calculate marks per student (we expect about 4 marks per student)
    const expectedMarksPerStudent = Math.min(4, Math.floor(markValues.length / studentEntries.length));

    // Distribute marks to students
    let markIndex = 0;

    for (const { id, name } of studentEntries) {
      // Calculate how many marks to assign to this student
      const studentMarks = [];

      // Take the next set of marks for this student
      for (let i = 0; i < expectedMarksPerStudent; i++) {
        if (markIndex < markValues.length) {
          studentMarks.push(markValues[markIndex++]);
        }
      }

      // Create a student object with the marks
      students.push({
        number: id,
        name,
        marks: {
          fard1: studentMarks[0] !== undefined ? studentMarks[0] : null,
          fard2: studentMarks[1] !== undefined ? studentMarks[1] : null,
          fard3: studentMarks[2] !== undefined ? studentMarks[2] : null,
          activities: studentMarks[3] !== undefined ? studentMarks[3] : null,
        },
      });
    }

    return students;
  }

  /**
   * Extract student data using basic approach
   */
  private extractBasicStudentData(lines: string[]): Student[] {
    const students: Student[] = [];

    // Look for lines with student numbers
    const studentLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      // Lines with student numbers often start with a digit
      if (/^\s*\d+\s/.test(lines[i])) {
        studentLines.push(lines[i]);
      }
    }

    // If we found student lines, try to extract student data
    for (let i = 0; i < studentLines.length; i++) {
      const line = studentLines[i];

      // Extract student number
      const numberMatch = line.match(/^\s*(\d+)\s/);
      if (!numberMatch) continue;

      const studentNumber = parseInt(numberMatch[1], 10);

      // Extract student name (anything that's not a number)
      let studentName = line.replace(/\d+([.,]\d+)?/g, "").trim();

      // If name is too short, it might be on the next line
      if (studentName.length < 3 && i + 1 < studentLines.length) {
        // If next line doesn't start with a number, it might be part of this student's name
        if (!/^\s*\d+\s/.test(studentLines[i + 1])) {
          studentName = studentLines[i + 1].trim();
        }
      }

      // If we still don't have a good name, use a default
      if (studentName.length < 3) {
        studentName = `طالب ${studentNumber}`;
      }

      // Extract marks from the current line
      const marks: number[] = [];
      const markMatch = line.match(/\b(\d{1,2}[.,]\d{1,2})\b/g);

      if (markMatch) {
        for (const mark of markMatch) {
          const markValue = parseFloat(mark.replace(",", "."));
          if (!isNaN(markValue) && markValue >= 0 && markValue <= 20) {
            marks.push(markValue);
          }
        }
      }

      // Create student object
      students.push({
        number: studentNumber,
        name: studentName,
        marks: {
          fard1: marks[0] !== undefined ? marks[0] : null,
          fard2: marks[1] !== undefined ? marks[1] : null,
          fard3: marks[2] !== undefined ? marks[2] : null,
          activities: marks[3] !== undefined ? marks[3] : null,
        },
      });
    }

    return students;
  }

  normalizeArabicNumber(text: string): string {
    // Convert Arabic/Persian numerals to English
    const numeralMap: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
    };

    return text.replace(/[٠-٩]/g, (d) => numeralMap[d] || d);
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export default new OCRService();
