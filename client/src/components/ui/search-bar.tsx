import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, X, BookOpen, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "course" | "lesson" | "teacher";
  title: string;
  description: string;
  subject?: string;
  teacher?: string;
  enrollmentCount?: number;
  duration?: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

const mockResults: SearchResult[] = [
  {
    id: "1",
    type: "course",
    title: "Introduction to React",
    description: "Learn the fundamentals of React development",
    subject: "Computer Science",
    teacher: "John Doe",
    enrollmentCount: 1250,
    duration: "8 hours"
  },
  {
    id: "2",
    type: "course",
    title: "Advanced JavaScript",
    description: "Master advanced JavaScript concepts and patterns",
    subject: "Computer Science",
    teacher: "Jane Smith",
    enrollmentCount: 890,
    duration: "12 hours"
  },
  {
    id: "3",
    type: "lesson",
    title: "React Hooks Deep Dive",
    description: "Understanding useState, useEffect, and custom hooks",
    subject: "Computer Science",
  },
];

export function SearchBar({ 
  placeholder = "Search courses, lessons, or teachers...", 
  onSearch,
  onResultSelect,
  className 
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const filteredResults = mockResults.filter(result =>
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.description.toLowerCase().includes(query.toLowerCase()) ||
          result.subject?.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filteredResults);
        setIsLoading(false);
        setIsOpen(true);
      }, 300);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch?.(query);
      setIsOpen(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onResultSelect?.(result);
    setQuery("");
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case "course":
        return <BookOpen className="w-4 h-4" />;
      case "lesson":
        return <BookOpen className="w-4 h-4" />;
      case "teacher":
        return <Users className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case "course":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "lesson":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "teacher":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div ref={searchRef} className={cn("relative w-full max-w-md", className)}>
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10 focus-ring"
          onFocus={() => query.length > 2 && setIsOpen(true)}
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </form>

      {/* Search Results Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg border animate-fade-in">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found for "{query}"</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="p-4 hover:bg-muted/50 cursor-pointer border-b border-border last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        getTypeColor(result.type)
                      )}>
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {result.title}
                          </h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {result.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {result.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          {result.subject && (
                            <span>{result.subject}</span>
                          )}
                          {result.teacher && (
                            <span>by {result.teacher}</span>
                          )}
                          {result.enrollmentCount && (
                            <div className="flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{result.enrollmentCount}</span>
                            </div>
                          )}
                          {result.duration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{result.duration}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}