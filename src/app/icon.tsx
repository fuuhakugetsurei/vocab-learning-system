import { ImageResponse } from "next/og";

// 圖片中繼資料
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// 圖標生成器
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {/* SVG 書本 + 星火 圖示 */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h7" />
          <path d="m19 2 2 2-2 2-2-2Z" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}