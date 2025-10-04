"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Menu,
  MessageSquare,
  Home,
  CameraIcon,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

export default function DashboardHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      current: pathname === "/dashboard",
    },
  ];

  // Animation variants
  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0
    }
  };
  
  const headerTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 15,
    when: "beforeChildren" as const,
    staggerChildren: 0.1
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0
    }
  };
  
  const itemTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 12
  };
  
  const mobileNavVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: { 
      opacity: 1,
      height: "auto" as const
    },
    exit: {
      opacity: 0,
      height: 0
    }
  };
  
  const mobileNavTransition = {
    duration: 0.3,
    when: "beforeChildren" as const,
    staggerChildren: 0.05
  };

  return (
    <motion.header 
      className="sticky top-0 z-30 border-b bg-background"
      initial="hidden"
      animate="visible"
      variants={headerVariants}
      transition={headerTransition}
    >
      <div className="flex h-16 items-center px-4 md:px-6">
        <motion.div 
          className="md:hidden mr-2" 
          variants={itemVariants}
          transition={itemTransition}
        >
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <AnimatePresence>
            {mobileNavOpen && (
              <motion.div 
                className="absolute top-16 left-0 right-0 border-b bg-background p-4 shadow-lg z-50"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={mobileNavVariants}
                transition={mobileNavTransition}
              >
                <nav className="flex flex-col space-y-2">
                  {navigation.map((item) => (
                    <motion.div 
                      key={item.name}
                      variants={itemVariants}
                      transition={itemTransition}
                      whileHover={{ scale: 1.02 }}
                    >
                      <Link href={item.href}>
                        <Button
                          variant={item.current ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setMobileNavOpen(false)}
                        >
                          <item.icon className="mr-2 h-5 w-5" />
                          {item.name}
                        </Button>
                      </Link>
                    </motion.div>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div 
          className="flex-1" 
          variants={itemVariants}
          transition={itemTransition}
        >
          <h1 className="text-xl font-semibold md:hidden">Camio</h1>
        </motion.div>
        <motion.div 
          className="flex items-center gap-4"
          variants={itemVariants}
          transition={itemTransition}
        >
          <motion.div whileHover={{ scale: 1.05 }}>
            <Button asChild>
              <Link href="/cameras/register">
                <CameraIcon className="mr-2 h-4 w-4" />
                Add New Camera
              </Link>
            </Button>
          </motion.div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }}>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">John Doe</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    john.doe@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Support</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </motion.header>
  );
}