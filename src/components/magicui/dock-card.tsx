// src/components/magicui/dock-card.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { MotionProps } from "motion/react";
import { cn } from "../../lib/utils";
import { BorderBeam } from "./border-beam";
import { Move, RotateCw, Scale, MousePointer2 } from "lucide-react";

export interface DockCardProps {
  isVisible: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  position?: {
    x: number;
    y: number;
  };
  // Icons for vertical dock display
  icons?: React.ComponentType<any>[];
  // Mouse event handlers
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const DockCard = React.forwardRef<HTMLDivElement, DockCardProps>(
  ({ isVisible, title, description, children, className, position, icons, onMouseEnter, onMouseLeave }, ref) => {
    return (
      <AnimatePresence>
        {isVisible && position && position.x > 0 && position.y > 0 && (
                     <motion.div
             ref={ref}
             initial={{ opacity: 0, scale: 0.85, y: 10 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.85, y: 10 }}
             transition={{
               type: "spring",
               stiffness: 400,
               damping: 30,
               mass: 0.8,
             }}
             onMouseEnter={onMouseEnter}
             onMouseLeave={onMouseLeave}
                         className={cn(
               // Fixed positioning to viewport
               "fixed z-[9999]",
               // Exact dock styling - vertical version
               "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10",
               "backdrop-blur-md border border-white/20",
               "rounded-2xl",
               // Vertical dock dimensions
               "flex flex-col w-[64px] h-auto items-center justify-center gap-2 p-2",
               className
             )}
             style={{
               left: position?.x ? `${position.x - 36}px` : "50%", // Adjust left by half the card width (64px/2 = 32px)
               top: position?.y ? `${position.y - 200}px` : "auto", // 200px offset above icon for much better clearance
               transform: "translateY(-100%)", // Only vertical transform, no horizontal centering needed
             }}
          >
            {/* Vertical Dock Icons - exactly like DockIcon components */}
            {(icons || [MousePointer2, Move, RotateCw, Scale]).map((IconComponent, index) => (
              <motion.div
                key={index}
                className="flex aspect-square cursor-pointer items-center justify-center rounded-full w-[40px] h-[40px]"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <IconComponent className="w-5 h-5 text-white" />
              </motion.div>
            ))}

            {/* Border Beam */}
            <BorderBeam
              duration={6}
              size={60}
              className="from-transparent via-white/30 to-transparent"
              borderWidth={1}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

DockCard.displayName = "DockCard";

export { DockCard };
