import { motion } from "framer-motion";
import { getRiskColorHex } from "@/lib/utils";

interface GaugeProps {
  value: number; // 0-100
  level: string;
  size?: number;
  strokeWidth?: number;
}

export function Gauge({ value, level, size = 200, strokeWidth = 16 }: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // semi-circle
  const strokeDashoffset = circumference - (value / 100) * circumference;
  const color = getRiskColorHex(level);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size / 2 + 20 }}>
      <svg
        width={size}
        height={size / 2}
        className="overflow-visible"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background Track */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
          strokeLinecap="round"
        />
        
        {/* Value Track */}
        <motion.path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          filter="url(#glow)"
        />
      </svg>
      
      {/* Absolute Value Text */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center translate-y-2">
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-5xl font-display font-bold tracking-tighter"
          style={{ color }}
        >
          {value.toFixed(0)}
        </motion.span>
        <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">
          {level} RISK
        </span>
      </div>
    </div>
  );
}
