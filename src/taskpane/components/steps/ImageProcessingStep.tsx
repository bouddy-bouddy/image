import React, { useState } from "react";
import { Button, Text, Card } from "@fluentui/react-components";
import { Image24Regular, ArrowRight24Regular, DocumentSearch24Regular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import EnhancedLoadingSpinner from "../shared/EnhancedLoadingSpinner";
import UploadInstructions from "../shared/UploadInstructions";
import StatusAlert from "../shared/StatusAlert";

interface ImageProcessingStepProps {
  isActive: boolean;
  isCompleted: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  isProcessing: boolean;
  processingStatus?: string;
  processingProgress?: number;
  onImageUpload: (file: File) => void;
  onProcessImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ImageProcessingStep: React.FC<ImageProcessingStepProps> = ({
  isActive,
  isCompleted,
  selectedImage,
  imagePreview,
  isProcessing,
  processingStatus = "جاري معالجة الصورة...",
  processingProgress,
  onImageUpload,
  onProcessImage,
  fileInputRef,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // List of processing steps for the spinner
  const [processingSteps] = useState([
    {
      step: "تحميل الصورة",
      status: "completed" as const,
    },
    {
      step: "التعرف على النص باستخدام Google Cloud Vision",
      status: "processing" as const,
    },
    {
      step: "تحليل بنية الجدول",
      status: "waiting" as const,
    },
    {
      step: "استخراج البيانات من الجدول",
      status: "waiting" as const,
    },
  ]);

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    setImageError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndUploadImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);

    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndUploadImage(file);
    }
  };

  const validateAndUploadImage = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setImageError("يرجى رفع ملف صورة فقط (jpg, png, jpeg)");
      return;
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setImageError("حجم الملف كبير جدًا. الحد الأقصى هو 5 ميغابايت");
      return;
    }

    // Check image dimensions and orientation
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Check minimum dimensions
      if (img.width < 500 || img.height < 500) {
        setImageError("أبعاد الصورة صغيرة جدًا. يرجى استخدام صورة بدقة أعلى.");
        return;
      }

      // Now upload the image
      onImageUpload(file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setImageError("حدث خطأ في تحميل الصورة. يرجى التأكد من أن الملف هو صورة صالحة.");
    };

    img.src = URL.createObjectURL(file);
  };

  const handleRetakePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onImageUpload(null as any);
  };

  // Update processing steps based on the current status
  const getUpdatedProcessingSteps = () => {
    // Clone the steps
    const updatedSteps = [...processingSteps];

    // Update status based on processingStatus
    if (processingStatus.includes("تحليل البيانات") || processingStatus.includes("استخراج")) {
      updatedSteps[1].status = "completed";
      updatedSteps[2].status = "processing";
    } else if (processingStatus.includes("بنية الجدول")) {
      updatedSteps[1].status = "completed";
      updatedSteps[2].status = "completed";
      updatedSteps[3].status = "processing";
    }

    return updatedSteps;
  };

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepIndicator stepNumber={1} title="معالجة الصورة" isActive={isActive} isCompleted={isCompleted} />

      <div className="step-content">
        {!imagePreview && <UploadInstructions />}

        {imageError && <StatusAlert type="error" message={imageError} />}

        {!imagePreview && (
          <div
            className={`drop-zone ${dragActive ? "drag-active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: `2px dashed ${dragActive ? "#0078d4" : "#c8c8c8"}`,
              borderRadius: "8px",
              padding: "32px",
              textAlign: "center",
              margin: "20px 0",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backgroundColor: dragActive ? "#f0f8ff" : "#f9f9f9",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={handleFileChange}
            />

            <Image24Regular style={{ fontSize: "48px", color: "#0078d4" }} />

            <Text weight="semibold">اسحب الصورة هنا أو انقر للاختيار</Text>

            <Text size={200} style={{ color: "#666" }}>
              jpg, png, jpeg مدعومة، بحد أقصى 5 ميغابايت
            </Text>
          </div>
        )}

        {imagePreview && (
          <Card
            style={{
              padding: "16px",
              marginTop: "20px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
              <DocumentSearch24Regular style={{ marginLeft: "12px", color: "#0078d4" }} />
              <Text weight="semibold">معاينة الصورة</Text>
            </div>

            <div style={{ position: "relative", marginBottom: "16px" }}>
              <img
                src={imagePreview}
                alt="معاينة"
                style={{
                  maxWidth: "100%",
                  maxHeight: "300px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              />

              {!isProcessing && (
                <Button
                  appearance="subtle"
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.8)",
                  }}
                  onClick={handleRetakePhoto}
                >
                  استبدال الصورة
                </Button>
              )}
            </div>

            {isProcessing ? (
              <EnhancedLoadingSpinner
                message={processingStatus}
                isCloudProcessing={true}
                processingSteps={getUpdatedProcessingSteps()}
                progress={processingProgress}
              />
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button appearance="primary" onClick={onProcessImage} icon={<ArrowRight24Regular />}>
                  تحليل الصورة واستخراج النقط
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default ImageProcessingStep;
