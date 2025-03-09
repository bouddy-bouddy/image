import React, { useState, useRef, useEffect } from "react";
import { FluentProvider, webLightTheme, Text, Card } from "@fluentui/react-components";
import { createGlobalStyle } from "styled-components";
import ocrService from "../services/ocrService";
import excelService from "../services/excelService";
import { Student, ExcelStatus, AppStep } from "../types";
import StatusAlert from "./shared/StatusAlert";
import ImageProcessingStep from "./steps/ImageProcessingStep";
import FileAnalysisStep from "./steps/FileAnalysisStep";
import ReviewConfirmStep from "./steps/ReviewConfirmStep";
import MarkTypeDialog from "./dialogs/MarkTypeDialog";

// GlobalStyle for App.tsx
const GlobalStyle = createGlobalStyle`
  /* Base RTL Settings */
  html, body {
    direction: rtl;
    text-align: right;
    background-color: #f5f5f5;
    margin: 0;
    padding: 0;
  }

  body {
    padding: 16px;
  }

  /* Container styles */
  .ms-welcome {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 24px;
    direction: rtl;
  }

  .ms-welcome__header {
    color: #242424;
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: right;
  }
  
  /* Step styling */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 24px;
  }

  .step {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 24px;
    background-color: white;
    transition: all 0.3s ease;
    text-align: right;
    direction: rtl;
  }
  
  .step.active {
    border-color: #0e7c42; /* Changed to green */
    box-shadow: 0 2px 8px rgba(14, 124, 66, 0.1); /* Changed to green */
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #666;
  }
  
  .step.active .step-number {
    background-color: #0e7c42; /* Changed to green */
    color: white;
  }
  
  .step-title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }
  
  .step-content {
    padding-right: 44px;
  }

  /* Force RTL for all elements with text */
  input, button, select, textarea, div, span, p, h1, h2, h3, h4, h5, h6 {
    text-align: right;
  }

  /* Override Fluent UI RTL */
  .fui-FluentProvider {
    direction: rtl;
  }
`;

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

