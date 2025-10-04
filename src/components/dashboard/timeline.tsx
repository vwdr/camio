"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Clock, 
  Info,
  PlayCircle 
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { motion } from "framer-motion";

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  thumbnailUrl?: string;
  aiAnalysis?: string;
  severity: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  // Format the timestamp to a human-readable format
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      // If parsing fails, return the original timestamp
      return timestamp;
    }
  };
  
  // Get the appropriate icon for the event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case "suspicious":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };
  
  // Get the appropriate background color for the event card
  const getEventBackground = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-50 border-red-200";
      case "medium":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-background";
    }
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 12,
        delay: index * 0.05
      }
    })
  };

  return (
    <motion.div 
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {events.map((event, index) => (
        <motion.div
          key={event.id}
          variants={itemVariants}
          custom={index}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <Card 
            className={`${getEventBackground(event.severity)} transition-all duration-200 hover:shadow-md`}
          >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {getEventIcon(event.type)}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{event.description}</p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
                
                {event.aiAnalysis && (
                  <p className="text-xs text-muted-foreground">
                    {event.aiAnalysis}
                  </p>
                )}
                
                {event.thumbnailUrl && (
                  <div className="relative mt-2 h-24 bg-muted rounded overflow-hidden">
                    <motion.img 
                      src={event.thumbnailUrl}
                      alt="Event thumbnail"
                      className="w-full h-full object-cover"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.5 }}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Button
                          variant="ghost" 
                          size="icon" 
                          className="bg-black/30 hover:bg-black/50 text-white h-8 w-8 rounded-full"
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      ))}
      
      <motion.div 
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button variant="outline" className="w-full text-sm">
          Load More Events
        </Button>
      </motion.div>
    </motion.div>
  );
}