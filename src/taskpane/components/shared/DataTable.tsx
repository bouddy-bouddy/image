import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Input,
  Text,
  Button,
  Badge,
  Card,
} from "@fluentui/react-components";
import { Edit24Regular, Warning24Regular, Search24Regular } from "@fluentui/react-icons";
import { Student, StudentMarks } from "../../types";

interface DataTableProps {
  data: Student[];
  onDataUpdate: (newData: Student[]) => void;
}

interface EditingCell {
  studentIndex: number;
  markType: keyof StudentMarks;
}

interface ValidationError {
  studentIndex: number;
  markType: keyof StudentMarks;
  message: string;
}

const DataTable: React.FC<DataTableProps> = ({ data, onDataUpdate }) => {
  const [editableData, setEditableData] = useState<Student[]>(data);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  // Update data when props change
  useEffect(() => {
    setEditableData(data);
    setValidationErrors([]);
  }, [data]);

  // Validate all marks and highlight potential issues
  useEffect(() => {
    validateAllMarks();
  }, [editableData]);

  const validateAllMarks = () => {
    const errors: ValidationError[] = [];

    editableData.forEach((student, index) => {
      Object.entries(student.marks).forEach(([key, value]) => {
        const markType = key as keyof StudentMarks;

        // Check for suspicious values
        if (value !== null) {
          // Check if value is unrealistically high for Moroccan grading system
          if (value > 20) {
            errors.push({
              studentIndex: index,
              markType,
              message: "النقطة تتجاوز الحد الأقصى (20)",
            });
          }

          // Check for possible digit transposition (e.g., 61 instead of 16)
          if (value > 20 && value.toString().length === 2) {
            const reversed = parseInt(value.toString().split("").reverse().join(""));
            if (reversed <= 20) {
              errors.push({
                studentIndex: index,
                markType,
                message: `قد تكون النقطة مقلوبة (${reversed})`,
              });
            }
          }
        }
      });
    });

    setValidationErrors(errors);
  };

  const validateMark = (value: string | null): boolean => {
    if (value === "" || value === null) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 20;
  };

  const formatMark = (value: number | null): string => {
    if (value === null) return "";
    return parseFloat(value.toString()).toFixed(2);
  };

  const handleMarkEdit = (studentIndex: number, markType: keyof StudentMarks, value: string): boolean => {
    const trimmedValue = value.trim();
    const newValue = trimmedValue === "" ? null : parseFloat(trimmedValue);

    // For empty values, set to null
    if (newValue === null) {
      updateMark(studentIndex, markType, null);
      return true;
    }

    // Check if value is valid
    if (!validateMark(trimmedValue)) {
      return false;
    }

    // Update the mark
    updateMark(studentIndex, markType, parseFloat(parseFloat(trimmedValue).toFixed(2)));
    return true;
  };

  const updateMark = (studentIndex: number, markType: keyof StudentMarks, value: number | null) => {
    const newData = [...editableData];
    newData[studentIndex] = {
      ...newData[studentIndex],
      marks: {
        ...newData[studentIndex].marks,
        [markType]: value,
      },
    };

    setEditableData(newData);
    onDataUpdate(newData);
  };

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIndex: number,
    markType: keyof StudentMarks
  ): void => {
    if (e.key === "Enter") {
      const isValid = handleMarkEdit(studentIndex, markType, e.currentTarget.value);
      if (isValid) {
        setEditingCell(null);
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Move to next cell
      const markTypes: Array<keyof StudentMarks> = ["fard1", "fard2", "fard3", "activities"];
      const currentTypeIndex = markTypes.indexOf(markType);

      // If last cell in row, move to first cell in next row
      if (currentTypeIndex === markTypes.length - 1) {
        if (studentIndex < editableData.length - 1) {
          const isValid = handleMarkEdit(studentIndex, markType, e.currentTarget.value);
          if (isValid) {
            setTimeout(() => {
              setEditingCell({
                studentIndex: studentIndex + 1,
                markType: markTypes[0],
              });
            }, 10);
          }
        }
      } else {
        // Move to next cell in same row
        const isValid = handleMarkEdit(studentIndex, markType, e.currentTarget.value);
        if (isValid) {
          setTimeout(() => {
            setEditingCell({
              studentIndex,
              markType: markTypes[currentTypeIndex + 1],
            });
          }, 10);
        }
      }
    }
  };

  const hasValidationError = (studentIndex: number, markType: keyof StudentMarks): ValidationError | undefined => {
    return validationErrors.find((error) => error.studentIndex === studentIndex && error.markType === markType);
  };

  const renderCell = (student: Student, index: number, markType: keyof StudentMarks) => {
    const isEditing = editingCell?.studentIndex === index && editingCell?.markType === markType;
    const value = student.marks[markType];
    const error = hasValidationError(index, markType);

    if (isEditing) {
      return (
        <Input
          autoFocus
          defaultValue={value !== null ? value.toString() : ""}
          style={{ width: "60px" }}
          onKeyDown={(e) => handleKeyPress(e, index, markType)}
          onBlur={(e) => {
            const isValid = handleMarkEdit(index, markType, e.target.value);
            if (isValid) {
              setEditingCell(null);
            }
          }}
        />
      );
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: error ? "rgba(253, 231, 233, 0.5)" : "transparent",
          position: "relative",
        }}
        onClick={() => setEditingCell({ studentIndex: index, markType })}
        onMouseEnter={() => setHighlightedRow(index)}
        onMouseLeave={() => setHighlightedRow(null)}
      >
        <span>{formatMark(value)}</span>

        {error && (
          <Warning24Regular
            style={{
              color: "#D92C2C",
              fontSize: "14px",
              position: "absolute",
              top: "-5px",
              right: "-5px",
            }}
            title={error.message}
          />
        )}

        {highlightedRow === index && (
          <Edit24Regular
            style={{
              color: "#0078D4",
              fontSize: "14px",
              marginRight: "4px",
            }}
          />
        )}
      </div>
    );
  };

  // Filter data based on search term
  const filteredData = editableData.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) || student.number.toString().includes(searchTerm)
  );

  return (
    <div>
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", width: "250px" }}>
          <Search24Regular
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#666",
            }}
          />
          <Input
            placeholder="بحث عن طالب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingRight: "32px" }}
          />
        </div>

        {validationErrors.length > 0 && (
          <Badge appearance="filled" color="danger" shape="rounded" style={{ padding: "4px 8px" }}>
            {validationErrors.length} أخطاء محتملة
          </Badge>
        )}
      </div>

      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
          <Table>
            <TableHeader style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#fff" }}>
              <TableRow>
                <TableHeaderCell>رقم</TableHeaderCell>
                <TableHeaderCell>الاسم</TableHeaderCell>
                <TableHeaderCell>الفرض 1</TableHeaderCell>
                <TableHeaderCell>الفرض 2</TableHeaderCell>
                <TableHeaderCell>الفرض 3</TableHeaderCell>
                <TableHeaderCell>الأنشطة</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((student, index) => (
                <TableRow
                  key={`student-${student.number}-${index}`}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#f9f9f9" : "white",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={() => setHighlightedRow(index)}
                  onMouseLeave={() => setHighlightedRow(null)}
                >
                  <TableCell>{student.number}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>{renderCell(student, index, "fard1")}</TableCell>
                  <TableCell>{renderCell(student, index, "fard2")}</TableCell>
                  <TableCell>{renderCell(student, index, "fard3")}</TableCell>
                  <TableCell>{renderCell(student, index, "activities")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {validationErrors.length > 0 && (
        <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#FDE7E9", borderRadius: "4px" }}>
          <Text weight="semibold" style={{ color: "#D92C2C", marginBottom: "8px", display: "block" }}>
            يرجى مراجعة العلامات التالية:
          </Text>
          <ul style={{ margin: 0, paddingRight: "20px" }}>
            {validationErrors.slice(0, 3).map((error, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>
                <Text size={200}>
                  طالب رقم {editableData[error.studentIndex].number} ({editableData[error.studentIndex].name}):{" "}
                  {error.message}
                </Text>
              </li>
            ))}
            {validationErrors.length > 3 && (
              <li>
                <Text size={200}>و {validationErrors.length - 3} أخطاء أخرى...</Text>
              </li>
            )}
          </ul>
        </div>
      )}

      {filteredData.length === 0 && searchTerm && (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          <Text>لم يتم العثور على نتائج لـ "{searchTerm}"</Text>
        </div>
      )}
    </div>
  );
};

export default DataTable;