const App: React.FC<AppProps> = ({ title, isOfficeInitialized = true }) => {
  // State for selected image
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>("جاري المعالجة...");
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Data and steps
  const [extractedData, setExtractedData] = useState<Student[] | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.ImageProcessing);
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set());

  // Excel status
  const [excelStatus, setExcelStatus] = useState<ExcelStatus>({
    isValid: false,
    checked: false,
  });

  // Dialog states
  const [showMarkTypeDialog, setShowMarkTypeDialog] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Reference for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Excel file on initialization
  useEffect(() => {
    const checkExcelFile = async () => {
      try {
        setProcessingStatus("جاري التحقق من ملف Excel...");
        const isValid = await excelService.validateExcelFile();
        setExcelStatus({
          isValid,
          checked: true,
        });

        if (isValid) {
          advanceToStep(AppStep.ImageProcessing);
        }
      } catch (error) {
        console.error("Excel validation error:", error);
        setExcelStatus({
          isValid: false,
          checked: true,
        });
      }
    };

    if (isOfficeInitialized) {
      checkExcelFile();
    }
  }, [isOfficeInitialized]);

  // Handle image upload
  const handleImageUpload = (file: File | null) => {
    if (!file) {
      setSelectedImage(null);
      setImagePreview(null);
      setError(null);
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        setImagePreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  // Simulated progress for the processing
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isProcessing) {
      let progress = 0;
      timer = setInterval(() => {
        progress += 1;

        // Update status based on progress
        if (progress === 30) {
          setProcessingStatus("جاري التعرف على النص باستخدام Google Cloud Vision...");
        } else if (progress === 60) {
          setProcessingStatus("جاري تحليل بنية الجدول واستخراج البيانات...");
        } else if (progress === 85) {
          setProcessingStatus("جاري ربط البيانات المستخرجة...");
        }

        setProcessingProgress(Math.min(progress, 95)); // Cap at 95% until process completes

        if (progress >= 95) {
          clearInterval(timer);
        }
      }, 200);
    } else {
      setProcessingProgress(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isProcessing]);

  // Process image with OCR
  const processImage = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setProcessingStatus("جاري تحليل الصورة باستخدام تقنية التعرف الضوئي على النص...");
    setProcessingProgress(5);
    setError(null); // Clear any previous errors

    try {
      // Process the image using Google Cloud Vision OCR
      const extractedMarks = await ocrService.processImage(selectedImage);

      // Update processing status and progress
      setProcessingStatus("تم استخراج البيانات بنجاح!");
      setProcessingProgress(100);

      // Show preview of extracted data
      setExtractedData(extractedMarks);
      completeStep(AppStep.ImageProcessing);

      // Small delay to show the completed status before moving to next step
      setTimeout(() => {
        advanceToStep(AppStep.ReviewConfirm);
        setIsProcessing(false);
      }, 1000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "حدث خطأ أثناء معالجة الصورة. الرجاء المحاولة مرة أخرى.");
      } else {
        setError("حدث خطأ غير معروف أثناء معالجة الصورة");
      }
      console.error(err);
      setIsProcessing(false);
    }
  };

  // Handle mark data confirmation
  const handleConfirmData = async () => {
    try {
      // Set processing
      setIsSaving(true);
      setProcessingStatus("جاري التحقق من ملف Excel...");

      // First validate Excel file
      const isValidFile = await excelService.validateExcelFile();
      if (!isValidFile) {
        setError("يرجى التأكد من فتح ملف مسار صحيح في Excel");
        setIsSaving(false);
        return;
      }

      // Show mark type selection dialog
      setIsSaving(false);
      setShowMarkTypeDialog(true);
    } catch (err) {
      setError("حدث خطأ أثناء التحقق من ملف Excel");
      console.error(err);
      setIsSaving(false);
    }
  };

  // Handle mark type selection
  const handleMarkTypeSelected = async (markType: string) => {
    setIsSaving(true);
    setProcessingStatus("جاري إدخال النقط في ملف Excel...");

    try {
      if (!extractedData) {
        throw new Error("No data to save");
      }

      const results = await excelService.insertMarks(extractedData, markType);

      // Show results
      if (results.notFound > 0) {
        setError(`تم إدخال ${results.success} علامة بنجاح. ${results.notFound} طالب لم يتم العثور عليهم.`);
      } else {
        setError(null);
        // Show success status alert
        setProcessingStatus("تم إدخال النقط بنجاح!");
      }

      // Close dialogs and reset state
      setTimeout(() => {
        setShowMarkTypeDialog(false);
        resetApp();
        setIsSaving(false);
      }, 1500);
    } catch (err) {
      setError("حدث خطأ أثناء إدخال البيانات في Excel");
      console.error(err);
      setIsSaving(false);
      setShowMarkTypeDialog(false);
    }
  };

  // Update extracted data
  const handleDataUpdate = (newData: Student[]) => {
    setExtractedData(newData);
  };

  // Step navigation helpers
  const advanceToStep = (step: AppStep) => {
    setCurrentStep(step);
  };

  const completeStep = (step: AppStep) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      newSet.add(step);
      return newSet;
    });
  };

  const isStepCompleted = (step: AppStep): boolean => {
    return completedSteps.has(step);
  };

  const resetApp = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedData(null);
    setCurrentStep(AppStep.ImageProcessing);
    setCompletedSteps(new Set());
    setProcessingStatus("جاري المعالجة...");
    setProcessingProgress(0);
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <GlobalStyle />
      <Card className="ms-welcome">
        <Text as="h1" className="ms-welcome__header">
          {title || "استيراد النقط - مسار"}
        </Text>

        {excelStatus.checked && !excelStatus.isValid && (
          <StatusAlert
            type="error"
            message="يرجى فتح ملف مسار المُصدَّر من النظام قبل البدء في معالجة الصور. للمتابعة:
            ١. افتح ملف مسار الخاص بالقسم المطلوب
            ٢. تأكد من أن الملف يحتوي على أعمدة العلامات (الفرض ١، الفرض ٢، إلخ)
            ٣. ثم قم برفع صورة كشف النقط"
          />
        )}

        {error && <StatusAlert type="error" message={error} />}

        <div className="steps-container">
          {/* Image Processing Step */}
          <ImageProcessingStep
            isActive={currentStep === AppStep.ImageProcessing}
            isCompleted={isStepCompleted(AppStep.ImageProcessing)}
            selectedImage={selectedImage}
            imagePreview={imagePreview}
            isProcessing={isProcessing}
            processingStatus={processingStatus}
            processingProgress={processingProgress}
            onImageUpload={handleImageUpload}
            onProcessImage={processImage}
            fileInputRef={fileInputRef}
          />

          {/* File Analysis Step */}
          <FileAnalysisStep
            isActive={currentStep === AppStep.FileAnalysis}
            isCompleted={isStepCompleted(AppStep.FileAnalysis)}
            excelStatus={excelStatus}
          />

          {/* Review and Confirm Step */}
          {extractedData && (
            <ReviewConfirmStep
              isActive={currentStep === AppStep.ReviewConfirm}
              isCompleted={isStepCompleted(AppStep.ReviewConfirm)}
              data={extractedData}
              onConfirm={handleConfirmData}
              onCancel={resetApp}
              onDataUpdate={handleDataUpdate}
              isSaving={isSaving}
              processingStatus={processingStatus}
            />
          )}
        </div>

        {/* Mark Type Dialog */}
        <MarkTypeDialog
          isOpen={showMarkTypeDialog}
          onClose={() => setShowMarkTypeDialog(false)}
          onConfirm={handleMarkTypeSelected}
          isSaving={isSaving}
        />
      </Card>
    </FluentProvider>
  );
};

export default App;
