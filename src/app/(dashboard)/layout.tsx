"use client";

import DashboardSidebar from "@/components/layout/dashboard-sidebar";
import DashboardHeader from "@/components/layout/dashboard-header";
import { motion } from "framer-motion";

// Animation variants for smooth transitions
const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0
  },
  exit: { opacity: 0, y: -10 }
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 100, 
  damping: 15,
  duration: 0.3
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <div className="flex-1 flex">
        <DashboardSidebar />
        <motion.main 
          className="flex-1 p-6 md:p-8"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}