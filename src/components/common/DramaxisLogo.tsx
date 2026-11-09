/**
 * Dramaxis (剧枢) · 统一品牌识别视觉组件
 * - 电影级琥珀黑金美学体系
 * - 结合戏剧透镜 (Drama Lens)、时间轴中枢 (Timeline Axis) 与高能 Play 核心棱镜
 */

import React from "react";

export interface DramaxisLogoProps {
  /** 呈现形态：mark (纯徽标), horizontal (横向全称), icon (极简图标) */
  variant?: "mark" | "horizontal" | "icon";
  /** 尺寸大小 (像素宽度或高度比例) */
  size?: number;
  /** 附加 className */
  className?: string;
  /** 是否展示右上角多模态 AI 炫光 */
  showFlare?: boolean;
}

export const DramaxisLogo: React.FC<DramaxisLogoProps> = ({
  variant = "mark",
  size = 32,
  className = "",
  showFlare = true,
}) => {
  if (variant === "horizontal") {
    return (
      <svg
        width={size * 4}
        height={size}
        viewBox="0 0 720 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Dramaxis 剧枢 Logo"
      >
        <defs>
          <linearGradient id="hzGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          <linearGradient id="hzTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FEF08A" />
            <stop offset="85%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          <linearGradient id="hzAurora" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <filter id="hzSoftGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 左侧徽标微缩 */}
        <g transform="translate(20, 20) scale(0.2734375)">
          <rect width="512" height="512" rx="112" ry="112" fill="#0E1018" />
          <rect
            x="3"
            y="3"
            width="506"
            height="506"
            rx="110"
            ry="110"
            fill="none"
            stroke="url(#hzGoldGrad)"
            strokeWidth="3"
            opacity="0.45"
          />
          <circle
            cx="256"
            cy="256"
            r="216"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2.5"
            strokeDasharray="6 12"
            opacity="0.2"
          />
          <rect
            x="114"
            y="120"
            width="34"
            height="272"
            rx="17"
            fill="url(#hzGoldGrad)"
          />
          <path
            d="M 134 120 C 270 120, 396 174, 396 256 C 396 338, 270 392, 134 392 C 172 376, 212 360, 240 342 C 328 286, 332 226, 240 170 C 212 152, 172 136, 134 120 Z"
            fill="url(#hzGoldGrad)"
          />
          <path d="M 194 186 L 326 256 L 194 256 Z" fill="#FFFFFF" />
          <path d="M 194 256 L 326 256 L 194 326 Z" fill="#D97706" />
          <circle cx="326" cy="256" r="6" fill="#FFFFFF" />
        </g>

        {/* 右侧文本 */}
        <g transform="translate(184, 40)">
          <text
            x="0"
            y="56"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="54"
            fontWeight="900"
            letterSpacing="-0.8"
            fill="url(#hzTextGrad)"
            filter="url(#hzSoftGlow)"
          >
            Dramaxis
          </text>
          <g transform="translate(276, 14)">
            <rect
              x="0"
              y="0"
              width="76"
              height="34"
              rx="10"
              fill="#F59E0B"
              fillOpacity="0.12"
              stroke="url(#hzGoldGrad)"
              strokeWidth="1.2"
            />
            <text
              x="38"
              y="24"
              fontFamily="sans-serif"
              fontSize="19"
              fontWeight="800"
              fill="#FDE047"
              textAnchor="middle"
            >
              剧枢
            </text>
          </g>
          <line
            x1="0"
            y1="74"
            x2="480"
            y2="74"
            stroke="url(#hzAurora)"
            strokeWidth="1.2"
            opacity="0.6"
          />
          <text
            x="2"
            y="98"
            fontFamily="sans-serif"
            fontSize="15"
            fontWeight="500"
            letterSpacing="0.6"
            fill="#94A3B8"
          >
            电影级多智能体影视叙事与智能解说平台 · 100% 本地优先
          </text>
        </g>
      </svg>
    );
  }

  // 纯徽标形态 (mark & icon)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-label="Dramaxis Emblem"
    >
      <defs>
        <radialGradient
          id={`bgGlow-${size}`}
          cx="50%"
          cy="40%"
          r="65%"
          fx="45%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#1B1E2E" />
          <stop offset="55%" stopColor="#0F111A" />
          <stop offset="100%" stopColor="#08090E" />
        </radialGradient>

        <linearGradient id={`goldBeam-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="25%" stopColor="#FDE047" />
          <stop offset="65%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        <linearGradient id={`goldSec-${size}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#FEF08A" />
        </linearGradient>

        <linearGradient id={`prismLight-${size}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#FFFBEB" />
          <stop offset="70%" stopColor="#F5C842" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        <linearGradient id={`aiAurora-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <filter id={`cineGlow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 圆角黑曜石底板 */}
      <rect width="512" height="512" rx="112" ry="112" fill={`url(#bgGlow-${size})`} />
      <rect
        x="3"
        y="3"
        width="506"
        height="506"
        rx="110"
        ry="110"
        fill="none"
        stroke={`url(#goldBeam-${size})`}
        strokeWidth="2.5"
        opacity="0.38"
      />

      {/* 刻度背景盘 */}
      <circle
        cx="256"
        cy="256"
        r="216"
        fill="none"
        stroke="#FDE047"
        strokeWidth="2"
        strokeDasharray="6 10"
        opacity="0.15"
      />

      {/* 图腾核心 */}
      <g filter={`url(#cineGlow-${size})`}>
        {/* 左侧垂直时间轴柱 */}
        <rect
          x="114"
          y="120"
          width="34"
          height="272"
          rx="17"
          fill={`url(#goldBeam-${size})`}
        />
        <g fill="#0D0E15" opacity="0.55">
          <rect x="122" y="152" width="18" height="6" rx="3" />
          <rect x="122" y="174" width="18" height="6" rx="3" />
          <rect x="122" y="196" width="18" height="6" rx="3" />
          <rect x="122" y="310" width="18" height="6" rx="3" />
          <rect x="122" y="332" width="18" height="6" rx="3" />
          <rect x="122" y="354" width="18" height="6" rx="3" />
        </g>

        {/* 电影 D 拱桥弧线 */}
        <path
          d="M 134 120 
             C 270 120, 396 174, 396 256 
             C 396 338, 270 392, 134 392
             C 172 376, 212 360, 240 342
             C 328 286, 332 226, 240 170
             C 212 152, 172 136, 134 120 Z"
          fill={`url(#goldSec-${size})`}
        />

        {/* 拱桥内极光轨道线 */}
        <path
          d="M 152 144 C 256 144, 364 190, 364 256 C 364 322, 256 368, 152 368"
          fill="none"
          stroke={`url(#aiAurora-${size})`}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* 核心 Play 棱镜 */}
        <path d="M 194 186 L 326 256 L 194 256 Z" fill={`url(#prismLight-${size})`} />
        <path d="M 194 256 L 326 256 L 194 326 Z" fill="#92400E" />
        <path
          d="M 178 200 L 194 186 L 194 326 L 178 312 Z"
          fill={`url(#goldBeam-${size})`}
          opacity="0.9"
        />
        <circle cx="326" cy="256" r="4.5" fill="#FFFFFF" />
      </g>

      {/* 右上角 AI 宽荧幕炫光 */}
      {showFlare && (
        <g transform="translate(382, 128)">
          <ellipse cx="0" cy="0" rx="36" ry="2.5" fill="#38BDF8" opacity="0.9" />
          <path
            d="M 0 -22 Q 0 -5 18 0 Q 0 5 0 22 Q 0 5 -18 0 Q 0 -5 0 -22 Z"
            fill={`url(#goldBeam-${size})`}
          />
          <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
};
