"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Home,
  CameraIcon,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  current: boolean;
  badge?: string;
}

export default function DashboardSidebar() {
  const pathname = usePathname();

  const navigation: NavItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      current: pathname === "/dashboard",
    },
  ];

  // Animation variants
  const sidebarVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: 0.3,
        when: "beforeChildren",
        staggerChildren: 0.05
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0 
    },
    hover: {
      scale: 1.03
    }
  };
  
  const itemTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 12
  };

  return (
    <motion.div
      className="hidden md:flex flex-col w-64 border-r bg-background p-4"
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
    >
      <motion.div 
        className="flex items-center gap-2 px-2 mb-6"
        variants={itemVariants}
        transition={itemTransition}
      >
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/camera-logo.svg"
            alt="Camio Logo"
            width={28}
            height={28}
            className="mr-2"
          />
          <span className="text-lg font-bold">Camio</span>
        </Link>
      </motion.div>
      <div className="space-y-1">
        {navigation.map((item) => (
          <motion.div key={item.name} variants={itemVariants} transition={itemTransition} whileHover="hover">
            <Link href={item.href}>
              <Button
                variant={item.current ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Button>
            </Link>
          </motion.div>
        ))}
      </div>
      <motion.div 
        className="mt-auto pt-4"
        variants={itemVariants}
        transition={itemTransition}
      >
        <Button variant="ghost" className="w-full justify-start text-muted-foreground">
          <LogOut className="mr-3 h-5 w-5" />
          Log out
        </Button>
      </motion.div>
    </motion.div>
  );
}