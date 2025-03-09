import React from "react";
import { Button, Text } from "@fluentui/react-components";
import { CheckmarkCircle24Regular, DismissCircle24Regular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import DataTable from "../shared/DataTable";
import EnhancedLoadingSpinner from "../shared/EnhancedLoadingSpinner";
import { Student } from "../../types";

interface ReviewConfirmStepProps {
  isActive: boolean;
  isCompleted: boolean;
  data: Student[];
  onConfirm: () => void;
  onCancel: () => void;
  onDataUpdate: (newData: Student[]) => void;
  isSaving?: boolean;
  processingStatus?: string;
}

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({
  isActive,
  isCompleted,
  data,
  onConfirm,
  onCancel,
  onDataUpdate,
  isSaving = false,
  processingStatus = "جاري إدخال النقط...",
}) => {
  // Check if we have students without marks
  const hasEmptyMarks = data.some(
    (student) => !student.marks.fard1 && !student.marks.fard2 && !student.marks.fard3 && !student.marks.activities
  );

  // Check if some students have suspiciously high marks (>20)
  const hasInvalidMarks = data.some((student) => {
    const marks = Object.values(student.marks).filter((m) => m !== null) as number[];
    return marks.some((mark) => mark > 20);
  });

  // Calculate stats
  const studentsWithMarks = data.filter(
    (student) =>
      student.marks.fard1 !== null ||
      student.marks.fard2 !== null ||
      student.marks.fard3 !== null ||
      student.marks.activities !== null
  ).length;

  const totalMarks = data.reduce((total, student) => {
    const marks = Object.values(student.marks).filter((m) => m !== null) as number[];
    return total + marks.length;
  }, 0);

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepIndicator stepNumber={3} title="مراجعة وتأكيد" isActive={isActive} isCompleted={isCompleted} />

      <div className="step-content">
        {isSaving ? (
          <EnhancedLoadingSpinner
            message={processingStatus}
            processingSteps={[
              { step: "التحقق من ملف Excel", status: "completed" },
              { step: "مطابقة الطلاب", status: "processing" },
              { step: "إدخال النقط", status: "waiting" },
            ]}
          />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
              <CheckmarkCircle24Regular style={{ marginLeft: "12px", color: "#0078D4" }} />
              <div>
                <Text as="h3" size={500} weight="semibold">
                  مراجعة البيانات المستخرجة
                </Text>
                <Text size={200} style={{ color: "#666" }}>
                  تم استخراج {data.length} طالب و {totalMarks} علامة من الصورة
                </Text>
              </div>
            </div>

            {hasEmptyMarks && (
              <div
                style={{
                  backgroundColor: "#FFF4CE",
                  padding: "10px 12px",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  borderRight: "4px solid #FFB900",
                }}
              >
                <Text weight="semibold" style={{ color: "#603B00" }}>
                  تنبيه: بعض الطلاب ليس لديهم أي علامات
                </Text>
                <Text size={200} style={{ color: "#603B00" }}>
                  يرجى التأكد من أن الصورة واضحة ومقروءة
                </Text>
              </div>
            )}

            {hasInvalidMarks && (
              <div
                style={{
                  backgroundColor: "#FDE7E9",
                  padding: "10px 12px",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  borderRight: "4px solid #D13438",
                }}
              >
                <Text weight="semibold" style={{ color: "#A4262C" }}>
                  تنبيه: بعض العلامات تتجاوز الحد الأقصى (20)
                </Text>
                <Text size={200} style={{ color: "#A4262C" }}>
                  قد تكون هناك أخطاء في قراءة بعض العلامات. يرجى مراجعتها
                </Text>
              </div>
            )}

            <Text size={300} style={{ marginBottom: "16px", color: "#666" }}>
              يمكنك تصحيح أي علامة غير صحيحة بالنقر عليها
            </Text>

            {data && data.length > 0 && (
              <>
                <DataTable data={data} onDataUpdate={onDataUpdate} />

                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    gap: "10px",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    appearance="primary"
                    onClick={onConfirm}
                    icon={<CheckmarkCircle24Regular />}
                    disabled={isSaving}
                  >
                    تأكيد وإدخال في Excel
                  </Button>

                  <Button
                    appearance="secondary"
                    onClick={onCancel}
                    icon={<DismissCircle24Regular />}
                    disabled={isSaving}
                  >
                    إلغاء
                  </Button>
                </div>

                <div style={{ marginTop: "12px", backgroundColor: "#f0f8ff", padding: "12px", borderRadius: "4px" }}>
                  <Text weight="semibold" style={{ color: "#0078d4", display: "block", marginBottom: "8px" }}>
                    نصائح للمراجعة:
                  </Text>
                  <ul style={{ margin: 0, paddingRight: "20px", color: "#333" }}>
                    <li style={{ marginBottom: "4px" }}>
                      <Text size={200}>تحقق من الأرقام بعناية، خاصة إذا كانت هناك علامات تزيد عن 20</Text>
                    </li>
                    <li style={{ marginBottom: "4px" }}>
                      <Text size={200}>تأكد من مطابقة أسماء الطلاب مع الصورة الأصلية</Text>
                    </li>
                    <li>
                      <Text size={200}>قم بالنقر على أي رقم لتعديله إذا وجدت أي خطأ</Text>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewConfirmStep;
