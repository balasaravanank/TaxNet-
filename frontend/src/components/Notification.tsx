import React from "react";
import { CheckCircleIcon, XIcon, AlertCircleIcon } from "./Icons";

interface NotificationProps {
  show: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  details?: { label: string; value: string | number }[];
  onClose: () => void;
}

export function Notification({ show, type, title, message, details, onClose }: NotificationProps) {
  if (!show) return null;

  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircleIcon : AlertCircleIcon;
  const iconColor = isSuccess ? "var(--green)" : "var(--red)";
  const bgColor = isSuccess ? "var(--green-light)" : "var(--red-light)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="fade-in-scale"
        style={{
          width: "min(480px, 90vw)",
          background: "var(--bg-surface)",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px",
            background: bgColor,
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={24} color={iconColor} />
          </div>
          <h3
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: iconColor,
              flex: 1,
            }}
          >
            {title}
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: "28px" }}>
          <p
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              color: "var(--text-primary)",
              marginBottom: details && details.length > 0 ? "20px" : 0,
            }}
          >
            {message}
          </p>

          {/* Details */}
          {details && details.length > 0 && (
            <div
              style={{
                background: "var(--bg-elevated)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {details.map((detail, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                    }}
                  >
                    {detail.label}
                  </span>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: iconColor,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 28px 24px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            className="btn btn--primary"
            style={{
              minWidth: "100px",
              padding: "12px 24px",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
