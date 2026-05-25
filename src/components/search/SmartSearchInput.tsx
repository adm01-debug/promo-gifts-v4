/**
 * SmartSearchInput — Search with autocomplete, voice, keyboard nav
 * 
 * v2: Result rendering extracted to SearchResultGroups
 */
import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, X, Clock, TrendingUp, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce, useSearch, useSearchHistory, type SearchResult } from "@/hooks/common";
import { useSpeechRecognition } from "@/hooks/intelligence";
import { GroupedSearchResults } from "./SearchResultGroups";
import { motion, AnimatePresence } from "framer-motion";

interface SmartSearchInputProps {
  /** Unique id for the underlying <input>. Defaults to 'search'.
   *  Must be unique per page — pass a custom value when rendering
   *  multiple instances simultaneously (e.g. desktop + mobile). */
  inputId?: string;
  placeholder?: string;
  onSelect?: (result: SearchResult) => void;
  onSearch?: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
}