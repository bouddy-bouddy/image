import React from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";

interface ProcessingStatusStep {
  step: string;
  status: "waiting" | "processing" | "completed" | "error";
  message?: string;
}

interface EnhancedLoadingSpinnerProps {
  message?: string;
  isCloudProcessing?: boolean;
  processingSteps?: ProcessingStatusStep[];
  progress?: number; // 0-100
}

const EnhancedLoadingSpinner = (props: EnhancedLoadingSpinnerProps): JSX.Element => {
  const { message = "جاري المعالجة...", isCloudProcessing = false, processingSteps = [], progress } = props;

  const getStatusIcon = (status: ProcessingStatusStep["status"]) => {
    switch (status) {
      case "waiting":
        return "⏳";
      case "processing":
        return "🔄";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "•";
    }
  };

  const getStatusColor = (status: ProcessingStatusStep["status"]) => {
    switch (status) {
      case "waiting":
        return "#666";
      case "processing":
        return "#0078d4";
      case "completed":
        return "#107C10";
      case "error":
        return "#D92C2C";
      default:
        return "#666";
    }
  };

  return (
    <Card
      style={{
        textAlign: "center",
        padding: "32px",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        border: "1px solid #e0e0e0",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        margin: "20px 0",
      }}
    >
      <Spinner size="large" />
      <Text
        style={{
          display: "block",
          marginTop: "16px",
          color: "#242424",
          fontSize: "16px",
          fontWeight: "500",
        }}
      >
        {message}
      </Text>

      {progress !== undefined && (
        <div style={{ marginTop: "16px", maxWidth: "320px", width: "100%", margin: "0 auto" }}>
          <div
            style={{
              position: "relative",
              height: "8px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${Math.min(Math.max(progress, 0), 100)}%`,
                backgroundColor: "#0078d4",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <Text style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{Math.round(progress)}%</Text>
        </div>
      )}

      {processingSteps.length > 0 && (
        <div style={{ marginTop: "20px", textAlign: "right", maxWidth: "320px", margin: "0 auto" }}>
          {processingSteps.map((step, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                opacity: step.status === "waiting" ? 0.6 : 1,
              }}
            >
              <span style={{ marginLeft: "8px", color: getStatusColor(step.status) }}>
                {getStatusIcon(step.status)}
              </span>
              <div style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: "14px",
                    fontWeight: step.status === "processing" ? "600" : "normal",
                    color: step.status === "processing" ? "#0078d4" : "#333",
                  }}
                >
                  {step.step}
                </Text>
                {step.message && (
                  <Text style={{ fontSize: "12px", color: "#666", display: "block" }}>{step.message}</Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isCloudProcessing && (
        <Text style={{ color: "#666", fontSize: "12px", marginTop: "16px" }}>
          نستخدم خدمة Google Cloud Vision للحصول على دقة أعلى في استخراج النقط
        </Text>
      )}
    </Card>
  );
};

export default EnhancedLoadingSpinner;
